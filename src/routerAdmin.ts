import express from "express";
import adminController from "./controllers/admin.controller";
import venueController from "./controllers/venue.controller";
import bookingController from "./controllers/booking.controller";
import messageController from "./controllers/message.controller";
import { uploadVenueImages } from "./libs/utils/multer";
import { rateLimit } from "./libs/utils/rateLimit";

const router = express.Router();

const adminAuthLimiter = rateLimit(50, 15 * 60 * 1000);

router.post("/signup", adminAuthLimiter, adminController.adminSignup);
router.post("/login", adminAuthLimiter, adminController.adminLogin);
router.post("/logout", adminController.verifyAdmin, adminController.adminLogout);

/** DASHBOARD **/
router.get("/dashboard", adminController.verifyAdmin, adminController.getDashboard);

/** USERS **/
router.get("/users", adminController.verifyAdmin, adminController.getAllUsers);
router.post("/users/status", adminController.verifyAdmin, adminController.updateUserStatus);

/** VENUES **/
router.get("/venues", adminController.verifyAdmin, venueController.getAllVenues);
router.post("/venues/create", adminController.verifyAdmin, uploadVenueImages.array("venueImages", 5), venueController.createNewVenue);
router.post("/venues/:id/status", adminController.verifyAdmin, venueController.setVenueStatus);
router.post("/venues/update/:id", adminController.verifyAdmin, uploadVenueImages.array("venueImages", 5), venueController.updateChosenVenue);

/** BOOKINGS **/
router.get("/bookings", adminController.verifyAdmin, bookingController.getAllBookings);
router.delete("/bookings/:id", adminController.verifyAdmin, bookingController.deleteBooking);

/** MESSAGES (contact form inbox) **/
router.get("/messages", adminController.verifyAdmin, messageController.getMessages);
router.post("/messages/read-all", adminController.verifyAdmin, messageController.markAllMessagesRead);
router.post("/messages/:id/read", adminController.verifyAdmin, messageController.markMessageRead);

export default router;