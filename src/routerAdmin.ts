import express from "express";
import userController from "./controllers/user.controller";
import venueController from "./controllers/venue.controller";
import bookingController from "./controllers/booking.controller";
import { uploadVenueImages } from "./libs/utils/multer";

const router = express.Router();

router.post("/signup", userController.adminSignup);
router.post("/login", userController.adminLogin);
router.post("/logout", userController.verifyAdmin, userController.adminLogout);

/** USERS **/
router.get("/users", userController.verifyAdmin, userController.getAllUsers);
router.post("/users/status", userController.verifyAdmin, userController.updateUserStatus);

/** VENUES **/
router.get("/venues", userController.verifyAdmin, venueController.getAllVenues);
router.post("/venues/create", userController.verifyAdmin, uploadVenueImages.array("venueImages", 5), venueController.createNewVenue);
router.post("/venues/update/:id", userController.verifyAdmin, venueController.updateChosenVenue);


/** BOOKINGS **/
router.get("/bookings", userController.verifyAdmin, bookingController.getAllBookings);
router.delete("/bookings/:id", userController.verifyAdmin, bookingController.deleteBooking);

export default router;