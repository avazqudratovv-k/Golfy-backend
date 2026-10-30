import { ExtendedRequest } from "../libs/types/user";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/utils/Errors";
import BookingService from "../models/Booking.service";
import { BookingInquiry, BookingUpdateInput } from "../libs/types/booking";
import { BookingStatus } from "../libs/enums/booking.enum";
import { parsePagination, wantsPaging } from "../libs/utils/config";

const bookingService = new BookingService();
const bookingController: T = {};

bookingController.createBooking = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("createBooking");
        const result = await bookingService.createBooking(req.user, req.body);
        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createBooking:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

bookingController.getMyBookings = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMyBookings");
        const { page, limit, status } = req.query;
        const inquiry: BookingInquiry = {
            ...parsePagination(page, limit, 10),
            status: status as BookingStatus,
        };
        console.log("inquiry:", inquiry);
        const result = await bookingService.getMyBookings(req.user, inquiry);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMyBookings:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

bookingController.getMyBooking = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMyBooking");
        const result = await bookingService.getMyBooking(req.user, req.params.id as string);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMyBooking:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

bookingController.updateBooking = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("updateBooking");
        const input: BookingUpdateInput = req.body;
        const result = await bookingService.updateBooking(req.user, input);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateBooking:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

// public: free / taken hourly slots of a venue for ?date=YYYY-MM-DD
bookingController.getAvailability = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getAvailability");
        const result = await bookingService.getAvailability(
            req.params.id as string,
            req.query.date
        );
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getAvailability:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** ADMIN **/

bookingController.getAllBookings = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getAllBookings");
        if (wantsPaging(req.query)) {
            const { page, limit, status, venueId, from, to, search } = req.query;
            const filters = { status, venueId, from, to, search };
            res.setHeader("X-Total-Count", String(await bookingService.countAllBookings(filters)));
            const rows = await bookingService.getPagedBookings(filters, parsePagination(page, limit, 20));
            return res.status(HttpCode.OK).json(rows);
        }
        const result = await bookingService.getAllBookings();
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getAllBookings:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

bookingController.deleteBooking = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("deleteBooking");
        const id = req.params.id as string;

        const result = await bookingService.deleteBooking(id);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, deleteBooking:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default bookingController;