import { Request, Response } from "express";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { T } from "../libs/types/common";
import VenueService from "../models/Venue.service";
import { VenueInput, VenueInquiry } from "../libs/types/venue";
import { ExtendedRequest } from "../libs/types/user";

const venueService = new VenueService();

const venueController: T = {};

/** USER SIDE **/
venueController.getVenues = async (req: Request, res: Response) => {
    try {
        console.log("getVenues");
        const { page, limit, sort, search } = req.query;
        const inquiry: VenueInquiry = {
            order: "",
            page: Number(page) || 1,
            limit: Number(limit) || 4,
        };
        if (sort) inquiry.sort = sort as "cheap" | "expensive" | "popular";
        if (search) inquiry.search = String(search);

        const result = await venueService.getVenues(inquiry);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getVenues", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.getVenue = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getVenue");
        const { id } = req.params;

        const result = await venueService.getVenue(id as string);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getVenue", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.getTopVenues = async (req: Request, res: Response) => {
    try {
        console.log("getTopVenues");
        const result = await venueService.getTopVenues();

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getTopVenues", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.getStats = async (req: Request, res: Response) => {
    try {
        console.log("getStats");
        const result = await venueService.getStats();

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getStats", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** ADMIN **/

venueController.getAllVenues = async (req: Request, res: Response) => {
    try {
        console.log("getAllVenues");
        const result = await venueService.getAllVenues();

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getAllVenues", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.createNewVenue = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("createNewVenue");
        if (!req.files?.length)
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);

        const data: VenueInput = req.body;
        data.venueImages = (req.files as Express.Multer.File[]).map((ele) => {
    return `uploads/venues/${ele.filename}`;
    });

        const result = await venueService.createNewVenue(data);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createNewVenue", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.updateChosenVenue = async (req: Request, res: Response) => {
    try {
        console.log("updateChosenVenue");
        const id = req.params.id as string;

        const result = await venueService.updateChosenVenue(id, req.body);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateChosenVenue", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default venueController;