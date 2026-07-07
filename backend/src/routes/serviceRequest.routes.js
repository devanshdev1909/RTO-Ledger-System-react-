const express = require("express");
const router = express.Router();
const requestController = require("../controllers/serviceRequest.controller");
const { isLoggedIn, hasPermission } = require("../middleware/auth");

router.get("/", isLoggedIn, requestController.getRequests);
router.get("/services", isLoggedIn, requestController.getServices);
router.post("/create-temp-order", isLoggedIn, hasPermission('service.create'), requestController.createTempOrder);
router.post("/", isLoggedIn, hasPermission('service.create'), requestController.createRequest);
router.patch("/:id/status", isLoggedIn, hasPermission('service_request.edit'), requestController.updateRequestStatus);
router.put("/:id", isLoggedIn, hasPermission('service_request.edit'), requestController.updateRequest);
router.delete("/:id", isLoggedIn, hasPermission('service_request.edit'), requestController.deleteRequest);

module.exports = router;