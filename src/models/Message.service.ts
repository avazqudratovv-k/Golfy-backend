import { Message, MessageInput } from "../libs/types/message";
import MessageModel from "../schema/Message.model";
import Errors, { HttpCode, Message as Msg } from "../libs/utils/Errors";

class MessageService {
    private readonly messageModel;

    constructor() {
        this.messageModel = MessageModel;
    }

    public async createMessage(input: MessageInput): Promise<Message> {
        try {
            return await this.messageModel.create(input);
        } catch (err) {
            console.error("Error, model:createMessage:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Msg.CREATE_FAILED);
        }
    }
}

export default MessageService;