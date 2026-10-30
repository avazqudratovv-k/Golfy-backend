import { Review, ReviewInput, ReviewInquiry } from "../libs/types/review";
import { User } from "../libs/types/user";
import ReviewModel from "../schema/Review.model";
import BookingModel from "../schema/Booking.model";
import { shapeIntoMongooseObjectId } from "../libs/utils/config";
import { HttpCode, Message } from "../libs/utils/Errors";
import Errors from"../libs/utils/Errors";
import { BookingStatus } from "../libs/enums/booking.enum";
import { bookingHasEnded } from "../libs/utils/booking";
import VenueModel from "../schema/Venue.model";

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

        const rating = Number(input?.rating);
        const comment = typeof input?.comment === "string" ? input.comment.trim() : "";
        if (!Number.isFinite(rating) || rating < 1 || rating > 5 || !comment)
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);

        // only your own booking that is finished, or confirmed and already played
        const booking = await this.bookingModel
          .findOne({
            _id: bookingId,
            userId: userId,
            status: { $in: [BookingStatus.CONFIRMED, BookingStatus.FINISHED] },
          })
          .exec();
        if (
            !booking ||
            (booking.status === BookingStatus.CONFIRMED && !bookingHasEnded(booking))
        )
            throw new Errors(HttpCode.FORBIDDEN, Message.NOT_ELIGIBLE_FOR_REVIEW);

        try {
            const review = await this.reviewModel.create({
                bookingId: bookingId,
                userId: userId,
                venueId: booking.venueId,
                rating: rating,
                comment: comment,
            });
            this.recomputeVenueRating(booking.venueId).catch((e) =>
                console.log("Error, model:recomputeVenueRating:", e)
            );
            return review;
        } catch (err: any) {
            console.log("Error, model:createReview:", err);
            // duplicate key error from the unique bookingId index
            if (err?.code === 11000)
                throw new Errors(HttpCode.BAD_REQUEST, Message.ALREADY_REVIEWED);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }

    // keeps avgRating / reviewCount on the venue in sync with its reviews
    public async recomputeVenueRating(venueId: any): Promise<void> {
        const [stats] = await this.reviewModel
          .aggregate([
            { $match: { venueId: shapeIntoMongooseObjectId(venueId) } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
          ])
          .exec();
        await VenueModel.updateOne(
            { _id: venueId },
            {
                avgRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
                reviewCount: stats ? stats.count : 0,
            }
        ).exec();
    }

    // public: how many reviews each star rating has for a venue
    public async getRatingBreakdown(venueId: string) {
        const rows = await this.reviewModel
          .aggregate([
            { $match: { venueId: shapeIntoMongooseObjectId(venueId) } },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
          ])
          .exec();
        const counts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
        let total = 0, sum = 0;
        for (const r of rows) {
            counts[String(r._id)] = r.count;
            total += r.count;
            sum += r._id * r.count;
        }
        return { venueId: String(venueId), total, average: total ? Math.round((sum / total) * 10) / 10 : 0, counts };
    }

    public async getRecentReviews(inquiry: ReviewInquiry): Promise<Review[]> {
        const match: any = {};
        if (inquiry.venueId) match.venueId = shapeIntoMongooseObjectId(inquiry.venueId);

        const result = await this.reviewModel
          .aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: Math.max(0, (inquiry.page - 1) * inquiry.limit) },
            { $limit: inquiry.limit },
            {
                // public endpoint: expose only name + avatar (never hash/email/phone)
                $lookup: {
                    from: "users",
                    let: { uid: "$userId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
                        { $project: { name: 1, avatarUrl: 1 } },
                    ],
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
