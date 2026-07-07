const pool = require('../config/db');

module.exports = async (req, res, next) => {
    if (req.session && req.session.customerId) {
        try {
            // Fetch customer profile from database to make it available to the route handlers
            const profileRes = await pool.query('SELECT * FROM customers WHERE id = $1', [req.session.customerId]);
            if (profileRes.rows.length > 0) {
                req.currentCustomer = profileRes.rows[0];
            }
        } catch (err) {
            console.error('Error fetching customer profile in middleware:', err);
        }
        return next();
    }
    return res.status(401).json({ error: "Unauthorized", code: "CUSTOMER_AUTH_REQUIRED" });
};