const ServiceRequest = require("../models/ServiceRequest");
const Service = require("../models/Service");
const Ledger = require("../models/Ledger");
const pool = require("../config/db");
const mailer = require("../utils/mailer");

// 1. Get all service requests (Staff View with search & pagination)
exports.getRequests = async (req, res) => {
    try {
        const search = req.query.q || "";
        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;

        const isAgent = req.session.userRole === 'Agent';
        const userId = req.session.userId;

        let query = `
            SELECT sr.*, c.name AS customer_name, c.customer_code, v.vehicle_number, s.service_name
            FROM service_requests sr
            LEFT JOIN customers c ON sr.customer_id = c.id
            LEFT JOIN vehicles v ON sr.vehicle_id = v.id
            LEFT JOIN services s ON sr.service_id = s.id
        `;
        let countQuery = `
            SELECT COUNT(*)
            FROM service_requests sr
            LEFT JOIN customers c ON sr.customer_id = c.id
            LEFT JOIN vehicles v ON sr.vehicle_id = v.id
            LEFT JOIN services s ON sr.service_id = s.id
        `;
        const params = [];
        const countParams = [];
        const conditions = [];

        // Agent-scoped allotment filter
        if (isAgent) {
            conditions.push(`c.assigned_agent_id = $${params.length + 1}`);
            params.push(userId);
            countParams.push(userId);
        }

        if (search) {
            conditions.push(`(sr.request_no ILIKE $${params.length + 1} 
                OR c.name ILIKE $${params.length + 1} 
                OR c.customer_code ILIKE $${params.length + 1} 
                OR v.vehicle_number ILIKE $${params.length + 1} 
                OR s.service_name ILIKE $${params.length + 1} 
                OR sr.status ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            const conditionStr = " WHERE " + conditions.join(" AND ");
            query += conditionStr;
            countQuery += conditionStr;
        }

        query += " ORDER BY sr.created_at DESC";

        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const [listRes, countRes] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const totalRequests = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalRequests / limit);

        res.json({
            success: true,
            requests: listRes.rows,
            pagination: {
                totalRequests,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        console.error("Fetch requests controller error:", err);
        res.status(500).json({ success: false, error: "Failed to load service requests." });
    }
};

// 2. Fetch master services list (for dropdowns)
exports.getServices = async (req, res) => {
    try {
        const services = await Service.getActiveServices();
        res.json({ success: true, services });
    } catch (err) {
        console.error("Fetch active services error:", err);
        res.status(500).json({ success: false, error: "Failed to load active RTO services." });
    }
};

// 3. Create a service request directly
exports.createRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { 
            customer_id, vehicle_id, service_id, amount, paid_amount, remarks,
            payment_mode, razorpay_payment_id, razorpay_order_id, razorpay_signature 
        } = req.body;

        if (!customer_id || !vehicle_id || !service_id || !amount) {
            return res.status(400).json({ success: false, error: "Customer, Vehicle, Service, and Amount are required." });
        }

        const upfrontPaid = parseFloat(paid_amount) || 0;
        const mode = payment_mode || 'Cash';

        // Secure signature verification if client selected Razorpay upfront
        if (mode === 'Razorpay' && upfrontPaid > 0) {
            const crypto = require("crypto");
            const text = razorpay_order_id + "|" + razorpay_payment_id;
            const computedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
                .update(text)
                .digest("hex");

            if (computedSignature !== razorpay_signature) {
                await client.query("ROLLBACK");
                return res.status(400).json({ success: false, error: "Invalid Razorpay payment signature." });
            }
        }

        // 1. Create Service Request
        const newRequest = await ServiceRequest.create(
            customer_id, vehicle_id, service_id, amount, remarks || null, 'Pending', client
        );

        const ledgerStatus = upfrontPaid >= parseFloat(amount) ? 'Paid' : upfrontPaid > 0 ? 'Partial' : 'Unpaid';

        // 2. Create corresponding Ledger Entry
        const newLedger = await Ledger.create(
            customer_id, vehicle_id, newRequest.id, amount, upfrontPaid, ledgerStatus, client
        );

        let receiptNo = null;
        // 3. Create Receipt if payment was made upfront
        if (upfrontPaid > 0) {
            receiptNo = 'REC-' + Date.now();
            await client.query(`
                INSERT INTO receipts (receipt_no, ledger_id, amount_received, payment_mode, transaction_reference, received_by, remarks, received_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [receiptNo, newLedger.id, upfrontPaid, mode, razorpay_payment_id || null, req.session.userId, 'Initial request payment']);
        }

        await client.query("COMMIT");

        // Fire-and-forget email notification
        try {
            const customerQuery = await pool.query("SELECT name, email FROM customers WHERE id = $1", [customer_id]);
            const customer = customerQuery.rows[0];
            if (customer && customer.email) {
                const serviceQuery = await pool.query("SELECT service_name FROM services WHERE id = $1", [service_id]);
                const vehicleQuery = await pool.query("SELECT vehicle_number FROM vehicles WHERE id = $1", [vehicle_id]);
                
                const requestDetails = {
                    request_no: newRequest.request_no,
                    service_name: serviceQuery.rows[0]?.service_name || 'N/A',
                    vehicle_number: vehicleQuery.rows[0]?.vehicle_number || 'N/A',
                    status: 'Pending'
                };
                
                mailer.sendRequestCreatedEmail(customer.email, customer.name, requestDetails);

                // Send receipt email if upfront payment was made
                if (upfrontPaid > 0 && receiptNo) {
                    const receiptDetails = {
                        receipt_no: receiptNo,
                        amount: upfrontPaid,
                        payment_mode: mode || 'Cash',
                        remarks: 'Initial request payment',
                        request_no: newRequest.request_no,
                        service_name: serviceQuery.rows[0]?.service_name || 'N/A'
                    };
                    mailer.sendReceiptEmail(customer.email, customer.name, receiptDetails);
                }
            }
        } catch (mailErr) {
            console.error("Failed to queue request email notifications:", mailErr);
        }

        res.status(201).json({ success: true, message: "Service request registered successfully.", requestNo: newRequest.request_no });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Create request controller error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
};

// 4. Update request status
exports.updateRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // e.g. Approved, Completed, Rejected

        if (!status) {
            return res.status(400).json({ success: false, error: "Status is required." });
        }

        await ServiceRequest.updateStatus(id, status);

        // Fetch request details for status email update
        try {
            const reqDetailsQuery = await pool.query(`
                SELECT sr.*, c.name AS customer_name, c.email AS customer_email, v.vehicle_number, s.service_name
                FROM service_requests sr
                LEFT JOIN customers c ON sr.customer_id = c.id
                LEFT JOIN vehicles v ON sr.vehicle_id = v.id
                LEFT JOIN services s ON sr.service_id = s.id
                WHERE sr.id = $1
            `, [id]);

            const reqData = reqDetailsQuery.rows[0];
            if (reqData && reqData.customer_email) {
                const requestDetails = {
                    request_no: reqData.request_no,
                    service_name: reqData.service_name,
                    vehicle_number: reqData.vehicle_number,
                    status: status,
                    remarks: reqData.remarks
                };
                mailer.sendStatusUpdateEmail(reqData.customer_email, reqData.customer_name, requestDetails);
            }
        } catch (mailErr) {
            console.error("Failed to queue status update email:", mailErr);
        }

        res.json({ success: true, message: `Request status updated to ${status}.` });
    } catch (err) {
        console.error("Update request status error:", err);
        res.status(500).json({ success: false, error: "Failed to update request status." });
    }
};

// 5. Delete service request
exports.deleteRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params;

        // Delete receipts linked to this request's ledger first
        await client.query(`
            DELETE FROM receipts WHERE ledger_id IN (
                SELECT id FROM ledgers WHERE service_request_id = $1
            )
        `, [id]);

        // Delete ledger linked to this request
        await client.query("DELETE FROM ledgers WHERE service_request_id = $1", [id]);

        // Delete the service request itself
        await client.query("DELETE FROM service_requests WHERE id = $1", [id]);

        await client.query("COMMIT");
        res.json({ success: true, message: "Service request and linked ledger entries deleted successfully." });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Delete request error:", err);
        res.status(500).json({ success: false, error: "Failed to delete request." });
    } finally {
        client.release();
    }
};

// 6. Update service request details
exports.updateRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params;
        const { customer_id, vehicle_id, service_id, amount, remarks } = req.body;

        if (!customer_id || !vehicle_id || !service_id || !amount) {
            return res.status(400).json({ success: false, error: "Customer, Vehicle, Service, and Amount are required." });
        }

        // 1. Update the service request itself
        await client.query(`
            UPDATE service_requests 
            SET customer_id = $1, vehicle_id = $2, service_id = $3, amount = $4, remarks = $5, updated_at = NOW() 
            WHERE id = $6
        `, [customer_id, vehicle_id, service_id, amount, remarks || null, id]);

        // 2. Fetch the corresponding ledger entry to recalculate status
        const ledgerQuery = await client.query("SELECT * FROM ledgers WHERE service_request_id = $1", [id]);
        if (ledgerQuery.rows.length > 0) {
            const ledger = ledgerQuery.rows[0];
            const amountPaid = parseFloat(ledger.amount_paid);
            const newFee = parseFloat(amount);
            const newDue = newFee - amountPaid;
            const newStatus = amountPaid >= newFee ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid';

            await client.query(`
                UPDATE ledgers 
                SET customer_id = $1, vehicle_id = $2, service_fee = $3, due_amount = $4, status = $5
                WHERE service_request_id = $6
            `, [customer_id, vehicle_id, newFee, newDue, newStatus, id]);
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Service request updated successfully." });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Update request controller error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
};

const Razorpay = require("razorpay");

// 7. Create a temporary Razorpay Order for upfront desk collection
exports.createTempOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, error: "Valid payment amount is required." });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const options = {
            amount: Math.round(parseFloat(amount) * 100),
            currency: "INR",
            receipt: "temp_" + Date.now()
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (err) {
        console.error("Create Temp Order Error:", err);
        res.status(500).json({ success: false, error: err.message || "Failed to create payment order." });
    }
};