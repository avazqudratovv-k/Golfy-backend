import { Review, ReviewInput, ReviewInquiry } from "../libs/types/review";
import { User } from "../libs/types/user";
import ReviewModel from "../schema/Review.model";
import BookingModel from "../schema/Booking.model";
import { shapeIntoMongooseObjectId } from "../libs/utils/config";
import { HttpCode, Message } from "../libs/utils/Errors";
import Errors from"../libs/utils/Errors";
import { BookingStatus } from "../libs/enums/booking.enum";

class ReviewService {
    private readonly reviewModel;
    private readonly bookingModel;

    constructor() {
        this.reviewModel = ReviewModel;
        this.bookingModel = BookingModel;
    }

    public async createReview(
        user: User,
        input: ReviewInput
    ): Promise<Review> {
        const userId = shapeIntoMongooseObjectId(user._id);
        const bookingId = shapeIntoMongooseObjectId(input.bookingId);

        // MODIFIED: Changed from BookingStatus.FINISHED to BookingStatus.CONFIRMED
        const booking = await this.bookingModel
          .findOne({
            _id: bookingId,
            userId: userId,
            status: BookingStatus.CONFIRMED, 
          })
          .exec();
        if (!booking) throw new Errors(HttpCode.FORBIDDEN, Message.NOT_ELIGIBLE_FOR_REVIEW);

        try {
            return await this.reviewModel.create({
                ...input,
                bookingId: bookingId,
                userId: userId,
                venueId: booking.venueId,
            });
        } catch (err) {
            console.log("Error, model:createReview:", err);
            // duplicate key error from the unique bookingId index
            throw new Errors(HttpCode.BAD_REQUEST, Message.ALREADY_REVIEWED);
        }
    }

    public async getRecentReviews(inquiry: ReviewInquiry): Promise<Review[]> {
        const match: any = {};
        if (inquiry.venueId) match.venueId = shapeIntoMongooseObjectId(inquiry.venueId);

        const result = await this.reviewModel
          .aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: (inquiry.page - 1) * inquiry.limit },
            { $limit: inquiry.limit },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData",
                },
            },
            {
                $lookup: {
                    from: "venues",
                    localField: "venueId",
                    foreignField: "_id",
                    as: "venueData",
                },
            },
          ])
          .exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }
}

export default ReviewService;
