const express = require("express");
const router = express.Router();
const ledgerController = require("../controllers/ledger.controller");
const { isLoggedIn, hasPermission } = require("../middleware/auth");

router.get("/", isLoggedIn, hasPermission('ledger.view'), ledgerController.getLedgers);
router.post("/payment", isLoggedIn, hasPermission('ledger.create'), ledgerController.recordPayment);

module.exports = router;