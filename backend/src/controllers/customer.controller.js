const Customer = require("../models/Customer");
const pool = require("../config/db");
const mailer = require("../utils/mailer");

// 1. Get Customers list with search & pagination (scoped to agent if applicable)
exports.getCustomers = async (req, res) => {
    try {
        const search = req.query.q || "";
        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;

        const isAgent = req.session.userRole === 'Agent';
        const userId = req.session.userId;

        let query = `
            SELECT c.*, u.username AS assigned_agent_name 
            FROM customers c
            LEFT JOIN users u ON c.assigned_agent_id = u.id
        `;
        let countQuery = "SELECT COUNT(*) FROM customers c";
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
            conditions.push(`(c.name ILIKE $${params.length + 1} OR c.mobile ILIKE $${params.length + 1} OR c.email ILIKE $${params.length + 1} OR c.customer_code ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            const conditionStr = " WHERE " + conditions.join(" AND ");
            query += conditionStr;
            countQuery += conditionStr;
        }

        query += " ORDER BY c.created_at DESC";
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const [listRes, countRes] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const totalCustomers = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalCustomers / limit);

        res.json({
            success: true,
            customers: listRes.rows,
            pagination: {
                totalCustomers,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        console.error("Fetch customers controller error:", err);
        res.status(500).json({ success: false, error: "Server error fetching customers." });
    }
};

// 2. Fetch single customer by ID
exports.getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, error: "Customer not found." });
        }
        res.json({ success: true, customer });
    } catch (err) {
        console.error("Get customer by ID error:", err);
        res.status(500).json({ success: false, error: "Server error." });
    }
};

// 3. Create customer account by staff
exports.createCustomer = async (req, res) => {
    try {
        const { name, mobile, email, address, assigned_agent_id } = req.body;
        if (!name || !mobile) {
            return res.status(400).json({ success: false, error: "Name and Mobile number are required." });
        }

        // Generate customer code
        const customerCode = await Customer.getNextCustomerCode();

        // If the logged-in staff is an Agent, auto-allot this customer to them
        const isAgent = req.session.userRole === 'Agent';
        const finalAgentId = isAgent ? req.session.userId : (assigned_agent_id ? parseInt(assigned_agent_id, 10) : null);

        // Create in DB
        const newCustomer = await Customer.createStaff(
            customerCode, name, mobile, email || null, address || null, 
            req.session.userId, finalAgentId
        );

        // Trigger welcome email asynchronously
        if (email) {
            setTimeout(() => {
                mailer.sendWelcomeEmail(email, name, customerCode);
            }, 500);
        }

        res.status(201).json({ success: true, message: "Customer created successfully.", customerId: newCustomer.id });
    } catch (err) {
        console.error("Create customer controller error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "Mobile number or email already registered." });
        }
        res.status(500).json({ success: false, error: err.message });
    }
};

// 4. Update customer details by staff
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_code, name, mobile, email, address, assigned_agent_id } = req.body;

        if (!name || !mobile || !customer_code) {
            return res.status(400).json({ success: false, error: "Customer code, name, and mobile are required." });
        }

        // If the logged-in staff is an Agent, auto-allot this customer to them
        const isAgent = req.session.userRole === 'Agent';
        const finalAgentId = isAgent ? req.session.userId : (assigned_agent_id ? parseInt(assigned_agent_id, 10) : null);

        const updated = await Customer.update(
            id, customer_code, name, mobile, email || null, address || null,
            finalAgentId
        );
        res.json({ success: true, message: "Customer updated successfully.", customer: updated });
    } catch (err) {
        console.error("Update customer error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "Customer code, mobile, or email already in use." });
        }
        res.status(500).json({ success: false, error: "Failed to update customer details." });
    }
};

// 5. Toggle customer active status
exports.toggleCustomerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const updated = await Customer.toggleStatus(id, is_active);
        res.json({ success: true, message: `Customer status updated to ${is_active ? 'Active' : 'Inactive'}.`, customer: updated });
    } catch (err) {
        console.error("Toggle customer status error:", err);
        res.status(500).json({ success: false, error: "Failed to toggle customer status." });
    }
};

// 6. Delete a customer account
exports.deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        await Customer.delete(id);
        res.json({ success: true, message: "Customer deleted successfully." });
    } catch (err) {
        console.error("Delete customer error:", err);
        res.status(500).json({ success: false, error: "Cannot delete customer. Ensure they have no registered vehicles or services first." });
    }
};

// 7. Fetch simple list of all customers for form dropdown selection (scoped if Agent)
exports.getCustomersDropdown = async (req, res) => {
    try {
        const isAgent = req.session.userRole === 'Agent';
        let query = "SELECT id, name, customer_code FROM customers";
        const params = [];

        if (isAgent) {
            query += " WHERE assigned_agent_id = $1";
            params.push(req.session.userId);
        }

        query += " ORDER BY name ASC";
        const result = await pool.query(query, params);
        res.json({ success: true, customers: result.rows });
    } catch (err) {
        console.error("Customers dropdown fetch error:", err);
        res.status(500).json({ success: false, error: "Failed to load customers dropdown." });
    }
};

// 8. Fetch list of all active Agents (For customer assignment form selector)
exports.getAgentsList = async (req, res) => {
    try {
        // Query users whose role matches Agent
        const result = await pool.query(`
            SELECT u.id, u.username 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'Agent'
            ORDER BY u.username ASC
        `);
        res.json({ success: true, agents: result.rows });
    } catch (err) {
        console.error("Fetch agents catalog list error:", err);
        res.status(500).json({ success: false, error: "Failed to load agents list." });
    }
};

// 9. Fetch comprehensive customer profile data (Details, Vehicles, Requests, Ledger, Receipts)
exports.getCustomerProfile = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Fetch customer details
        const customerRes = await pool.query(
            `SELECT c.*, u.username AS assigned_agent_name 
             FROM customers c 
             LEFT JOIN users u ON c.assigned_agent_id = u.id 
             WHERE c.id = $1`,
            [id]
        );
        const customer = customerRes.rows[0];
        if (!customer) {
            return res.status(404).json({ success: false, error: "Customer not found." });
        }

        // 2. Fetch vehicles
        const vehiclesRes = await pool.query(
            "SELECT * FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC",
            [id]
        );

        // 3. Fetch service requests
        const requestsRes = await pool.query(
            `SELECT sr.*, s.service_name, v.vehicle_number 
             FROM service_requests sr
             LEFT JOIN services s ON sr.service_id = s.id
             LEFT JOIN vehicles v ON sr.vehicle_id = v.id
             WHERE sr.customer_id = $1
             ORDER BY sr.created_at DESC`,
            [id]
        );

        // 4. Fetch ledger statements
        const ledgerRes = await pool.query(
            `SELECT l.*, v.vehicle_number, sr.request_no, s.service_name 
             FROM ledgers l
             LEFT JOIN vehicles v ON l.vehicle_id = v.id
             LEFT JOIN service_requests sr ON l.service_request_id = sr.id
             LEFT JOIN services s ON sr.service_id = s.id
             WHERE l.customer_id = $1
             ORDER BY l.created_at DESC`,
            [id]
        );

        // 5. Fetch receipts
        const receiptsRes = await pool.query(
            `SELECT r.*, sr.request_no, s.service_name, v.vehicle_number
             FROM receipts r
             LEFT JOIN ledgers l ON r.ledger_id = l.id
             LEFT JOIN service_requests sr ON l.service_request_id = sr.id
             LEFT JOIN services s ON sr.service_id = s.id
             LEFT JOIN vehicles v ON l.vehicle_id = v.id
             WHERE l.customer_id = $1
             ORDER BY r.received_at DESC`,
            [id]
        );

        res.json({
            success: true,
            customer,
            vehicles: vehiclesRes.rows,
            requests: requestsRes.rows,
            ledger: ledgerRes.rows,
            receipts: receiptsRes.rows
        });
    } catch (err) {
        console.error("Fetch customer profile error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};