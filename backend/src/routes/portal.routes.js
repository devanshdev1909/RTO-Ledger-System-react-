const express = require("express");
const router = express.Router();
const customerAuthController = require("../controllers/customerAuth.controller");
const { isCustomerLoggedIn } = require("../middleware/auth");

// Public Auth routes
router.post("/register", customerAuthController.postRegister);
router.post("/activate", customerAuthController.postActivateAccount);
router.post("/login", customerAuthController.postLogin);

// Protected Customer data routes
router.get("/vehicles", isCustomerLoggedIn, customerAuthController.getPortalVehicles);
router.get("/requests", isCustomerLoggedIn, customerAuthController.getPortalRequests);
router.get("/ledger", isCustomerLoggedIn, customerAuthController.getPortalLedger);
router.get("/receipts", isCustomerLoggedIn, customerAuthController.getPortalReceipts);
router.get("/profile", isCustomerLoggedIn, customerAuthController.getPortalProfile);
router.post("/payments/create-order", isCustomerLoggedIn, customerAuthController.createRazorpayOrder);
router.post("/payments/verify-payment", isCustomerLoggedIn, customerAuthController.verifyRazorpayPayment);

module.exports = router;
