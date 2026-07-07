require('dotenv').config();
const pool = require('./src/config/db');
const Ledger = require('./src/models/Ledger');

async function debug() {
    // Set variables as strings, matching React JSON types
    const customerId = "4";
    const vehicleId = "30";
    const serviceId = "9";
    const amount = "3400.00";
    const paid_amount = "400";
    const userId = "1"; // string type
    const remarks = "";

    console.log("Testing with string inputs:", { customerId, vehicleId, serviceId, amount, paid_amount, userId });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        
        // A. Insert Service Request
        const requestNo = 'REQ-' + Date.now();
        const requestRes = await client.query(
            `INSERT INTO service_requests (request_no, customer_id, vehicle_id, service_id, amount, status, remarks, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, request_no`,
            [requestNo, customerId, vehicleId, serviceId, amount, 'Pending', remarks || null]
        );
        const newRequest = requestRes.rows[0];
        console.log("Request created:", newRequest);
        
        // B. Insert Ledger
        const upfrontPaid = parseFloat(paid_amount) || 0;
        const ledgerStatus = upfrontPaid >= parseFloat(amount) ? 'Paid' : upfrontPaid > 0 ? 'Partial' : 'Unpaid';
        const newLedger = await Ledger.create(
            customerId, vehicleId, newRequest.id, amount, upfrontPaid, ledgerStatus, client
        );
        console.log("Ledger created:", newLedger);
        
        // C. Insert Receipt
        const receiptNo = 'REC-' + Date.now();
        const receiptRes = await client.query(`
            INSERT INTO receipts (receipt_no, ledger_id, amount_received, payment_mode, transaction_reference, received_by, remarks, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id
        `, [receiptNo, newLedger.id, upfrontPaid, 'Cash', null, userId, 'Initial request payment']);
        console.log("Receipt created:", receiptRes.rows[0]);
        
        await client.query("COMMIT");
        console.log("SUCCESS! Transaction committed with strings.");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("TRANSACTION FAILED! Exact Error details:", err);
    } finally {
        client.release();
        process.exit();
    }
}

debug();
