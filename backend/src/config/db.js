const { Pool } = require("pg");

// Create a connection pool using the DATABASE_URL environment variable
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Required for Neon PostgreSQL SSL connections
    },
});

// Test database connection on startup
pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("Database connection failed ❌:", err.message);
    }
    else {
        console.log("Database connected successfully!  Central Time ⏰:", res.rows[0].now);
    }
});

module.exports = pool;

