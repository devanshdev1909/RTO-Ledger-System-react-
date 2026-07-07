const Service = require("../models/Service");

exports.getServices = async (req, res) => {
    try {
        const services = await Service.getAll();
        res.json({ success: true, services });
    } catch (err) {
        console.error("Get services catalog error:", err);
        res.status(500).json({ success: false, error: "Failed to load services catalog." });
    }
};

exports.createService = async (req, res) => {
    try {
        const { service_name, default_fee, description } = req.body;
        if (!service_name || !default_fee) {
            return res.status(400).json({ success: false, error: "Service Name and Base Fee are required." });
        }
        const newService = await Service.create(service_name, default_fee, description);
        res.status(201).json({ success: true, message: "Service created successfully.", service: newService });
    } catch (err) {
        console.error("Create service error:", err);
        if (err.code === "23505") {
            return res.status(400).json({ success: false, error: "A service with this name already exists." });
        }
        res.status(500).json({ success: false, error: "Failed to create service." });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { service_name, default_fee, description } = req.body;
        if (!service_name || !default_fee) {
            return res.status(400).json({ success: false, error: "Service Name and Base Fee are required." });
        }
        const updated = await Service.update(id, service_name, default_fee, description);
        res.json({ success: true, message: "Service updated successfully.", service: updated });
    } catch (err) {
        console.error("Update service error:", err);
        res.status(500).json({ success: false, error: "Failed to update service." });
    }
};

exports.toggleServiceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const updated = await Service.toggleStatus(id, is_active);
        res.json({ success: true, message: `Service is now ${is_active ? 'Active' : 'Inactive'}.`, service: updated });
    } catch (err) {
        console.error("Toggle service status error:", err);
        res.status(500).json({ success: false, error: "Failed to update service status." });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        await Service.delete(id);
        res.json({ success: true, message: "Service deleted successfully." });
    } catch (err) {
        console.error("Delete service error:", err);
        res.status(500).json({ success: false, error: "Cannot delete service. It may be active in existing service requests or ledgers." });
    }
};