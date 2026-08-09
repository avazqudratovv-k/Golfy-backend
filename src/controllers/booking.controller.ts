import { ExtendedRequest } from "../libs/types/user";
import { T } from "../libs/types/common";
import { Response } from "express";
import Errors, { HttpCode } from "../libs/utils/Errors";
import BookingService from "../models/Booking.service";
import { BookingInquiry, BookingUpdateInput } from "../libs/types/booking";
import { BookingStatus } from "../libs/enums/booking.enum";

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
            page: Number(page) || 1,
            limit: Number(limit) || 10,
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

/** ADMIN **/

bookingController.getAllBookings = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getAllBookings");
        const result = await bookingService.getAllBookings();

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getAllBookings:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default bookingController;