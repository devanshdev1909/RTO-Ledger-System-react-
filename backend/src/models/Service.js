const pool = require("../config/db");

class Service {
    static async getActiveServices() {
        const result = await pool.query('SELECT * FROM services WHERE is_active = true ORDER BY service_name ASC');
        return result.rows;
    }

    static async getAll() {
        const result = await pool.query('SELECT * FROM services ORDER BY service_name ASC');
        return result.rows;
    }

    static async getById(id) {
        const result = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async create(serviceName, defaultFee, description) {
        const result = await pool.query(
            `INSERT INTO services (service_name, default_fee, description, is_active, created_at)
             VALUES ($1, $2, $3, true, NOW()) RETURNING *`,
            [serviceName, defaultFee, description || null]
        );
        return result.rows[0];
    }

    static async update(id, serviceName, defaultFee, description) {
        const result = await pool.query(
            `UPDATE services 
             SET service_name = $1, default_fee = $2, description = $3
             WHERE id = $4 RETURNING *`,
            [serviceName, defaultFee, description || null, id]
        );
        return result.rows[0];
    }

    static async toggleStatus(id, isActive) {
        const result = await pool.query(
            `UPDATE services SET is_active = $1 WHERE id = $2 RETURNING *`,
            [isActive, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        await pool.query('DELETE FROM services WHERE id = $1', [id]);
    }
}

module.exports = Service;