import { Booking, BookingInquiry, BookingInput, BookingUpdateInput } from "../libs/types/booking";
import { User } from "../libs/types/user";
import BookingModel from "../schema/Booking.model";
import { shapeIntoMongooseObjectId } from "../libs/utils/config";
import { HttpCode, Message } from "../libs/utils/Errors";
import Errors from "../libs/utils/Errors";
import { BookingStatus } from "../libs/enums/booking.enum";
import VenueService from "./Venue.service";

class BookingService {
    private readonly bookingModel;
    private readonly venueService;

    constructor() {
        this.bookingModel = BookingModel;
        this.venueService = new VenueService();
    }

    public async createBooking(
        user: User,
        input: BookingInput
    ): Promise<Booking> {
        const userId = shapeIntoMongooseObjectId(user._id);
        const venueId = shapeIntoMongooseObjectId(input.venueId);

        // conflict check \
        const existing = await this.bookingModel
          .findOne({
            venueId: venueId,
            bookingDate: input.bookingDate,
            startTime: input.startTime,
            status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          })
          .exec();
        if (existing) throw new Errors(HttpCode.CONFLICT, Message.SLOT_ALREADY_BOOKED);

        try {
            return await this.bookingModel.create({
                ...input,
                userId: userId,
                venueId: venueId,
            });
        } catch (err) {
            console.log("Error, model:createBooking:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }

    public async getMyBookings(
        user: User,
        inquiry: BookingInquiry
    ): Promise<Booking[]> {
        const userId = shapeIntoMongooseObjectId(user._id);
        const matches: any = { userId: userId };
        if (inquiry.status) matches.status = inquiry.status;

        const result = await this.bookingModel
           .aggregate([
                { $match: matches },
                { $sort: { updatedAt: -1 } },
                { $skip: (inquiry.page - 1) * inquiry.limit },
                { $limit: inquiry.limit },
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

    public async updateBooking(
        user: User,
        input: BookingUpdateInput
    ): Promise<Booking> {
        const userId = shapeIntoMongooseObjectId(user._id),
          bookingId = shapeIntoMongooseObjectId(input.bookingId),
          status = input.status;

        const result = await this.bookingModel
          .findOneAndUpdate(
            { userId: userId, _id: bookingId },
            { status: status },
            { new: true }
          )
          .exec();

        if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

        if (status === BookingStatus.CONFIRMED) {
            await this.venueService.incrementBookingCount(result.venueId);
        }
        return result;
    }

    /** ADMIN **/

    public async getAllBookings(): Promise<Booking[]> {
        const result = await this.bookingModel
          .aggregate([
            { $sort: { bookingDate: -1 } },
            {
                $lookup: {
                    from: "venues",
                    localField: "venueId",
                    foreignField: "_id",
                    as: "venueData",
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData",
                },
            },
          ])
          .exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }
}

export default BookingService;