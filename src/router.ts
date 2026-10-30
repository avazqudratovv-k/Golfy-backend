import express from "express";
import userController from "./controllers/user.controller";
import venueController from "./controllers/venue.controller";
import bookingController from "./controllers/booking.controller";
import reviewController from "./controllers/review.controller";
import messageController from "./controllers/message.controller";
import favoriteController from "./controllers/favorite.controller";
import { rateLimit } from "./libs/utils/rateLimit";
import { uploadAvatar } from "./libs/utils/multer";



const router = express.Router();

const authLimiter = rateLimit(50, 15 * 60 * 1000);
const signupLimiter = rateLimit(30, 60 * 60 * 1000);
const messageLimiter = rateLimit(20, 60 * 60 * 1000);

router.get("/stats", venueController.getStats);
/** AUTH **/
router.post("/user/signup", signupLimiter, userController.signup);
router.post("/user/login", authLimiter, userController.login);
router.post("/user/logout", userController.verifyAuth, userController.logout);

/** PROFILE **/
router.get("/user/profile", userController.verifyAuth, userController.getMyProfile);
router.post("/user/profile", userController.verifyAuth, uploadAvatar.single("avatar"), userController.updateMyProfile);

/** VENUES **/
router.get("/venue/all", venueController.getVenues);
router.get("/venue/top", venueController.getTopVenues);
router.get("/venue/:id/availability", bookingController.getAvailability);
router.get("/venue/:id/similar", venueController.getSimilarVenues);
router.get("/venue/:id", venueController.getVenue);


/** BOOKINGS **/
router.post("/booking/create", userController.verifyAuth, bookingController.createBooking);
router.get("/booking/my", userController.verifyAuth, bookingController.getMyBookings);
router.get("/booking/:id", userController.verifyAuth, bookingController.getMyBooking);
router.post("/booking/update", userController.verifyAuth, bookingController.updateBooking);


/** FAVORITES **/
router.post("/favorite/toggle", userController.verifyAuth, favoriteController.toggleFavorite);
router.get("/favorite/my", userController.verifyAuth, favoriteController.getMyFavorites);
router.get("/favorite/ids", userController.verifyAuth, favoriteController.getMyFavoriteIds);

/** REVIEWS **/
router.post("/review/create", userController.verifyAuth, reviewController.createReview);
router.get("/review/recent", reviewController.getRecentReviews);

/** CONTACT **/
router.post("/message/create", messageLimiter, messageController.createMessage);

export default router;