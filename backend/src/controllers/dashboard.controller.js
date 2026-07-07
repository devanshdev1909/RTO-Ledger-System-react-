const db = require("../config/db");
const Customer = require("../models/Customer");
const Vehicle = require("../models/Vehicle");
const ServiceRequest = require("../models/ServiceRequest");
const Ledger = require("../models/Ledger");
const Receipt = require("../models/Receipt");
const mailer = require("../utils/mailer");

// 1. Fetch Dashboard Stats & Chart datasets
module.exports.getDashboard = async (req, res) => {
    try {
        const isAgent = req.session.userRole === 'Agent';
        const userId = req.session.userId;

        let customerQuery = "SELECT COUNT(*) AS total FROM customers";
        let vehicleQuery = "SELECT COUNT(*) AS total FROM vehicles";
        let requestQuery = "SELECT COUNT(*) AS total FROM service_requests";
        let pendingQuery = "SELECT COUNT(*) AS total FROM service_requests WHERE status = 'Pending'";
        let completedQuery = "SELECT COUNT(*) AS total FROM service_requests WHERE status = 'Completed'";
        let todayQuery = "SELECT COUNT(*) AS total FROM service_requests WHERE DATE(created_at) = CURRENT_DATE";
        let revenueQuery = "SELECT COALESCE(SUM(service_fee),0) AS total FROM ledgers";
        let dueQuery = "SELECT COALESCE(SUM(due_amount),0) AS total FROM ledgers";
        let rOverTimeQuery = `
            SELECT TO_CHAR(created_at, 'DD Mon') as date_label, COUNT(*) as count
            FROM service_requests
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY TO_CHAR(created_at, 'DD Mon'), DATE_TRUNC('day', created_at)
            ORDER BY DATE_TRUNC('day', created_at) ASC
        `;
        let cOverTimeQuery = `
            SELECT TO_CHAR(created_at, 'DD Mon') as date_label, COUNT(*) as count
            FROM customers
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY TO_CHAR(created_at, 'DD Mon'), DATE_TRUNC('day', created_at)
            ORDER BY DATE_TRUNC('day', created_at) ASC
        `;

        const params = [];
        if (isAgent) {
            params.push(userId);
            customerQuery = "SELECT COUNT(*) AS total FROM customers WHERE assigned_agent_id = $1";
            vehicleQuery = "SELECT COUNT(*) AS total FROM vehicles v JOIN customers c ON v.customer_id = c.id WHERE c.assigned_agent_id = $1";
            requestQuery = "SELECT COUNT(*) AS total FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE c.assigned_agent_id = $1";
            pendingQuery = "SELECT COUNT(*) AS total FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE sr.status = 'Pending' AND c.assigned_agent_id = $1";
            completedQuery = "SELECT COUNT(*) AS total FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE sr.status = 'Completed' AND c.assigned_agent_id = $1";
            todayQuery = "SELECT COUNT(*) AS total FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE DATE(sr.created_at) = CURRENT_DATE AND c.assigned_agent_id = $1";
            revenueQuery = "SELECT COALESCE(SUM(service_fee),0) AS total FROM ledgers l JOIN customers c ON l.customer_id = c.id WHERE c.assigned_agent_id = $1";
            dueQuery = "SELECT COALESCE(SUM(due_amount),0) AS total FROM ledgers l JOIN customers c ON l.customer_id = c.id WHERE c.assigned_agent_id = $1";
            
            rOverTimeQuery = `
                SELECT TO_CHAR(sr.created_at, 'DD Mon') as date_label, COUNT(sr.id) as count
                FROM service_requests sr
                JOIN customers c ON sr.customer_id = c.id
                WHERE sr.created_at >= NOW() - INTERVAL '30 days' AND c.assigned_agent_id = $1
                GROUP BY TO_CHAR(sr.created_at, 'DD Mon'), DATE_TRUNC('day', sr.created_at)
                ORDER BY DATE_TRUNC('day', sr.created_at) ASC
            `;
            cOverTimeQuery = `
                SELECT TO_CHAR(created_at, 'DD Mon') as date_label, COUNT(id) as count
                FROM customers
                WHERE created_at >= NOW() - INTERVAL '30 days' AND assigned_agent_id = $1
                GROUP BY TO_CHAR(created_at, 'DD Mon'), DATE_TRUNC('day', created_at)
                ORDER BY DATE_TRUNC('day', created_at) ASC
            `;
        }

        const [
            totalCustomers, totalVehicles, totalRequests, pendingJobs,
            completedJobs, todayRequests, revenue, dueAmount,
            requestsOverTime, customersOverTime
        ] = await Promise.all([
            db.query(customerQuery, params),
            db.query(vehicleQuery, params),
            db.query(requestQuery, params),
            db.query(pendingQuery, params),
            db.query(completedQuery, params),
            db.query(todayQuery, params),
            db.query(revenueQuery, params),
            db.query(dueQuery, params),
            db.query(rOverTimeQuery, params),
            db.query(cOverTimeQuery, params)
        ]);

        const totalServices = await db.query("SELECT COUNT(*) AS total FROM services");

        res.json({
            success: true,
            stats: {
                customers: parseInt(totalCustomers.rows[0].total, 10),
                vehicles: parseInt(totalVehicles.rows[0].total, 10),
                services: parseInt(totalServices.rows[0].total, 10),
                requests: parseInt(totalRequests.rows[0].total, 10),
                pendingJobs: parseInt(pendingJobs.rows[0].total, 10),
                completedJobs: parseInt(completedJobs.rows[0].total, 10),
                todayRequests: parseInt(todayRequests.rows[0].total, 10),
                revenue: parseFloat(revenue.rows[0].total),
                dueAmount: parseFloat(dueAmount.rows[0].total)
            },
            chartData: {
                requestsOverTime: requestsOverTime.rows,
                customersOverTime: customersOverTime.rows
            }
        });
    } catch (err) {
        console.error("Dashboard stats fetch error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// 2. Process Quick Add Form (Runs everything inside a transaction)
module.exports.postQuickAdd = async (req, res) => {
    const client = await db.connect(); // Request a transactional database channel
    try {
        await client.query("BEGIN"); // Start SQL Transaction
        
        const { customer, vehicles, services } = req.body;
        const receiptsToPrint = [];

        // Step 1: Create Customer
        const customerCode = await Customer.getNextCustomerCode(client);
        
        const isAgent = req.session.userRole === 'Agent';
        const assignedAgentId = isAgent ? req.session.userId : null;

        const newCustomer = await Customer.createStaff(
            customerCode, customer.name, customer.mobile,
            customer.email || null, customer.address, req.session.userId, assignedAgentId, client
        );
        const customerId = newCustomer.id;

        // Step 2: Create Vehicles & Map temporary frontend indexes to DB IDs
        const vehicleMap = {}; 
        if (vehicles && vehicles.length > 0) {
            for (const v of vehicles) {
                const newVehicle = await Vehicle.create(
                    customerId, v.vehicle_number, v.vehicle_type,
                    v.chassis_number || null, v.engine_number || null, v.registration_date || null,
                    v.driver_name || null, v.driver_mobile || null, client
                );
                vehicleMap[v.index] = newVehicle.id;
            }
        }

        // Step 3: Create Service Requests & Ledgers
        if (services && services.length > 0) {
            for (const s of services) {
                const realVehicleId = vehicleMap[s.vehicle_index];

                // Create the Service Request
                const newRequest = await ServiceRequest.create(
                    customerId, realVehicleId, s.service_id,
                    s.service_fee, null, 'Pending', client
                );

                const paidAmount = parseFloat(s.paid_amount) || 0;
                const serviceFee = parseFloat(s.service_fee) || 0;
                
                let ledgerStatus = "Unpaid";
                if (paidAmount >= serviceFee && serviceFee > 0) ledgerStatus = "Paid";
                else if (paidAmount > 0) ledgerStatus = "Partial";

                // Create accounting ledger record
                const newLedger = await Ledger.create(
                    customerId, realVehicleId, newRequest.id,
                    serviceFee, paidAmount, ledgerStatus, client
                );

                // Create payment receipt if payment mode is specified
                if (paidAmount >= 0 && s.payment_mode) {
                    const receiptNo = await Receipt.getNextReceiptNo(client);
                    const newReceipt = await Receipt.create(
                        receiptNo, newLedger.id, customerId, paidAmount, 
                        s.payment_mode, "Quick Add Registration", req.session.userId, client
                    );
                    receiptsToPrint.push(newReceipt.id);

                    // Send receipt confirmation email asynchronously (after transaction commits)
                    if (customer.email) {
                        const receiptDetails = {
                            receipt_no: receiptNo,
                            amount: paidAmount,
                            payment_mode: s.payment_mode,
                            remarks: "Quick Add Registration"
                        };
                        // Queue email sending
                        setTimeout(() => {
                            mailer.sendReceiptEmail(customer.email, customer.name, receiptDetails);
                        }, 500);
                    }
                }

                // Send request confirmation email
                if (customer.email) {
                    const matchedVehicle = vehicles ? vehicles.find(vec => vec.index === s.vehicle_index) : null;
                    const requestDetails = {
                        request_no: newRequest.request_no || 'Pending',
                        service_name: "RTO Service Registration", 
                        vehicle_number: matchedVehicle ? matchedVehicle.vehicle_number : 'N/A',
                        status: 'Pending'
                    };
                    setTimeout(() => {
                        mailer.sendRequestCreatedEmail(customer.email, customer.name, requestDetails);
                    }, 500);
                }
            }
        }

        await client.query("COMMIT"); // Save all changes to PostgreSQL permanently

        // Send welcome onboarding email
        if (customer.email) {
            setTimeout(() => {
                mailer.sendWelcomeEmail(customer.email, customer.name, customerCode);
            }, 500);
        }

        res.status(200).json({ success: true, receipts: receiptsToPrint });
    } catch (err) {
        await client.query("ROLLBACK"); // Cancel everything in case of any database failure
        console.error("Quick Add Transaction Error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release(); // Return connection channel back to pool
    }
};