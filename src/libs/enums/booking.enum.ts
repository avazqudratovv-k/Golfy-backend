export enum BookingStatus {
    PENDING = "PENDING",      // in cart, date/time picked but not paid
    CONFIRMED = "CONFIRMED",  // paid, upcoming
    FINISHED = "FINISHED",    // time has passed, booking completed
    CANCELLED = "CANCELLED",
}