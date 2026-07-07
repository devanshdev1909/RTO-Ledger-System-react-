const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");

// Webhook receiver endpoint
router.post("/razorpay", webhookController.handleRazorpayWebhook);

module.exports = router;
