import { Request, Response } from "express";
import { T } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import Errors, { HttpCode } from "../libs/utils/Errors";
import ReviewService from "../models/Review.service";
import { ReviewInput, ReviewInquiry } from "../libs/types/review";
import { parsePagination } from "../libs/utils/config";

const reviewService = new ReviewService();

const reviewController: T = {};

reviewController.createReview = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("createReview");
        const input: ReviewInput = req.body;
        const result = await reviewService.createReview(req.user, input);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createReview:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

reviewController.getRecentReviews = async (req: Request, res: Response) => {
    try {
        console.log("getRecentReviews");
        const { page, limit, venueId } = req.query;
        const inquiry: ReviewInquiry = parsePagination(page, limit, 3);
        if (venueId) inquiry.venueId = venueId as any;

        const result = await reviewService.getRecentReviews(inquiry);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getRecentReviews:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default reviewController;