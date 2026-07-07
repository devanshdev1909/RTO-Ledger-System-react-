const pool = require("../config/db");

class Ledger {
    // 1. Create a ledger entry (calculated dynamically by DB)
    static async create(customerId, vehicleId, serviceRequestId, serviceFee, amountPaid, status, client) {
        const dbClient = client || pool;

        const result = await dbClient.query(`
            INSERT INTO ledgers (customer_id, vehicle_id, service_request_id, service_fee, amount_paid, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, due_amount
        `, [customerId, vehicleId, serviceRequestId, serviceFee, amountPaid, status]);
        return result.rows[0];
    }

    // 2. Fetch specific payment values
    static async getPaymentDetails(id, client) {
        const dbClient = client || pool;
        const result = await dbClient.query(
            "SELECT amount_paid, service_fee FROM ledgers WHERE id = $1", 
            [id]
        );
        return result.rows[0];
    }

    // 3. Update payment detail (recalculates due automatically)
    static async updatePayment(id, amountPaid, status, client) {
        const dbClient = client || pool;

        await dbClient.query(`
            UPDATE ledgers
            SET amount_paid = $1, status = $2
            WHERE id = $3
        `, [amountPaid, status, id]);
    }
}

module.exports = Ledger;