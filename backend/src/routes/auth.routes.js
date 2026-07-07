const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// Route for Staff Login: POST /api/auth/login
router.post("/login", authController.login);

// Route for checking the active login session: GET /api/auth/me
router.get("/me", authController.getMe);

// Unified logout for both Staff and Customers: POST /api/auth/logout
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: "Logout failed" });
        }
        res.clearCookie("sid"); // Clear the "sid" cookie from the user's browser
        res.json({ success: true, message: "Logged out successfully" });
    });
});

module.exports = router;
