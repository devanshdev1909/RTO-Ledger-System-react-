const pool = require("../config/db");

class PaymentSettings {
    static async getSettings() {
        const res = await pool.query("SELECT * FROM payment_settings LIMIT 1");
        return res.rows[0];
    }

    static async updateSettings(keyId, keySecret, onlineEnabled, bankTransferEnabled) {
        const res = await pool.query(
            `UPDATE payment_settings
             SET razorpay_key_id = $1, razorpay_key_secret = $2, online_enabled = $3, bank_transfer_enabled = $4, updated_at = NOW()
             WHERE id = (SELECT id FROM payment_settings LIMIT 1) RETURNING *`,
            [keyId, keySecret, onlineEnabled, bankTransferEnabled]
        );
        return res.rows[0];
    }
}

module.exports = PaymentSettings;