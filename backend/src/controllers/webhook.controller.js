const crypto = require("crypto");
const pool = require("../config/db");
const Ledger = require("../models/Ledger");
const mailer = require("../utils/mailer");

exports.handleRazorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
        return res.status(400).json({ success: false, error: "Signature header missing" });
    }

    try {
        // 1. Verify signature on raw request body
        const rawBody = req.body.toString();
        const expectedSignature = crypto
            .createHmac("sha256", secret || "")
            .update(rawBody)
            .digest("hex");

        if (expectedSignature !== signature) {
            console.error("Webhook signature verification failed.");
            return res.status(400).json({ success: false, error: "Invalid signature" });
        }

        // 2. Parse the verified payload
        const payload = JSON.parse(rawBody);
        const event = payload.event;
        console.log(`Razorpay webhook verified. Event: ${event}`);

        // 3. Process 'payment.captured' event
        if (event === 'payment.captured') {
            const payment = payload.payload.payment.entity;
            const notes = payment.notes || {};
            const ledgerId = notes.ledger_id;
            
            // Convert amount from paise to rupees
            const amountReceived = parseFloat(payment.amount) / 100;
            const paymentMode = payment.method === 'upi' ? 'UPI' : payment.method === 'card' ? 'Card' : payment.method === 'netbanking' ? 'Bank Transfer' : 'UPI';
            const transactionRef = payment.acquirer_data?.rrn || payment.acquirer_data?.bank_transaction_id || payment.id;

            if (!ledgerId) {
                console.warn("payment.captured received but no ledger_id in metadata notes.");
                return res.json({ success: true, message: "Ignored: no ledger_id metadata" });
            }

            const client = await pool.connect();
            try {
                await client.query("BEGIN");

                // Check if payment was already recorded (double trigger guard)
                const checkReceipt = await client.query(
                    "SELECT 1 FROM receipts WHERE transaction_reference = $1",
                    [payment.id]
                );
                if (checkReceipt.rows.length > 0) {
                    console.log(`Payment ${payment.id} already processed. Skipping...`);
                    await client.query("COMMIT");
                    return res.json({ success: true, message: "Already processed" });
                }

                // Fetch ledger to calculate updated totals
                const ledgerQuery = await client.query(
                    "SELECT service_fee, amount_paid, due_amount, customer_id FROM ledgers WHERE id = $1",
                    [ledgerId]
                );
                if (ledgerQuery.rows.length === 0) {
                    console.error(`Ledger record ${ledgerId} not found for webhook processing.`);
                    await client.query("ROLLBACK");
                    return res.status(404).json({ success: false, error: "Ledger not found" });
                }

                const ledger = ledgerQuery.rows[0];
                const newPaidTotal = parseFloat(ledger.amount_paid) + amountReceived;
                const newStatus = newPaidTotal >= parseFloat(ledger.service_fee) ? 'Paid' : 'Partial';

                // Update ledger
                await Ledger.updatePayment(ledgerId, newPaidTotal, newStatus, client);

                // Insert receipt
                const receiptNo = 'REC-' + Date.now();
                await client.query(`
                    INSERT INTO receipts (receipt_no, ledger_id, amount_received, payment_mode, transaction_reference, received_by, remarks, received_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                `, [
                    receiptNo, 
                    ledgerId, 
                    amountReceived, 
                    paymentMode, 
                    payment.id, // Use Razorpay Payment ID as transaction ref
                    null, // NULL indicates online automated receipt
                    `Online Payment via Razorpay (Ref: ${transactionRef})`
                ]);

                await client.query("COMMIT");
                console.log(`Successfully recorded Razorpay payment of ₹${amountReceived} for ledger ${ledgerId}.`);

                // Send email receipt confirmation
                try {
                    const detailsQuery = await pool.query(`
                        SELECT c.name, c.email, sr.request_no, s.service_name 
                        FROM ledgers l
                        LEFT JOIN customers c ON l.customer_id = c.id
                        LEFT JOIN service_requests sr ON l.service_request_id = sr.id
                        LEFT JOIN services s ON sr.service_id = s.id
                        WHERE l.id = $1
                    `, [ledgerId]);

                    const details = detailsQuery.rows[0];
                    if (details && details.email) {
                        const receiptDetails = {
                            receipt_no: receiptNo,
                            amount: amountReceived,
                            payment_mode: paymentMode,
                            remarks: `Online Payment via Razorpay (Ref: ${transactionRef})`,
                            request_no: details.request_no,
                            service_name: details.service_name
                        };
                        mailer.sendReceiptEmail(details.email, details.name, receiptDetails);
                    }
                } catch (mailErr) {
                    console.error("Failed to send online payment email receipt:", mailErr);
                }

            } catch (err) {
                await client.query("ROLLBACK");
                throw err;
            } finally {
                client.release();
            }
        }

        res.json({ success: true, message: "Webhook processed successfully" });
    } catch (err) {
        console.error("Webhook processing error:", err);
        res.status(500).json({ success: false, error: "Internal processing error" });
    }
};
