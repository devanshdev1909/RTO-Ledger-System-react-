const bcrypt = require("bcryptjs");
const Customer = require("../models/Customer");
const pool = require("../config/db");
const crypto = require("crypto");
const Ledger = require("../models/Ledger");

// 1. Customer Self-Registration
exports.postRegister = async (req, res) => {
  const { name, mobile, email, password, confirm_password } = req.body;

  // Basic validations
  if (!name || !mobile || !password) {
    return res.status(400).json({ success: false, error: "Please fill in all required fields." });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ success: false, error: "Passwords do not match." });
  }
  if (!/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({ success: false, error: "Please enter a valid 10-digit mobile number." });
  }

  try {
    // Encrypt the password (10 rounds of salt hashing)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Auto-generate the sequential customer code (e.g. CUST-004)
    const customerCode = await Customer.getNextCustomerCode();

    // Create the customer row in the database
    const customer = await Customer.create(
      customerCode,
      name,
      mobile,
      email || null,
      hashedPassword
    );

    // Optional: Send Welcome Email (Original project utilized a mailer utility. 
    // We will build the mailer utility in a later step. For now, we log it.)
    console.log(`[Email Alert] Welcome email queued for ${email || 'No Email'} (Code: ${customerCode})`);

    res.json({ success: true, message: "Registration successful! Please log in." });
  } catch (err) {
    console.error("Registration error:", err.message);
    // Postgres Unique Constraint Violation code (23505) - e.g. duplicate mobile number
    if (err.code === "23505") {
      return res.status(400).json({ success: false, error: "An account with this mobile number or email already exists." });
    }
    res.status(500).json({ success: false, error: "Registration failed: " + err.message });
  }
};

// 2. Customer Account Activation (For staff-added customers setting their password for the first time)
exports.postActivateAccount = async (req, res) => {
  const { identifier, password, confirm_password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: "Please fill in all required fields." });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ success: false, error: "Passwords do not match." });
  }

  try {
    // Look up the customer in the database by their mobile or email identifier
    const customer = await Customer.findByIdentifier(identifier);

    if (!customer) {
      return res.status(404).json({ success: false, error: "No account found with this email or mobile number." });
    }
    if (customer.password) {
      return res.status(400).json({ success: false, error: "Account is already active. Please log in." });
    }

    // Encrypt the new password and set it
    const hashedPassword = await bcrypt.hash(password, 10);
    await Customer.setPassword(customer.id, hashedPassword);

    console.log(`[Email Alert] Activation email queued for ${customer.email || 'No Email'}`);

    // Automatically establish a session upon successful activation
    req.session.customerId = customer.id;
    req.session.customerName = customer.name;

    res.json({
      success: true,
      message: "Account activated successfully!",
      customer: { id: customer.id, name: customer.name }
    });
  } catch (err) {
    console.error("Activation failed:", err);
    res.status(500).json({ success: false, error: "Failed to activate account. Please try again." });
  }
};

// 3. Customer Portal Login
exports.postLogin = async (req, res) => {
  const { identifier, password } = req.body; // identifier can be mobile or email
  try {
    const customer = await Customer.findByIdentifier(identifier);
    if (!customer) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    
    // Check if account has set a password (must be activated)
    if (!customer.password) {
      return res.status(400).json({ success: false, error: "Please activate your account to set a password first." });
    }

    // Compare submitted password with the encrypted bcrypt password
    const isMatch = await bcrypt.compare(password, customer.password);
    if (isMatch) {
      // Save customer details in the session cookie
      req.session.customerId = customer.id;
      req.session.customerName = customer.name;
      res.json({
        success: true,
        customer: { id: customer.id, name: customer.name }
      });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Customer login error:", err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
};

// 4. Fetch vehicles belonging to the logged-in customer
exports.getPortalVehicles = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC",
      [req.session.customerId]
    );
    res.json({ success: true, vehicles: result.rows });
  } catch (err) {
    console.error("Portal vehicles error:", err);
    res.status(500).json({ success: false, error: "Failed to load vehicles." });
  }
};

// 5. Fetch service requests belonging to the logged-in customer
exports.getPortalRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sr.*, s.service_name, v.vehicle_number 
      FROM service_requests sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      WHERE sr.customer_id = $1
      ORDER BY sr.created_at DESC
    `, [req.session.customerId]);
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error("Portal requests error:", err);
    res.status(500).json({ success: false, error: "Failed to load requests." });
  }
};

// 6. Fetch ledger statements belonging to the logged-in customer
exports.getPortalLedger = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, v.vehicle_number, sr.request_no, s.service_name 
      FROM ledgers l
      LEFT JOIN vehicles v ON l.vehicle_id = v.id
      LEFT JOIN service_requests sr ON l.service_request_id = sr.id
      LEFT JOIN services s ON sr.service_id = s.id
      WHERE l.customer_id = $1
      ORDER BY l.created_at DESC
    `, [req.session.customerId]);
    res.json({ success: true, ledger: result.rows });
  } catch (err) {
    console.error("Portal ledger error:", err);
    res.status(500).json({ success: false, error: "Failed to load financial ledger." });
  }
};

// 7. Fetch receipts logged for the logged-in customer
exports.getPortalReceipts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, sr.request_no, s.service_name, v.vehicle_number
      FROM receipts r
      LEFT JOIN ledgers l ON r.ledger_id = l.id
      LEFT JOIN service_requests sr ON l.service_request_id = sr.id
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN vehicles v ON l.vehicle_id = v.id
      WHERE l.customer_id = $1
      ORDER BY r.received_at DESC
    `, [req.session.customerId]);
    res.json({ success: true, receipts: result.rows });
  } catch (err) {
    console.error("Portal receipts error:", err);
    res.status(500).json({ success: false, error: "Failed to load payment receipts." });
  }
};

// 4. Fetch vehicles belonging to the logged-in customer
exports.getPortalVehicles = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM vehicles WHERE customer_id = $1 ORDER BY created_at DESC",
      [req.session.customerId]
    );
    res.json({ success: true, vehicles: result.rows });
  } catch (err) {
    console.error("Portal vehicles error:", err);
    res.status(500).json({ success: false, error: "Failed to load vehicles." });
  }
};

// 5. Fetch service requests belonging to the logged-in customer
exports.getPortalRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sr.*, s.service_name, v.vehicle_number 
      FROM service_requests sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      WHERE sr.customer_id = $1
      ORDER BY sr.created_at DESC
    `, [req.session.customerId]);
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error("Portal requests error:", err);
    res.status(500).json({ success: false, error: "Failed to load requests." });
  }
};

// 6. Fetch ledger statements belonging to the logged-in customer
exports.getPortalLedger = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, v.vehicle_number, sr.request_no, s.service_name 
      FROM ledgers l
      LEFT JOIN vehicles v ON l.vehicle_id = v.id
      LEFT JOIN service_requests sr ON l.service_request_id = sr.id
      LEFT JOIN services s ON sr.service_id = s.id
      WHERE l.customer_id = $1
      ORDER BY l.created_at DESC
    `, [req.session.customerId]);
    res.json({ success: true, ledger: result.rows });
  } catch (err) {
    console.error("Portal ledger error:", err);
    res.status(500).json({ success: false, error: "Failed to load financial ledger." });
  }
};

// 7. Fetch receipts logged for the logged-in customer
exports.getPortalReceipts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, sr.request_no, s.service_name, v.vehicle_number
      FROM receipts r
      LEFT JOIN ledgers l ON r.ledger_id = l.id
      LEFT JOIN service_requests sr ON l.service_request_id = sr.id
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN vehicles v ON l.vehicle_id = v.id
      WHERE l.customer_id = $1
      ORDER BY r.received_at DESC
    `, [req.session.customerId]);
    res.json({ success: true, receipts: result.rows });
  } catch (err) {
    console.error("Portal receipts error:", err);
    res.status(500).json({ success: false, error: "Failed to load payment receipts." });
  }
};

const Razorpay = require("razorpay");

// 8. Create Razorpay Order for online customer payments
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { ledger_id, amount } = req.body;
    
    if (!ledger_id || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Valid Ledger ID and amount are required." });
    }

    // 1. Verify ledger belongs to client and check dues
    const ledgerQuery = await pool.query(
      "SELECT due_amount FROM ledgers WHERE id = $1 AND customer_id = $2",
      [ledger_id, req.session.customerId]
    );
    if (ledgerQuery.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Ledger record not found." });
    }

    const outstandingDue = parseFloat(ledgerQuery.rows[0].due_amount);
    const paymentAmount = parseFloat(amount);

    if (paymentAmount > outstandingDue) {
      return res.status(400).json({ success: false, error: `Payment amount (₹${paymentAmount}) exceeds outstanding dues (₹${outstandingDue}).` });
    }

    // 2. Initialize Razorpay Client
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // 3. Generate Order (Amount in paise)
    const options = {
      amount: Math.round(paymentAmount * 100),
      currency: "INR",
      receipt: `ledger_${ledger_id}`,
      notes: {
        ledger_id: ledger_id.toString(),
        customer_id: req.session.customerId.toString()
      }
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error("Create Razorpay Order Error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to create online payment order." });
  }
};

// 9. Fetch profile details of the logged-in customer
exports.getPortalProfile = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, customer_code, mobile, email, address FROM customers WHERE id = $1",
      [req.session.customerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Customer not found." });
    }
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    console.error("Portal profile error:", err);
    res.status(500).json({ success: false, error: "Failed to load customer profile details." });
  }
};

// 10. Verify Razorpay Payment Signature and log receipt details instantly
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, ledger_id, amount } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !ledger_id || !amount) {
      return res.status(400).json({ success: false, error: "Payment verification details are missing." });
    }

    // 1. Verify Razorpay Payment Signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret || "")
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("Payment signature verification failed.");
      return res.status(400).json({ success: false, error: "Payment verification failed. Invalid signature." });
    }

    const amountReceived = parseFloat(amount);
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");

      // Double trigger guard: Check if receipt is already logged
      const checkReceipt = await client.query(
        "SELECT 1 FROM receipts WHERE transaction_reference = $1",
        [razorpay_payment_id]
      );
      if (checkReceipt.rows.length > 0) {
        await client.query("COMMIT");
        return res.json({ success: true, message: "Payment already captured." });
      }

      // Fetch ledger
      const ledgerQuery = await client.query(
        "SELECT service_fee, amount_paid, due_amount FROM ledgers WHERE id = $1 AND customer_id = $2",
        [ledger_id, req.session.customerId]
      );
      if (ledgerQuery.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "Ledger record not found." });
      }

      const ledger = ledgerQuery.rows[0];
      const newPaidTotal = parseFloat(ledger.amount_paid) + amountReceived;
      const newStatus = newPaidTotal >= parseFloat(ledger.service_fee) ? 'Paid' : 'Partial';

      // Update Ledger
      await Ledger.updatePayment(ledger_id, newPaidTotal, newStatus, client);

      // Create Receipt
      const receiptNo = 'REC-' + Date.now();
      await client.query(`
        INSERT INTO receipts (receipt_no, ledger_id, amount_received, payment_mode, transaction_reference, received_by, remarks, received_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        receiptNo,
        ledger_id,
        amountReceived,
        'Razorpay',
        razorpay_payment_id,
        null,
        `Online Verified Payment via Razorpay (Ref: ${razorpay_payment_id})`
      ]);

      await client.query("COMMIT");
      console.log(`Successfully verified online payment of ₹${amountReceived} for ledger ${ledger_id}.`);

      // Send email confirmation in background
      try {
        const detailsQuery = await pool.query(`
          SELECT c.name, c.email, sr.request_no, s.service_name 
          FROM ledgers l
          LEFT JOIN customers c ON l.customer_id = c.id
          LEFT JOIN service_requests sr ON l.service_request_id = sr.id
          LEFT JOIN services s ON sr.service_id = s.id
          WHERE l.id = $1
        `, [ledger_id]);

        const details = detailsQuery.rows[0];
        if (details && details.email) {
          const receiptDetails = {
            receipt_no: receiptNo,
            amount: amountReceived,
            payment_mode: 'Online',
            remarks: `Online Verified Payment via Razorpay (Ref: ${razorpay_payment_id})`,
            request_no: details.request_no,
            service_name: details.service_name
          };
          const mailer = require("../utils/mailer");
          mailer.sendReceiptEmail(details.email, details.name, receiptDetails);
        }
      } catch (mailErr) {
        console.error("Failed to send email receipt:", mailErr);
      }

      res.json({ success: true, message: "Payment verified and recorded successfully." });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Verify payment controller error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to verify transaction." });
  }
};