require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const pool = require("./config/db");

const authRouter = require("./routes/auth.routes");
const dashboardRouter = require("./routes/dashboard.routes");
const customerRouter = require("./routes/customer.routes");
const vehicleRouter = require("./routes/vehicle.routes");
const requestRouter = require("./routes/serviceRequest.routes");
const serviceRouter = require("./routes/service.routes");
const ledgerRouter = require("./routes/ledger.routes");
const receiptRouter = require("./routes/receipt.routes");
const portalRouter = require("./routes/portal.routes");
const adminRouter = require("./routes/admin.routes");
const webhookRouter = require("./routes/webhook.routes");

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";

// Trust reverse proxy (required for Render, Railway, etc.)
if (isProd) app.set("trust proxy", 1);

// CORS setup to share cookies with our React App
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. Postman, mobile apps) or from localhost / Vercel subdomains / configured FRONTEND_URL
            if (
                !origin ||
                origin.includes("localhost") ||
                origin.endsWith(".vercel.app") ||
                (process.env.FRONTEND_URL && origin.replace(/\/$/, "") === process.env.FRONTEND_URL.replace(/\/$/, ""))
            ) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked: ${origin} is not allowed`));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Webhook raw body parser middleware (must be registered BEFORE standard JSON parser)
app.use("/api/webhooks/razorpay", express.raw({ type: "application/json" }));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Middleware
app.use(
    session({
        name: "sid",
        secret: process.env.SESSION_SECRET || "rtoledgersecret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: isProd,                        // HTTPS only in production
            httpOnly: true,                        // Prevent client-side JS from reading cookie
            sameSite: isProd ? "none" : "lax",    // "none" required for cross-origin cookies
            maxAge: 24 * 60 * 60 * 1000,          // 24 hours
        },
    })
);

// Mount our auth router under the "/api/auth" prefix
app.use("/api/auth", authRouter);

// Dashboard router for all dashboard-related operations
app.use("/api/dashboard", dashboardRouter);
app.use("/api/portal", portalRouter);
app.use("/api/customers", customerRouter);
app.use("/api/vehicles", vehicleRouter);
app.use("/api/requests", requestRouter);
app.use("/api/services", serviceRouter);
app.use("/api/ledgers", ledgerRouter);
app.use("/api/receipts", receiptRouter);
app.use("/api/admin", adminRouter);
app.use("/api/webhooks", webhookRouter);

// Base route to check if server is working

app.get("/", (req, res) => {
    res.json({ message: "RTO Ledger System Backend API is active!" });
});

// Start listening
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`)
});