import { Request, Response } from "express";
import { T } from "../libs/types/common";
import Errors, { HttpCode } from "../libs/utils/Errors";
import { MessageInput } from "../libs/types/message";
import MessageService from "../models/Message.service";
import { parsePagination } from "../libs/utils/config";

const messageService = new MessageService();

const messageController: T = {};

messageController.createMessage = async (req: Request, res: Response) => {
    try {
        console.log("createMessage");
        const input: MessageInput = req.body;
        const result = await messageService.createMessage(input);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createMessage:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** ADMIN **/

messageController.getMessages = async (req: Request, res: Response) => {
    try {
        console.log("getMessages");
        const unread = req.query.unread === "true";
        res.setHeader("X-Total-Count", String(await messageService.countMessages(unread)));
        res.setHeader("X-Unread-Count", String(await messageService.countMessages(true)));
        const result = await messageService.getMessages(unread, parsePagination(req.query.page, req.query.limit, 20));
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMessages:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

messageController.markMessageRead = async (req: Request, res: Response) => {
    try {
        console.log("markMessageRead");
        const result = await messageService.markRead(req.params.id as string, req.body?.isRead !== false);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, markMessageRead:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

messageController.markAllMessagesRead = async (req: Request, res: Response) => {
    try {
        console.log("markAllMessagesRead");
        res.status(HttpCode.OK).json({ updated: await messageService.markAllRead() });
    } catch (err) {
        console.log("Error, markAllMessagesRead:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default messageController;