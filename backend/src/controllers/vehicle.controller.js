const Vehicle = require("../models/Vehicle");
const pool = require("../config/db");

// 1. Get Vehicles list with search & pagination
exports.getVehicles = async (req, res) => {
    try {
        const search = req.query.q || "";
        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;

        const isAgent = req.session.userRole === 'Agent';
        const userId = req.session.userId;

        let query = `
            SELECT v.*, c.name AS customer_name, c.customer_code
            FROM vehicles v
            LEFT JOIN customers c ON v.customer_id = c.id
        `;
        let countQuery = `
            SELECT COUNT(*) 
            FROM vehicles v
            LEFT JOIN customers c ON v.customer_id = c.id
        `;
        const params = [];
        const countParams = [];
        const conditions = [];

        // Agent-scoped allotment filter
        if (isAgent) {
            conditions.push(`c.assigned_agent_id = $${params.length + 1}`);
            params.push(userId);
            countParams.push(userId);
        }

        if (search) {
            conditions.push(`(v.vehicle_number ILIKE $${params.length + 1} 
                OR v.chassis_number ILIKE $${params.length + 1} 
                OR v.engine_number ILIKE $${params.length + 1} 
                OR v.driver_name ILIKE $${params.length + 1} 
                OR c.name ILIKE $${params.length + 1} 
                OR c.customer_code ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            const conditionStr = " WHERE " + conditions.join(" AND ");
            query += conditionStr;
            countQuery += conditionStr;
        }

        query += " ORDER BY v.created_at DESC";

        // Add pagination limits
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Run queries parallelly
        const [listRes, countRes] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const totalVehicles = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalVehicles / limit);

        res.json({
            success: true,
            vehicles: listRes.rows,
            pagination: {
                totalVehicles,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        console.error("Fetch vehicles controller error:", err);
        res.status(500).json({ success: false, error: "Server error fetching vehicles." });
    }
};

// 2. Fetch single vehicle details
exports.getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.getById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: "Vehicle not found." });
        }
        res.json({ success: true, vehicle });
    } catch (err) {
        console.error("Get vehicle by ID error:", err);
        res.status(500).json({ success: false, error: "Server error." });
    }
};

// 3. Create a new vehicle registration
exports.createVehicle = async (req, res) => {
    try {
        const { customer_id, vehicle_number, vehicle_type, chassis_number, engine_number, registration_date, driver_name, driver_mobile } = req.body;
        
        if (!customer_id || !vehicle_number || !vehicle_type) {
            return res.status(400).json({ success: false, error: "Customer, Vehicle Number, and Vehicle Type are required." });
        }

        const newVehicle = await Vehicle.create(
            customer_id, vehicle_number.toUpperCase(), vehicle_type,
            chassis_number || null, engine_number || null, registration_date || null,
            driver_name || null, driver_mobile || null
        );

        res.status(201).json({ success: true, message: "Vehicle registered successfully.", vehicleId: newVehicle.id });
    } catch (err) {
        console.error("Create vehicle controller error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "Vehicle number is already registered." });
        }
        res.status(500).json({ success: false, error: "Failed to register vehicle." });
    }
};

// 4. Update vehicle details
exports.updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_id, vehicle_number, vehicle_type, chassis_number, engine_number, registration_date, driver_name, driver_mobile } = req.body;

        if (!customer_id || !vehicle_number || !vehicle_type) {
            return res.status(400).json({ success: false, error: "Customer, Vehicle Number, and Vehicle Type are required." });
        }

        const updated = await Vehicle.update(
            id, customer_id, vehicle_number.toUpperCase(), vehicle_type,
            chassis_number || null, engine_number || null, registration_date || null,
            driver_name || null, driver_mobile || null
        );

        res.json({ success: true, message: "Vehicle updated successfully.", vehicle: updated });
    } catch (err) {
        console.error("Update vehicle error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "Vehicle number already in use." });
        }
        res.status(500).json({ success: false, error: "Failed to update vehicle details." });
    }
};

// 5. Toggle vehicle active status
exports.toggleVehicleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const updated = await Vehicle.toggleStatus(id, is_active);
        res.json({ success: true, message: `Vehicle status set to ${is_active ? 'Active' : 'Inactive'}.`, vehicle: updated });
    } catch (err) {
        console.error("Toggle vehicle status error:", err);
        res.status(500).json({ success: false, error: "Failed to toggle status." });
    }
};

// 6. Delete a vehicle record
exports.deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        await Vehicle.delete(id);
        res.json({ success: true, message: "Vehicle record deleted successfully." });
    } catch (err) {
        console.error("Delete vehicle error:", err);
        res.status(500).json({ success: false, error: "Cannot delete vehicle. Ensure it has no active service requests or ledgers first." });
    }
};

// 7. Fetch all vehicles belonging to a specific customer (for dropdowns)
exports.getVehiclesByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const result = await pool.query(
            "SELECT id, vehicle_number, vehicle_type FROM vehicles WHERE customer_id = $1 AND is_active = true ORDER BY vehicle_number ASC",
            [customerId]
        );
        res.json({ success: true, vehicles: result.rows });
    } catch (err) {
        console.error("Vehicles by customer fetch error:", err);
        res.status(500).json({ success: false, error: "Failed to load customer vehicles." });
    }
};