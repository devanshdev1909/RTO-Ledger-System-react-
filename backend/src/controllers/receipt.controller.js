const pool = require("../config/db");

// 1. Fetch all payment receipts (Staff paginated view with search)
exports.getReceipts = async (req, res) => {
    try {
        const search = req.query.q || "";
        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;

        const isAgent = req.session.userRole === 'Agent';
        const userId = req.session.userId;

        let query = `
            SELECT r.*, c.name AS customer_name, c.customer_code, v.vehicle_number, sr.request_no, u.username AS cashier_name
            FROM receipts r
            LEFT JOIN ledgers l ON r.ledger_id = l.id
            LEFT JOIN customers c ON l.customer_id = c.id
            LEFT JOIN vehicles v ON l.vehicle_id = v.id
            LEFT JOIN service_requests sr ON l.service_request_id = sr.id
            LEFT JOIN users u ON r.received_by = u.id
        `;
        let countQuery = `
            SELECT COUNT(*)
            FROM receipts r
            LEFT JOIN ledgers l ON r.ledger_id = l.id
            LEFT JOIN customers c ON l.customer_id = c.id
            LEFT JOIN vehicles v ON l.vehicle_id = v.id
            LEFT JOIN service_requests sr ON l.service_request_id = sr.id
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
            conditions.push(`(r.receipt_no ILIKE $${params.length + 1} 
                OR c.name ILIKE $${params.length + 1} 
                OR c.customer_code ILIKE $${params.length + 1} 
                OR v.vehicle_number ILIKE $${params.length + 1} 
                OR sr.request_no ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            const conditionStr = " WHERE " + conditions.join(" AND ");
            query += conditionStr;
            countQuery += conditionStr;
        }

        query += " ORDER BY r.received_at DESC";

        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const [listRes, countRes] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const totalRecords = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalRecords / limit);

        res.json({
            success: true,
            receipts: listRes.rows,
            pagination: {
                totalRecords,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        console.error("Fetch receipts error:", err);
        res.status(500).json({ success: false, error: "Failed to load receipts list." });
    }
};

// 2. Fetch specific receipt details for printing
exports.getReceiptById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT r.*, 
                   c.name AS customer_name, c.customer_code, c.mobile AS customer_mobile, c.address AS customer_address,
                   v.vehicle_number, v.vehicle_type,
                   sr.request_no, s.service_name,
                   u.username AS cashier_name
            FROM receipts r
            LEFT JOIN ledgers l ON r.ledger_id = l.id
            LEFT JOIN customers c ON l.customer_id = c.id
            LEFT JOIN vehicles v ON l.vehicle_id = v.id
            LEFT JOIN service_requests sr ON l.service_request_id = sr.id
            LEFT JOIN services s ON sr.service_id = s.id
            LEFT JOIN users u ON r.received_by = u.id
            WHERE r.id = $1
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Receipt record not found." });
        }
        res.json({ success: true, receipt: result.rows[0] });
    } catch (err) {
        console.error("Get receipt by ID error:", err);
        res.status(500).json({ success: false, error: "Failed to load receipt details." });
    }
};