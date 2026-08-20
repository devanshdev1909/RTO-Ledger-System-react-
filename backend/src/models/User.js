const pool = require("../config/db");

class User {
    // 1. Create a new staff user (Admin view)
    static async create(username, email, passwordHash, roleId) {
        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash, role_id, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *",
            [username, email, passwordHash, roleId]
        );
        return result.rows[0];
    }

    // 2. Find user by email (Used during Staff Login)
    static async findByEmail(email) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const result = await pool.query(
            `
            SELECT u.*, r.name AS role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE LOWER(TRIM(u.email)) = $1
            `,
            [cleanEmail]
        );
        return result.rows[0];
    }

    // 3. Find user by ID (Used to reload logged-in session)
    static async findById(id) {
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        return result.rows[0];
    }

    // 4. Get list of all staff members (excluding Admins, for list views)
    static async getAllWithRoles(limit = null, offset = null) {
        let query = `
            SELECT u.*, r.name AS role_name 
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE r.name != 'Admin' OR r.name IS NULL
            ORDER BY u.created_at DESC
        `;
        const params = [];
        if (limit !== null && offset !== null) {
            query += " LIMIT $1 OFFSET $2";
            params.push(limit, offset);
        }
        const result = await pool.query(query, params);
        return result.rows;
    }

    // 5. Count total staff members
    static async getCount() {
        const result = await pool.query(`
            SELECT COUNT(*) 
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE r.name != 'Admin' OR r.name IS NULL
        `);
        return parseInt(result.rows[0].count, 10);
    }

    // 6. Update staff profile details
    static async update(id, roleId, username, email, mobile, passwordHash, isActive) {
        let query = `
            UPDATE users 
            SET role_id = $1, username = $2, email = $3, mobile = $4, is_active = $5, updated_at = NOW()
        `;
        const params = [roleId, username, email, mobile, isActive];
        let paramIndex = 6;

        if (passwordHash) {
            query += `, password_hash = $${paramIndex}`;
            params.push(passwordHash);
            paramIndex++;
        }

        query += ` WHERE id = $${paramIndex} RETURNING *`;
        params.push(id);

        const result = await pool.query(query, params);
        return result.rows[0];
    }

    // 7. Delete a staff member
    static async delete(id) {
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
    }

    // 8. Fetch specific permissions for a user
    static async getUserPermissions(userId) {
        const result = await pool.query(
            "SELECT permission_id FROM user_permissions WHERE user_id = $1", 
            [userId]
        );
        return result.rows;
    }

    // 9. Assign specific permissions to a user
    static async assignPermissions(userId, permissions, client) {
        const dbClient = client || pool;
        for (const p of permissions) {
            await dbClient.query(
                "INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2)",
                [userId, p]
            );
        }
    }

    // 10. Clear permissions for a user
    static async clearPermissions(userId, client) {
        const dbClient = client || pool;
        await dbClient.query("DELETE FROM user_permissions WHERE user_id = $1", [userId]);
    }

    // 11. Check if email/username already exists
    static async checkUserExists(username, email) {
        const result = await pool.query(
            "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1", 
            [username, email]
        );
        return result.rows.length > 0;
    }
}

module.exports = User;