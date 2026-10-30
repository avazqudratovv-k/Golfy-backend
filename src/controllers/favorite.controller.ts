import { Response } from "express";
import { T } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import Errors, { HttpCode } from "../libs/utils/Errors";
import { parsePagination } from "../libs/utils/config";
import FavoriteService from "../models/Favorite.service";

const favoriteService = new FavoriteService();

const favoriteController: T = {};

favoriteController.toggleFavorite = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("toggleFavorite");
        const result = await favoriteService.toggle(req.user, req.body);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, toggleFavorite:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

favoriteController.getMyFavorites = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMyFavorites");
        const { page, limit } = req.query;
        const result = await favoriteService.getMyFavorites(
            req.user,
            parsePagination(page, limit, 12)
        );
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMyFavorites:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

favoriteController.getMyFavoriteIds = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMyFavoriteIds");
        const result = await favoriteService.getMyFavoriteIds(req.user);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMyFavoriteIds:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default favoriteController;
