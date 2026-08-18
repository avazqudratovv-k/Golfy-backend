import express from "express";
import adminController from "./controllers/admin.controller";
import venueController from "./controllers/venue.controller";
import bookingController from "./controllers/booking.controller";
import { uploadVenueImages } from "./libs/utils/multer";

const router = express.Router();

router.post("/signup", adminController.adminSignup);
router.post("/login", adminController.adminLogin);
router.post("/logout", adminController.verifyAdmin, adminController.adminLogout);

/** USERS **/
router.get("/users", adminController.verifyAdmin, adminController.getAllUsers);
router.post("/users/status", adminController.verifyAdmin, adminController.updateUserStatus);

/** VENUES **/
router.get("/venues", adminController.verifyAdmin, venueController.getAllVenues);
router.post("/venues/create", adminController.verifyAdmin, uploadVenueImages.array("venueImages", 5), venueController.createNewVenue);
router.post("/venues/update/:id", adminController.verifyAdmin, venueController.updateChosenVenue);

/** BOOKINGS **/
router.get("/bookings", adminController.verifyAdmin, bookingController.getAllBookings);
router.delete("/bookings/:id", adminController.verifyAdmin, bookingController.deleteBooking);

export default router;