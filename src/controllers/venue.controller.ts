import { Request, Response } from "express";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { T } from "../libs/types/common";
import VenueService from "../models/Venue.service";
import { VenueInput, VenueInquiry } from "../libs/types/venue";
import { VenueType } from "../libs/enums/venue.enum";
import { ExtendedRequest } from "../libs/types/user";
import { parsePagination, toOptionalNumber, wantsPaging } from "../libs/utils/config";
import fs from "fs";

const venueService = new VenueService();

const venueController: T = {};

/** USER SIDE **/
venueController.getVenues = async (req: Request, res: Response) => {
    try {
        console.log("getVenues");
        const { page, limit, sort, search, minPrice, maxPrice, minRating, type } = req.query;
        const inquiry: VenueInquiry = {
            order: "",
            ...parsePagination(page, limit, 4),
        };
        if (sort) inquiry.sort = sort as "cheap" | "expensive" | "popular" | "rating";
        if (search) inquiry.search = String(search);
        inquiry.minPrice = toOptionalNumber(minPrice);
        inquiry.maxPrice = toOptionalNumber(maxPrice);
        inquiry.minRating = toOptionalNumber(minRating);
        if (type) inquiry.type = String(type).toUpperCase() as VenueType;

        const result = await venueService.getVenues(inquiry);
        // total matches (for pagination UI), readable thanks to CORS exposedHeaders
        res.setHeader("X-Total-Count", String(await venueService.countVenues(inquiry)));

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

venueController.getSimilarVenues = async (req: Request, res: Response) => {
    try {
        console.log("getSimilarVenues");
        const result = await venueService.getSimilarVenues(req.params.id as string);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getSimilarVenues", err);
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
        const { page, limit, search, type, status } = req.query;
        const filters = { search, type, status };
        let paging;
        if (wantsPaging(req.query)) {
            paging = parsePagination(page, limit, 20);
            res.setHeader("X-Total-Count", String(await venueService.countAllVenues(filters)));
        }
        const result = await venueService.getAllVenues(filters, paging);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getAllVenues", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.setVenueStatus = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("setVenueStatus");
        const result = await venueService.setVenueStatus(req.params.id as string, req.body?.venueStatus);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, setVenueStatus", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.createNewVenue = async (req: ExtendedRequest, res: Response) => {
    const uploaded = ((req.files as Express.Multer.File[]) ?? []);
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
        // do not keep images of a venue that was not created
        uploaded.forEach((f) => fs.unlink(f.path, () => {}));
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

venueController.updateChosenVenue = async (req: ExtendedRequest, res: Response) => {
    const uploaded = ((req.files as Express.Multer.File[]) ?? []);
    try {
        console.log("updateChosenVenue");
        const id = req.params.id as string;

        // images change only if the form sent `keepImages` and/or new files
        let images: { keep: string[]; added: string[] } | undefined;
        if (uploaded.length || req.body.keepImages !== undefined) {
            const raw = req.body.keepImages;
            const keep: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
            images = { keep, added: uploaded.map((f) => `uploads/venues/${f.filename}`) };
        }
        delete req.body.keepImages;

        const result = await venueService.updateChosenVenue(id, req.body, images);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateChosenVenue", err);
        uploaded.forEach((f) => fs.unlink(f.path, () => {}));
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default venueController;