const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const { isLoggedIn, hasPermission } = require("../middleware/auth");

// Route to fetch stats: GET /api/dashboard
router.get("/", isLoggedIn, dashboardController.getDashboard);

// Route to process quick add: POST /api/dashboard/quick-add (requires ledger.create permission)
router.post("/quick-add", isLoggedIn, hasPermission('ledger.create'), dashboardController.postQuickAdd);

module.exports = router;