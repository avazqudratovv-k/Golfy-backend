import { Message, MessageInput } from "../libs/types/message";
import MessageModel from "../schema/Message.model";
import Errors, { HttpCode, Message as Msg } from "../libs/utils/Errors";
import { isNonEmptyString, shapeIntoMongooseObjectId } from "../libs/utils/config";

class MessageService {
    private readonly messageModel;

    constructor() {
        this.messageModel = MessageModel;
    }

    /** ADMIN **/

    // newest first; optional ?unread=true
    public async getMessages(unreadOnly: boolean, paging: { page: number; limit: number }): Promise<Message[]> {
        const filter: any = unreadOnly ? { isRead: { $ne: true } } : {};
        return (await this.messageModel
            .find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((paging.page - 1) * paging.limit)
            .limit(paging.limit)
            .lean()
            .exec()) as any;
    }

    public async countMessages(unreadOnly: boolean): Promise<number> {
        return await this.messageModel.countDocuments(unreadOnly ? { isRead: { $ne: true } } : {}).exec();
    }

    public async markRead(id: string, isRead = true): Promise<Message> {
        const result = await this.messageModel
            .findByIdAndUpdate(shapeIntoMongooseObjectId(id), { isRead }, { new: true })
            .lean()
            .exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Msg.NO_DATA_FOUND);
        return result as any;
    }

    public async markAllRead(): Promise<number> {
        const res = await this.messageModel.updateMany({ isRead: { $ne: true } }, { isRead: true }).exec();
        return res.modifiedCount;
    }

    public async createMessage(input: MessageInput): Promise<Message> {
        if (
            !isNonEmptyString(input?.name) ||
            !isNonEmptyString(input?.email) ||
            !isNonEmptyString(input?.message) ||
            input.name.length > 100 ||
            input.email.length > 200 ||
            input.message.length > 5000
        )
            throw new Errors(HttpCode.BAD_REQUEST, Msg.INVALID_INPUT);

        try {
            return await this.messageModel.create({
                name: input.name.trim(),
                email: input.email.trim(),
                message: input.message.trim(),
            });
        } catch (err) {
            console.error("Error, model:createMessage:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Msg.CREATE_FAILED);
        }
    }
}

export default MessageService;