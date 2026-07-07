const pool = require("../config/db");

class ServiceRequest {
    // 1. Get status summaries for customer dashboard
    static async getStatusCountsByCustomerId(customerId) {
        const result = await pool.query(
            "SELECT status, COUNT(*) FROM service_requests WHERE customer_id = $1 GROUP BY status", 
            [customerId]
        );
        return result.rows;
    }

    // 2. Fetch requests for a customer
    static async getByCustomerId(customerId, limit = null, offset = null) {
        let query = `
            SELECT sr.*, v.vehicle_number, s.service_name
            FROM service_requests sr
            JOIN vehicles v ON sr.vehicle_id = v.id
            JOIN services s ON sr.service_id = s.id
            WHERE sr.customer_id = $1
            ORDER BY sr.created_at DESC
        `;
        const params = [customerId];
        if (limit !== null && offset !== null) {
            query += " LIMIT $2 OFFSET $3";
            params.push(limit, offset);
        }
        const result = await pool.query(query, params);
        return result.rows;
    }

    // 3. Count total customer requests
    static async getCountByCustomerId(customerId) {
        const result = await pool.query("SELECT COUNT(*) FROM service_requests WHERE customer_id = $1", [customerId]);
        return parseInt(result.rows[0].count, 10);
    }

    // 4. Create new service request
    static async create(customerId, vehicleId, serviceId, amount, remarks, status = 'Pending', client) {
        const dbClient = client || pool;
        const requestNo = 'REQ-' + Date.now();
        const result = await dbClient.query(
            `INSERT INTO service_requests (request_no, customer_id, vehicle_id, service_id, amount, status, remarks, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, request_no`,
            [requestNo, customerId, vehicleId, serviceId, amount, status, remarks]
        );
        return result.rows[0];
    }

    // 5. Update service request status
    static async updateStatus(id, status, client) {
        const dbClient = client || pool;
        await dbClient.query("UPDATE service_requests SET status = $1 WHERE id = $2", [status, id]);
    }
}

module.exports = ServiceRequest;