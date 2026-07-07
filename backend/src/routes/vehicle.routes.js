const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicle.controller");
const { isLoggedIn, hasPermission } = require("../middleware/auth");

router.get("/", isLoggedIn, vehicleController.getVehicles);
router.get("/customer/:customerId", isLoggedIn, vehicleController.getVehiclesByCustomer);
router.get("/:id", isLoggedIn, vehicleController.getVehicleById);
router.post("/", isLoggedIn, hasPermission('vehicle.create'), vehicleController.createVehicle);
router.put("/:id", isLoggedIn, hasPermission('vehicle.edit'), vehicleController.updateVehicle);
router.patch("/:id/status", isLoggedIn, hasPermission('vehicle.edit'), vehicleController.toggleVehicleStatus);
router.delete("/:id", isLoggedIn, hasPermission('vehicle.edit'), vehicleController.deleteVehicle);

module.exports = router;