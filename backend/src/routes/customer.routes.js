const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");
const { isLoggedIn, hasPermission } = require("../middleware/auth");

// GET all customers (Staff read access): GET /api/customers
router.get("/", isLoggedIn, customerController.getCustomers);

// GET dropdown list: GET /api/customers/dropdown
router.get("/dropdown", isLoggedIn, customerController.getCustomersDropdown);

router.get("/agents", isLoggedIn, customerController.getAgentsList);

// GET single customer detailed profile (vehicles, requests, transactions): GET /api/customers/:id/profile
router.get("/:id/profile", isLoggedIn, customerController.getCustomerProfile);

// GET single customer by ID: GET /api/customers/:id
router.get("/:id", isLoggedIn, customerController.getCustomerById);

// POST new customer (requires customer.create permission): POST /api/customers
router.post("/", isLoggedIn, hasPermission('customer.create'), customerController.createCustomer);

// PUT update customer details: PUT /api/customers/:id
router.put("/:id", isLoggedIn, hasPermission('customer.edit'), customerController.updateCustomer);

// PATCH toggle customer active status: PATCH /api/customers/:id/status
router.patch("/:id/status", isLoggedIn, hasPermission('customer.edit'), customerController.toggleCustomerStatus);

// DELETE customer account (Admin only): DELETE /api/customers/:id
router.delete("/:id", isLoggedIn, hasPermission('customer.edit'), customerController.deleteCustomer);


module.exports = router;
