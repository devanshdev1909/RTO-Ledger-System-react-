const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { isLoggedIn } = require("../middleware/auth");

// Custom Admin guard: checks if user has 'Admin' role in active session
const isAdmin = (req, res, next) => {
    if (req.session.userRole !== 'Admin') {
        return res.status(403).json({ error: "Forbidden. Admin access required." });
    }
    next();
};

// Protect all routes inside this file
router.use(isLoggedIn, isAdmin);

// Users Custom overrides endpoints
router.get("/users", adminController.getUsers);
router.get("/permissions", adminController.getPermissions);
router.get("/users/:id/permissions", adminController.getUserPermissions);
router.post("/users/:id/permissions", adminController.saveUserPermissions);

// Roles defaults endpoints
router.get("/roles", adminController.getRoles);
router.get("/roles/:id/permissions", adminController.getRolePermissions);
router.post("/roles/:id/permissions", adminController.saveRolePermissions);

// Agent Allotments endpoints
router.get("/agents/allotments", adminController.getAgentAllotments);
router.get("/unassigned-customers", adminController.getUnassignedCustomers);
router.post("/agents/allot", adminController.allotCustomer);
router.post("/agents/unallot", adminController.unallotCustomer);
router.post("/users", adminController.createUser);
router.post("/roles", adminController.createRole);

module.exports = router;