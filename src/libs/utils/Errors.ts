export enum HttpCode {
    OK = 200,
    CREATED = 201,
    NOT_MODIFIED = 304,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    INTERNAL_SERVER_ERROR = 500,
}

export enum Message {
    SOMETHING_WENT_WRONG = "Something went wrong",
    NO_DATA_FOUND = "No data is found",
    CREATE_FAILED = "Create is failed",
    UPDATE_FAILED = "Update is failed",
    NOT_ADMIN = "You do not have admin access!",

    USED_EMAIL_PHONE = "You are inserting already used email or phone!",
    TOKEN_CREATION_FAILED = "Token creation error!",
    NO_USER_EMAIL = "No user with that email!",
    BLOCKED_USER = "You have been blocked, contact support!",
    WRONG_PASSWORD = "Wrong password, please try again!",
    NOT_AUTHENTIFICATED = "You are not authenticated, please login first!",

    SLOT_ALREADY_BOOKED = "This time slot is already booked!",
    DATE_TIME_REQUIRED = "Please select a date and time before paying!",
    BOOKING_NOT_FOUND = "Booking not found!",
    NOT_ELIGIBLE_FOR_REVIEW = "You can only review venues you have booked and played!",
    ALREADY_REVIEWED = "You have already reviewed this booking!",
}

class Errors extends Error {
    public code: HttpCode;
    public message: Message | string;

    static standard = {
        code: HttpCode.INTERNAL_SERVER_ERROR,
        message: Message.SOMETHING_WENT_WRONG,
    }

    constructor(statusCode: HttpCode, statusMessage: Message | string) {
        super();
        this.code = statusCode;
        this.message = statusMessage;
    }
}

export default Errors;