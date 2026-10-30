import { Booking, BookingInquiry, BookingInput, BookingUpdateInput } from "../libs/types/booking";
import { User } from "../libs/types/user";
import BookingModel from "../schema/Booking.model";
import { BOOKING_HOURS, PENDING_HOLD_MINUTES, shapeIntoMongooseObjectId } from "../libs/utils/config";
import { HttpCode, Message } from "../libs/utils/Errors";
import Errors from "../libs/utils/Errors";
import { BookingStatus } from "../libs/enums/booking.enum";
import {
    bookingHasEnded,
    parseTimeToMinutes,
    rangesOverlap,
    startOfUtcDay,
} from "../libs/utils/booking";
import VenueService from "./Venue.service";

// allowed status changes (same status = no-op)
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED, BookingStatus.FINISHED],
    [BookingStatus.FINISHED]: [],
    [BookingStatus.CANCELLED]: [],
};

class BookingService {
    private readonly bookingModel;
    private readonly venueService;

    constructor() {
        this.bookingModel = BookingModel;
        this.venueService = new VenueService();
    }

    // bookings that currently occupy a venue on a given day
    private async findBlocking(
        venueId: any,
        date: Date,
        excludeId?: any,
        onlyEarlier = false
    ): Promise<any[]> {
        const dayStart = startOfUtcDay(date);
        const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
        const holdCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60000);

        const query: any = {
            venueId: venueId,
            bookingDate: { $gte: dayStart, $lt: dayEnd },
            $or: [
                { status: { $in: [BookingStatus.CONFIRMED, BookingStatus.FINISHED] } },
                { status: BookingStatus.PENDING, createdAt: { $gt: holdCutoff } },
            ],
        };
        if (excludeId) query._id = onlyEarlier ? { $lt: excludeId } : { $ne: excludeId };

        return await this.bookingModel.find(query).lean().exec();
    }

    // first booking that blocks the requested slot (same venue, same day, overlapping time)
    private async findConflict(
        venueId: any,
        date: Date,
        start: number,
        end: number,
        excludeId?: any,
        onlyEarlier = false
    ): Promise<any | null> {
        const candidates = await this.findBlocking(venueId, date, excludeId, onlyEarlier);
        return (
            candidates.find((b) => {
                const s = parseTimeToMinutes(b.startTime);
                const e = parseTimeToMinutes(b.endTime, true);
                return s !== null && e !== null && rangesOverlap(s, e, start, end);
            }) ?? null
        );
    }

    // public: which hourly slots of a venue are free on a given day
    public async getAvailability(venueId: string, dateInput: any) {
        const venue: any = await this.venueService.getVenue(venueId);

        const date = new Date(dateInput);
        if (!dateInput || isNaN(date.getTime()))
            throw new Errors(HttpCode.BAD_REQUEST, Message.DATE_TIME_REQUIRED);

        const blocking = await this.findBlocking(venue._id, date);
        const busy = blocking
            .map((b) => ({
                s: parseTimeToMinutes(b.startTime),
                e: parseTimeToMinutes(b.endTime, true),
            }))
            .filter((b): b is { s: number; e: number } => b.s !== null && b.e !== null);

        return {
            venueId: String(venue._id),
            date: startOfUtcDay(date).toISOString().slice(0, 10),
            pricePerHour: venue.pricePerHour,
            slots: BOOKING_HOURS.map((startTime, i) => ({
                startTime,
                endTime: i === 23 ? "24:00" : BOOKING_HOURS[i + 1],
                available: !busy.some((b) => rangesOverlap(b.s, b.e, i * 60, i * 60 + 60)),
            })),
            booked: blocking.map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
        };
    }

    private conflictError(existing: any) {
        return new Errors(
            HttpCode.CONFLICT,
            `This slot conflicts with an existing booking from ${existing.startTime} to ${existing.endTime}. Please choose a different time.`
        );
    }

    public async createBooking(
        user: User,
        input: BookingInput
    ): Promise<Booking> {
        const userId = shapeIntoMongooseObjectId(user._id);
        const venueId = shapeIntoMongooseObjectId(input?.venueId);

        const date = new Date(input?.bookingDate as any);
        if (!input?.bookingDate || isNaN(date.getTime()))
            throw new Errors(HttpCode.BAD_REQUEST, Message.DATE_TIME_REQUIRED);

        const start = parseTimeToMinutes(input.startTime);
        const end = parseTimeToMinutes(input.endTime, true);
        if (start === null || end === null || start >= end)
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);

        // venue must exist and be ACTIVE; the price is computed here, never trusted from the client
        const venue = await this.venueService.getVenue(String(input.venueId));
        const price = Math.round(((venue.pricePerHour * (end - start)) / 60) * 100) / 100;

        const existing = await this.findConflict(venueId, date, start, end);
        if (existing) throw this.conflictError(existing);

        let created;
        try {
            created = await this.bookingModel.create({
                userId: userId,
                venueId: venueId,
                bookingDate: date,
                startTime: input.startTime,
                endTime: input.endTime,
                price: price,
                status: BookingStatus.PENDING,
            });
        } catch (err) {
            console.log("Error, model:createBooking:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }

        // two requests can pass the check above at the same time: the earlier insert wins
        const raced = await this.findConflict(venueId, date, start, end, created._id, true);
        if (raced) {
            await this.bookingModel.deleteOne({ _id: created._id }).exec();
            throw this.conflictError(raced);
        }

        return created;
    }

    // adds venueData and `reviewed` (true when the booking already has a review)
    private bookingLookups(): any[] {
        return [
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
                    from: "reviews",
                    localField: "_id",
                    foreignField: "bookingId",
                    as: "reviewData",
                },
            },
            { $addFields: { reviewed: { $gt: [{ $size: "$reviewData" }, 0] } } },
            { $project: { reviewData: 0 } },
        ];
    }

    public async getMyBooking(user: User, id: string): Promise<Booking> {
        const [result] = await this.bookingModel
            .aggregate([
                {
                    $match: {
                        _id: shapeIntoMongooseObjectId(id),
                        userId: shapeIntoMongooseObjectId(user._id),
                    },
                },
                ...this.bookingLookups(),
            ])
            .exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.BOOKING_NOT_FOUND);
        return result;
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
                { $skip: Math.max(0, (inquiry.page - 1) * inquiry.limit) },
                { $limit: inquiry.limit },
                ...this.bookingLookups(),
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
          bookingId = shapeIntoMongooseObjectId(input?.bookingId),
          status = input?.status;

        if (!Object.values(BookingStatus).includes(status))
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);

        const booking = await this.bookingModel
          .findOne({ userId: userId, _id: bookingId })
          .exec();
        if (!booking) throw new Errors(HttpCode.NOT_FOUND, Message.BOOKING_NOT_FOUND);

        const current = booking.status as BookingStatus;
        if (current === status) return booking;

        if (!ALLOWED_TRANSITIONS[current].includes(status))
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_STATUS_CHANGE);

        if (status === BookingStatus.FINISHED && !bookingHasEnded(booking))
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_STATUS_CHANGE);

        if (status === BookingStatus.CONFIRMED) {
            // the slot may have been released (hold expired) and taken by someone else
            const start = parseTimeToMinutes(booking.startTime);
            const end = parseTimeToMinutes(booking.endTime, true);
            if (start !== null && end !== null) {
                const existing = await this.findConflict(
                    booking.venueId, booking.bookingDate, start, end, booking._id
                );
                if (existing) throw this.conflictError(existing);
            }
        }

        // the status filter makes concurrent updates safe
        const result = await this.bookingModel
          .findOneAndUpdate(
            { userId: userId, _id: bookingId, status: current },
            { status: status },
            { new: true, runValidators: true }
          )
          .exec();

        if (!result) throw new Errors(HttpCode.CONFLICT, Message.UPDATE_FAILED);

        if (status === BookingStatus.CONFIRMED) {
            await this.venueService.incrementBookingCount(result.venueId);
        } else if (current === BookingStatus.CONFIRMED && status === BookingStatus.CANCELLED) {
            await this.venueService.decrementBookingCount(result.venueId);
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
            // $lookup ignores select:false, so strip the hash explicitly
            { $project: { "userData.password": 0 } },
          ])
          .exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result;
    }

    public async deleteBooking(bookingId: string): Promise<any> {
        const id = shapeIntoMongooseObjectId(bookingId);
        const result = await this.bookingModel.findByIdAndDelete(id).exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.BOOKING_NOT_FOUND);

        if (result.status === BookingStatus.CONFIRMED || result.status === BookingStatus.FINISHED) {
            await this.venueService.decrementBookingCount(result.venueId);
        }
        return result;
    }
}

export default BookingService;
