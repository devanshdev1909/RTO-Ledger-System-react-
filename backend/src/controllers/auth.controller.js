const User = require("../models/User");
const pool = require("../config/db");

// 1. Staff Login Handler
module.exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find the user by email in the database
        const user = await User.findByEmail(email);

        if (!user) {
            return res.status(401).json({ success: false, error: "User Not Found" });
        }

        // Compare password directly (Plain text match, identical to original EJS project logic)
        const isMatch = password === user.password_hash;
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "Invalid Password" });
        }

        // Store staff details in the session cookie
        req.session.userId = user.id;
        req.session.roleId = user.role_id;
        req.session.userName = user.username;
        req.session.userRole = user.role_name;

        // Fetch real-time permissions for this user
        let permissions = [];
        if (user.role_name === 'Admin') {
            // Admins have all permissions
            const allPerms = await pool.query("SELECT code FROM permissions");
            permissions = allPerms.rows.map(r => r.code);
        } else {
            // 1. Try to load user-specific custom permissions overrides
            let permResult = await pool.query(`
              SELECT p.code
              FROM permissions p
              JOIN user_permissions up ON p.id = up.permission_id
              WHERE up.user_id = $1
            `, [user.id]);

            // 2. If no custom permissions, load their default role permissions
            if (permResult.rows.length === 0 && user.role_id) {
              permResult = await pool.query(`
                SELECT p.code
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = $1
              `, [user.role_id]);
            }
            permissions = permResult.rows.map(r => r.code);
        }
        
        // Save the permissions array inside the session cookie
        req.session.permissions = permissions;

        // Respond with success and user metadata
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role_name
            },
            permissions
        });
    } catch (err) {
        console.error("Login controller error:", err);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// 2. Session Fetcher (Checks if cookie has active login session)
module.exports.getMe = async (req, res) => {
    if (req.session.userId) {
        // Staff is logged in
        res.json({
            loggedIn: true,
            userType: 'staff',
            user: {
                id: req.session.userId,
                username: req.session.userName,
                role: req.session.userRole
            },
            permissions: req.session.permissions || []
        });
    } else if (req.session.customerId) {
        // Customer is logged in
        res.json({
            loggedIn: true,
            userType: 'customer',
            customer: {
                id: req.session.customerId,
                name: req.session.customerName
            },
            permissions: []
        });
    } else {
        // Nobody is logged in
        res.json({ loggedIn: false });
    }
};
