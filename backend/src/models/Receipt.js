const pool = require("../config/db");

class Receipt {
    // 1. Generate sequential receipt number (e.g. REC-00001)
    static async getNextReceiptNo(client) {
        const dbClient = client || pool;
        const result = await dbClient.query("SELECT receipt_no FROM receipts WHERE receipt_no LIKE 'REC-%'");
        let maxNum = 0;
        result.rows.forEach(row => {
            const match = row.receipt_no.match(/^REC-(\d+)$/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
        });
        return `REC-${String(maxNum + 1).padStart(5, '0')}`;
    }

    // 2. Create a receipt
    static async create(receiptNo, ledgerId, customerId, amount, paymentMode, remarks, createdBy, client) {
        const dbClient = client || pool;
        const result = await dbClient.query(
            `INSERT INTO receipts (receipt_no, ledger_id, amount_received, payment_mode, remarks, received_by, received_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id`,
            [receiptNo, ledgerId, amount, paymentMode, remarks, createdBy]
        );
        return result.rows[0];
    }
}

module.exports = Receipt;