const pool = require("../config/db");

// Middleware to check if a staff member is logged in
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }
    next();
};

// Middleware to check if the staff member has a specific permission
module.exports.hasPermission = (permissionCode) => {
    return async (req, res, next) => {
        const userId = req.session.userId;
        const userRole = req.session.userRole;
        const permissions = req.session.permissions || [];

        // 1. Admins bypass all checks
        if (userRole === 'Admin') {
            return next();
        }

        // 2. Global permission match
        if (permissions.includes(permissionCode)) {
            return next();
        }

        // 3. Agent allotment bypass
        if (userRole === 'Agent') {
            try {
                let customerId = null;

                // Extract customer ID dynamically from request context
                if (req.params.id && req.baseUrl.includes('customers')) {
                    customerId = req.params.id;
                } else if (req.body.customer_id) {
                    customerId = req.body.customer_id;
                } else if (req.params.id && req.baseUrl.includes('vehicles')) {
                    const vRes = await pool.query("SELECT customer_id FROM vehicles WHERE id = $1", [req.params.id]);
                    customerId = vRes.rows[0]?.customer_id;
                } else if (req.params.id && req.baseUrl.includes('requests')) {
                    const rRes = await pool.query("SELECT customer_id FROM service_requests WHERE id = $1", [req.params.id]);
                    customerId = rRes.rows[0]?.customer_id;
                } else if (req.body.ledger_id && req.baseUrl.includes('ledgers')) {
                    const lRes = await pool.query("SELECT customer_id FROM ledgers WHERE id = $1", [req.body.ledger_id]);
                    customerId = lRes.rows[0]?.customer_id;
                }

                if (customerId) {
                    // Grant permission if this customer is assigned to this agent
                    const check = await pool.query(
                        "SELECT 1 FROM customers WHERE id = $1 AND assigned_agent_id = $2",
                        [customerId, userId]
                    );
                    if (check.rows.length > 0) {
                        return next();
                    }
                }
            } catch (err) {
                console.error("Agent permission bypass error:", err);
            }
        }

        return res.status(403).json({
            error: "Forbidden",
            detail: `You do not have permission to perform this action. Required: ${permissionCode}`
        });
    };
};

// Middleware to check if a customer is logged in
module.exports.isCustomerLoggedIn = (req, res, next) => {
    if (!req.session.customerId) {
        return res.status(401).json({ error: "Unauthorized", code: "CUSTOMER_AUTH_REQUIRED" });
    }
    next();
};