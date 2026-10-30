import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import { AUTH_TIMER } from "../libs/utils/config";
import { User } from "../libs/types/user";
import jwt from "jsonwebtoken";

class AuthService {
    private readonly secretToken;
    constructor() {
        this.secretToken = process.env.SECRET_TOKEN as string;
    }

    public async createToken(payload: User) {
        return new Promise((resolve, reject) => {
            const duration = `${AUTH_TIMER}h`;
            jwt.sign(
                payload,
                process.env.SECRET_TOKEN as string,
                { expiresIn: duration },
                (err, token) => {
                    if (err)
                        reject(new Errors(HttpCode.UNAUTHORIZED, Message.TOKEN_CREATION_FAILED));
                    else resolve(token as string);
                }
            );
        });
    }

    public async checkAuth(token: string): Promise<User> {
        try {
            return jwt.verify(token, this.secretToken) as User;
        } catch (err) {
            // expired / malformed / tampered token
            throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTIFICATED);
        }
    }
}

export default AuthService;