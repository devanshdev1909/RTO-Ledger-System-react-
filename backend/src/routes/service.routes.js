const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/service.controller");
const { isLoggedIn, hasPermission } = require("../middleware/auth");

router.get("/", isLoggedIn, serviceController.getServices);
router.post("/", isLoggedIn, hasPermission('service_catalog.create'), serviceController.createService);
router.put("/:id", isLoggedIn, hasPermission('service_catalog.edit'), serviceController.updateService);
router.patch("/:id/status", isLoggedIn, hasPermission('service_catalog.edit'), serviceController.toggleServiceStatus);
router.delete("/:id", isLoggedIn, hasPermission('service_catalog.edit'), serviceController.deleteService);

module.exports = router;