export enum HttpCode {
    OK = 200,
    CREATED = 201,
    NOT_MODIFIED = 304,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
}

export enum Message {
    SOMETHING_WENT_WRONG = "Something went wrong",
    NO_DATA_FOUND = "No data is found",
    CREATE_FAILED = "Create is failed",
    UPDATE_FAILED = "Update is failed",
    NOT_ADMIN = "You do not have admin access!",
    CANNOT_CHANGE_SELF = "You cannot block or delete your own account!",

    USED_EMAIL_PHONE = "You are inserting already used email or phone!",
    EMAIL_USED = "This email is already in use!",
    PHONE_USED = "This phone number is already in use!",
    PASSWORD_TOO_SHORT = "Use at least 8 characters for the password!",
    TOKEN_CREATION_FAILED = "Token creation error!",
    NO_USER_EMAIL = "No user with that email!",
    BLOCKED_USER = "You have been blocked, contact support@golfy.com",
    WRONG_PASSWORD = "Wrong password, please try again!",
    NOT_AUTHENTIFICATED = "You are not authenticated, please login first!",

    SLOT_ALREADY_BOOKED = "This time slot is already booked!",
    DATE_TIME_REQUIRED = "Please select a date and time before paying!",
    BOOKING_NOT_FOUND = "Booking not found!",
    NOT_ELIGIBLE_FOR_REVIEW = "You can only review venues you have booked and played!",
    ALREADY_REVIEWED = "You have already reviewed this booking!",

    VENUE_EXISTS = "A venue with this name already exists!",
    INVALID_INPUT = "Please check the information you entered!",
    INVALID_ID = "Invalid id!",
    INVALID_STATUS_CHANGE = "This status change is not allowed!",
    INVALID_FILE = "Only image files up to 5MB are allowed!",
    TOO_MANY_REQUESTS = "Too many requests, please try again later!",
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