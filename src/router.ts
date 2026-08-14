import express from "express";
import userController from "./controllers/user.controller";
import venueController from "./controllers/venue.controller";
import bookingController from "./controllers/booking.controller";
import reviewController from "./controllers/review.controller";
import messageController from "./controllers/message.controller";



const router = express.Router();

router.get("/stats", venueController.getStats);
/** AUTH **/
router.post("/user/signup", userController.signup);
router.post("/user/login", userController.login);
router.post("/user/logout", userController.verifyAuth, userController.logout);

/** PROFILE **/
router.get("/user/profile", userController.verifyAuth, userController.getMyProfile);
router.post("/user/profile", userController.verifyAuth, userController.updateMyProfile);

/** VENUES **/
router.get("/venue/all", venueController.getVenues);
router.get("/venue/top", venueController.getTopVenues);
router.get("/stats", venueController.getStats);
router.get("/venue/:id", venueController.getVenue);


/** BOOKINGS **/
router.post("/booking/create", userController.verifyAuth, bookingController.createBooking);
router.get("/booking/my", userController.verifyAuth, bookingController.getMyBookings);
router.post("/booking/update", userController.verifyAuth, bookingController.updateBooking);


/** REVIEWS **/
router.post("/review/create", userController.verifyAuth, reviewController.createReview);
router.get("/review/recent", reviewController.getRecentReviews);

/** CONTACT **/
router.post("/message/create", messageController.createMessage);

export default router;