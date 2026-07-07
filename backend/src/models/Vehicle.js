const pool = require("../config/db");

class Vehicle {
    // 1. Get all vehicles (with customer names joined)
    static async getAll(limit = null, offset = null) {
        let query = `
            SELECT v.*, c.name AS customer_name
            FROM vehicles v
            LEFT JOIN customers c ON v.customer_id = c.id
            ORDER BY v.created_at DESC
        `;
        const params = [];
        if (limit !== null && offset !== null) {
            query += " LIMIT $1 OFFSET $2";
            params.push(limit, offset);
        }
        const result = await pool.query(query, params);
        return result.rows;
    }

    // 2. Count total vehicles
    static async getCount() {
        const result = await pool.query("SELECT COUNT(*) FROM vehicles");
        return parseInt(result.rows[0].count, 10);
    }

    // 3. Find vehicle by ID
    static async getById(id) {
        const result = await pool.query("SELECT * FROM vehicles WHERE id = $1", [id]);
        return result.rows[0];
    }

    // 4. Create new vehicle (supports transactions with optional client)
    static async create(customerId, vehicleNumber, vehicleType, chassisNumber, engineNumber, registrationDate, driverName, driverMobile, client) {
        const dbClient = client || pool;
        const result = await dbClient.query(
            `INSERT INTO vehicles (customer_id, vehicle_number, vehicle_type, chassis_number, engine_number, registration_date, driver_name, driver_mobile, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
            [customerId, vehicleNumber, vehicleType, chassisNumber, engineNumber, registrationDate, driverName, driverMobile]
        );
        return result.rows[0];
    }

    // 5. Update vehicle details
    static async update(id, customerId, vehicleNumber, vehicleType, chassisNumber, engineNumber, registrationDate, driverName, driverMobile) {
        const result = await pool.query(
            `UPDATE vehicles SET
                customer_id = $1, vehicle_number = $2, vehicle_type = $3,
                chassis_number = $4, engine_number = $5, registration_date = $6,
                driver_name = $7, driver_mobile = $8
             WHERE id = $9 RETURNING *`,
            [customerId, vehicleNumber, vehicleType, chassisNumber, engineNumber, registrationDate, driverName, driverMobile, id]
        );
        return result.rows[0];
    }

    // 6. Delete a vehicle
    static async delete(id) {
        await pool.query("DELETE FROM vehicles WHERE id = $1", [id]);
    }

    // 7. Activate / deactivate a vehicle
    static async toggleStatus(id, isActive) {
        const result = await pool.query(
            "UPDATE vehicles SET is_active = $1 WHERE id = $2 RETURNING *",
            [isActive, id]
        );
        return result.rows[0];
    }

    // 8. Count vehicles belonging to a specific customer
    static async countByCustomerId(customerId) {
        const result = await pool.query("SELECT COUNT(*) FROM vehicles WHERE customer_id = $1", [customerId]);
        return parseInt(result.rows[0].count, 10);
    }

    // 9. Get all vehicles belonging to a specific customer
    static async getByCustomerId(customerId, limit = null, offset = null) {
        let query = "SELECT * FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC";
        const params = [customerId];
        if (limit !== null && offset !== null) {
            query += " LIMIT $2 OFFSET $3";
            params.push(limit, offset);
        }
        const result = await pool.query(query, params);
        return result.rows;
    }
}

module.exports = Vehicle;