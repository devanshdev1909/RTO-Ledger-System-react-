const Ledger = require("../models/Ledger");
const pool = require("../config/db");
const mailer = require("../utils/mailer");

// 1. Fetch all ledger records (Staff paginated view with search)
exports.getLedgers = async (req, res) => {
    try {
        const search = req.query.q || "";
        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;

        const isAgent = req.session.userRole === 'Agent';
        const userId = req.session.userId;

        let query = `
            SELECT l.*, c.name AS customer_name, c.customer_code, v.vehicle_number, sr.request_no, s.service_name
            FROM ledgers l
            LEFT JOIN customers c ON l.customer_id = c.id
            LEFT JOIN vehicles v ON l.vehicle_id = v.id
            LEFT JOIN service_requests sr ON l.service_request_id = sr.id
            LEFT JOIN services s ON sr.service_id = s.id
        `;
        let countQuery = `
            SELECT COUNT(*)
            FROM ledgers l
            LEFT JOIN customers c ON l.customer_id = c.id
            LEFT JOIN vehicles v ON l.vehicle_id = v.id
            LEFT JOIN service_requests sr ON l.service_request_id = sr.id
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
            conditions.push(`(c.name ILIKE $${params.length + 1} 
                OR c.customer_code ILIKE $${params.length + 1} 
                OR v.vehicle_number ILIKE $${params.length + 1} 
                OR sr.request_no ILIKE $${params.length + 1} 
                OR s.service_name ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            const conditionStr = " WHERE " + conditions.join(" AND ");
            query += conditionStr;
            countQuery += conditionStr;
        }

        query += " ORDER BY l.created_at DESC";

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
            ledgers: listRes.rows,
            pagination: {
                totalRecords,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        console.error("Fetch ledgers controller error:", err);
        res.status(500).json({ success: false, error: "Failed to load ledger records." });
    }
};

// 2. Record a payment receipt (reduces ledger due_amount)
exports.recordPayment = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { ledger_id, amount_received, payment_mode, remarks, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        if (!ledger_id || !amount_received || parseFloat(amount_received) <= 0) {
            return res.status(400).json({ success: false, error: "Valid Ledger ID and payment amount are required." });
        }

        // Secure signature verification if payment mode is Online
        if (payment_mode === 'Online') {
            if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                return res.status(400).json({ success: false, error: "Razorpay payment details are required for online payments." });
            }
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

        // A. Fetch current ledger details to verify outstanding balance
        const ledgerQuery = await client.query(
            "SELECT service_fee, amount_paid, due_amount FROM ledgers WHERE id = $1",
            [ledger_id]
        );
        if (ledgerQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Ledger record not found." });
        }

        const ledger = ledgerQuery.rows[0];
        const payment = parseFloat(amount_received);
        const currentDue = parseFloat(ledger.due_amount);

        if (payment > currentDue) {
            return res.status(400).json({ success: false, error: `Payment (₹${payment}) exceeds outstanding dues (₹${currentDue}).` });
        }

        const newPaidTotal = parseFloat(ledger.amount_paid) + payment;
        const newStatus = newPaidTotal >= parseFloat(ledger.service_fee) ? 'Paid' : 'Partial';

        // B. Update Ledger (DB automatically recalculates due_amount generated column)
        await Ledger.updatePayment(ledger_id, newPaidTotal, newStatus, client);

        // C. Create Receipt
        const receiptNo = 'REC-' + Date.now();
        await client.query(`
            INSERT INTO receipts (receipt_no, ledger_id, amount_received, payment_mode, transaction_reference, received_by, remarks, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            receiptNo,
            ledger_id,
            payment,
            payment_mode || 'Cash',
            razorpay_payment_id || null,
            req.session.userId,
            remarks || (payment_mode === 'Online' ? `Online Verified Payment via Razorpay (Ref: ${razorpay_payment_id})` : 'Payment received against outstanding dues')
        ]);

        await client.query("COMMIT");

        // Fire-and-forget payment confirmation receipt email
        try {
            const detailsQuery = await pool.query(`
                SELECT c.name, c.email, sr.request_no, s.service_name 
                FROM ledgers l
                LEFT JOIN customers c ON l.customer_id = c.id
                LEFT JOIN service_requests sr ON l.service_request_id = sr.id
                LEFT JOIN services s ON sr.service_id = s.id
                WHERE l.id = $1
            `, [ledger_id]);

            const details = detailsQuery.rows[0];
            if (details && details.email) {
                const receiptDetails = {
                    receipt_no: receiptNo,
                    amount: payment,
                    payment_mode: payment_mode || 'Cash',
                    remarks: remarks || 'Payment received against outstanding dues',
                    request_no: details.request_no,
                    service_name: details.service_name
                };
                mailer.sendReceiptEmail(details.email, details.name, receiptDetails);
            }
        } catch (mailErr) {
            console.error("Failed to queue receipt confirmation email:", mailErr);
        }

        res.json({ success: true, message: "Payment recorded successfully.", receiptNo });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Record payment error:", err);
        res.status(500).json({ success: false, error: "Failed to record payment." });
    } finally {
        client.release();
    }
};