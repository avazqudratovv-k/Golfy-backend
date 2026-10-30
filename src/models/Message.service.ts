import { Message, MessageInput } from "../libs/types/message";
import MessageModel from "../schema/Message.model";
import Errors, { HttpCode, Message as Msg } from "../libs/utils/Errors";
import { isNonEmptyString } from "../libs/utils/config";

class MessageService {
    private readonly messageModel;

    constructor() {
        this.messageModel = MessageModel;
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