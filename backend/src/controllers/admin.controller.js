const pool = require("../config/db");
const Ledger = require("../models/Ledger");

// 1. Fetch all staff members
exports.getUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.email, r.name AS role_name, u.role_id 
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.username ASC
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 2. Fetch all system permissions (ordered: customer, vehicle, services, service requests, ledger, receipt)
exports.getPermissions = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, code, description 
            FROM permissions 
            ORDER BY 
              CASE 
                WHEN code LIKE 'customer.%' THEN 1
                WHEN code LIKE 'vehicle.%' THEN 2
                WHEN code LIKE 'service_catalog.%' THEN 3
                WHEN code LIKE 'service.%' OR code LIKE 'service_request.%' THEN 4
                WHEN code LIKE 'ledger.%' THEN 5
                WHEN code LIKE 'receipt.%' THEN 6
                ELSE 7 
              END, 
              code ASC
        `);
        res.json({ success: true, permissions: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 3. Fetch custom overrides for a user
exports.getUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT permission_id FROM user_permissions WHERE user_id = $1", [id]);
        res.json({ success: true, permissionIds: result.rows.map(r => r.permission_id) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 4. Save custom overrides for a user
exports.saveUserPermissions = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params;
        const { permissionIds } = req.body; // Array of permission IDs

        await client.query("DELETE FROM user_permissions WHERE user_id = $1", [id]);

        if (permissionIds && permissionIds.length > 0) {
            for (const pid of permissionIds) {
                await client.query(
                    "INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2)",
                    [id, pid]
                );
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "User permissions overrides updated successfully." });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
};

// 5. Fetch all system roles
exports.getRoles = async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, description FROM roles ORDER BY name ASC");
        res.json({ success: true, roles: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 6. Fetch default permissions for a role
exports.getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT permission_id FROM role_permissions WHERE role_id = $1", [id]);
        res.json({ success: true, permissionIds: result.rows.map(r => r.permission_id) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 7. Save default permissions for a role
exports.saveRolePermissions = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params;
        const { permissionIds } = req.body;

        await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);

        if (permissionIds && permissionIds.length > 0) {
            for (const pid of permissionIds) {
                await client.query(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
                    [id, pid]
                );
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Role default permissions updated successfully." });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
};

// 8. Fetch active agents and their assigned customers
exports.getAgentAllotments = async (req, res) => {
    try {
        const agentsRes = await pool.query(`
            SELECT u.id, u.username, u.email 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'Agent'
            ORDER BY u.username ASC
        `);

        const allotmentsRes = await pool.query(`
            SELECT id, name, customer_code, assigned_agent_id 
            FROM customers 
            WHERE assigned_agent_id IS NOT NULL
        `);

        const agents = agentsRes.rows.map(agent => ({
            ...agent,
            allottedCustomers: allotmentsRes.rows.filter(c => parseInt(c.assigned_agent_id, 10) === parseInt(agent.id, 10))
        }));

        res.json({ success: true, agents });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 9. Fetch customers who do not have an agent assigned
exports.getUnassignedCustomers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, customer_code 
            FROM customers 
            WHERE assigned_agent_id IS NULL
            ORDER BY name ASC
        `);
        res.json({ success: true, customers: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 10. Allot a customer to an agent
exports.allotCustomer = async (req, res) => {
    try {
        const { agent_id, customer_id } = req.body;
        if (!agent_id || !customer_id) {
            return res.status(400).json({ success: false, error: "Agent ID and Customer ID are required." });
        }
        await pool.query(
            "UPDATE customers SET assigned_agent_id = $1 WHERE id = $2",
            [agent_id, customer_id]
        );
        res.json({ success: true, message: "Customer allotted to agent successfully." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 11. Unallot a customer
exports.unallotCustomer = async (req, res) => {
    try {
        const { customer_id } = req.body;
        if (!customer_id) {
            return res.status(400).json({ success: false, error: "Customer ID is required." });
        }
        await pool.query(
            "UPDATE customers SET assigned_agent_id = NULL WHERE id = $1",
            [customer_id]
        );
        res.json({ success: true, message: "Customer unallotted successfully." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 12. Create a new staff user or agent
exports.createUser = async (req, res) => {
    try {
        const { username, email, password, role_id } = req.body;
        if (!username || !email || !password || !role_id) {
            return res.status(400).json({ success: false, error: "Please fill in all fields." });
        }
        await pool.query(
            `INSERT INTO users (username, email, password_hash, role_id, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [username, email, password, role_id]
        );
        res.json({ success: true, message: "User account created successfully." });
    } catch (err) {
        console.error("Create user error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "A user with this email already exists." });
        }
        res.status(500).json({ success: false, error: err.message });
    }
};

// 13. Create a new default role
exports.createRole = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: "Role name is required." });
        }
        await pool.query(
            "INSERT INTO roles (name, description, created_at) VALUES ($1, $2, NOW())",
            [name, description || null]
        );
        res.json({ success: true, message: "Role created successfully." });
    } catch (err) {
        console.error("Create role error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "A role with this name already exists." });
        }
        res.status(500).json({ success: false, error: err.message });
    }
};