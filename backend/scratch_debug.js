require('dotenv').config();
const pool = require('./src/config/db');

async function checkUsers() {
    try {
        const res = await pool.query("SELECT id, username, email, password_hash, is_active FROM users");
        console.log("Users in DB:", res.rows);
    } catch (err) {
        console.error("Error querying users:", err);
    } finally {
        process.exit();
    }
}

checkUsers();
