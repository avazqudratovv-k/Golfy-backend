import BookingModel from "../schema/Booking.model";
import UserModel from "../schema/User.model";
import VenueModel from "../schema/Venue.model";
import { BookingStatus } from "../libs/enums/booking.enum";
import { UserRole, UserStatus } from "../libs/enums/user.enum";
import { VenueStatus } from "../libs/enums/venue.enum";
import { startOfUtcDay } from "../libs/utils/booking";

const DAY = 24 * 3600 * 1000;
const COUNTED = { $in: [BookingStatus.CONFIRMED, BookingStatus.FINISHED] };

class DashboardService {
  // numbers and chart series for the admin dashboard (UTC days / months)
  public async getDashboard() {
    const now = new Date();
    const since30 = startOfUtcDay(new Date(now.getTime() - 29 * DAY));
    const since30d = new Date(now.getTime() - 30 * DAY);
    const since60d = new Date(now.getTime() - 60 * DAY);
    const since6m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [totals, daily, monthly, statuses, top, latest, users, venues, windows, newUsers, newVenues] =
      await Promise.all([
        BookingModel.aggregate([
          { $match: { status: COUNTED } },
          { $group: { _id: null, bookings: { $sum: 1 }, revenue: { $sum: "$price" } } },
        ]).exec(),
        BookingModel.aggregate([
          { $match: { status: COUNTED, createdAt: { $gte: since30 } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              bookings: { $sum: 1 },
              revenue: { $sum: "$price" },
            },
          },
        ]).exec(),
        BookingModel.aggregate([
          { $match: { status: COUNTED, createdAt: { $gte: since6m } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              bookings: { $sum: 1 },
              revenue: { $sum: "$price" },
            },
          },
        ]).exec(),
        BookingModel.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]).exec(),
        BookingModel.aggregate([
          { $match: { status: COUNTED } },
          { $group: { _id: "$venueId", bookings: { $sum: 1 }, revenue: { $sum: "$price" } } },
          { $sort: { bookings: -1, revenue: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "venues",
              localField: "_id",
              foreignField: "_id",
              as: "venue",
            },
          },
          {
            $project: {
              _id: 0,
              venueId: "$_id",
              bookings: 1,
              revenue: 1,
              venueName: { $arrayElemAt: ["$venue.venueName", 0] },
              venueImage: { $arrayElemAt: [{ $arrayElemAt: ["$venue.venueImages", 0] }, 0] },
            },
          },
        ]).exec(),
        BookingModel.aggregate([
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "venues",
              localField: "venueId",
              foreignField: "_id",
              as: "venue",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $project: {
              status: 1,
              price: 1,
              bookingDate: 1,
              startTime: 1,
              endTime: 1,
              createdAt: 1,
              venueName: { $arrayElemAt: ["$venue.venueName", 0] },
              userName: { $arrayElemAt: ["$user.name", 0] },
            },
          },
        ]).exec(),
        UserModel.countDocuments({ role: UserRole.USER, status: UserStatus.ACTIVE }).exec(),
        VenueModel.countDocuments({ venueStatus: VenueStatus.ACTIVE }).exec(),
        // last 30 days against the 30 days before, for the "up / down" indicators
        BookingModel.aggregate([
          { $match: { status: COUNTED, createdAt: { $gte: since60d } } },
          {
            $group: {
              _id: { $cond: [{ $gte: ["$createdAt", since30d] }, "last", "prev"] },
              bookings: { $sum: 1 },
              revenue: { $sum: "$price" },
            },
          },
        ]).exec(),
        UserModel.countDocuments({
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          createdAt: { $gte: since30d },
        }).exec(),
        VenueModel.countDocuments({
          venueStatus: VenueStatus.ACTIVE,
          createdAt: { $gte: since30d },
        }).exec(),
      ]);

    const win = (key: string) => windows.find((w: any) => w._id === key);

    const dailyMap = new Map<string, any>(daily.map((d: any) => [d._id, d]));
    const bookingsByDay = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(since30.getTime() + i * DAY).toISOString().slice(0, 10);
      const hit = dailyMap.get(date);
      return { date, bookings: hit?.bookings ?? 0, revenue: hit?.revenue ?? 0 };
    });

    const monthlyMap = new Map<string, any>(monthly.map((d: any) => [d._id, d]));
    const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(since6m.getUTCFullYear(), since6m.getUTCMonth() + i, 1));
      const month = d.toISOString().slice(0, 7);
      const hit = monthlyMap.get(month);
      return { month, bookings: hit?.bookings ?? 0, revenue: hit?.revenue ?? 0 };
    });

    const statusMap = new Map<string, number>(statuses.map((s: any) => [s._id, s.count]));
    const statusBreakdown = Object.values(BookingStatus).map((status) => ({
      status,
      count: statusMap.get(status) ?? 0,
    }));

    return {
      trend: {
        bookings: { last30: win("last")?.bookings ?? 0, prev30: win("prev")?.bookings ?? 0 },
        revenue: { last30: win("last")?.revenue ?? 0, prev30: win("prev")?.revenue ?? 0 },
        newUsers30: newUsers,
        newVenues30: newVenues,
      },
      totals: {
        bookings: totals[0]?.bookings ?? 0,
        revenue: totals[0]?.revenue ?? 0,
        pendingBookings: statusMap.get(BookingStatus.PENDING) ?? 0,
        users,
        venues,
      },
      bookingsByDay,
      revenueByMonth,
      statusBreakdown,
      topVenues: top,
      latestBookings: latest,
    };
  }
}

export default DashboardService;
