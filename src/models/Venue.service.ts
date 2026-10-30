import { VenueStatus, VenueType } from "../libs/enums/venue.enum";
import {
  escapeRegex,
  isValidObjectIdString,
  shapeIntoMongooseObjectId,
} from "../libs/utils/config";
import { BookingStatus } from "../libs/enums/booking.enum";
import { UserRole, UserStatus } from "../libs/enums/user.enum";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import {
  Venue,
  VenueInput,
  VenueInquiry,
  VenueUpdateInput,
} from "../libs/types/venue";
import VenueModel from "../schema/Venue.model";
import BookingModel from "../schema/Booking.model";
import UserModel from "../schema/User.model";
import { T } from "../libs/types/common";
import fs from "fs";
import path from "path";

class VenueService {
  private readonly venueModel;

  constructor() {
    this.venueModel = VenueModel;
  }

  /** USER SIDE **/

  private buildVenueMatch(inquiry: VenueInquiry): T {
    const match: T = { venueStatus: VenueStatus.ACTIVE };

    if (inquiry.search) {
      match.venueName = {
        $regex: new RegExp(escapeRegex(String(inquiry.search).slice(0, 100)), "i"),
      };
    }

    const price: T = {};
    if (inquiry.minPrice !== undefined) price.$gte = inquiry.minPrice;
    if (inquiry.maxPrice !== undefined) price.$lte = inquiry.maxPrice;
    if (Object.keys(price).length) match.pricePerHour = price;

    if (inquiry.minRating !== undefined) match.avgRating = { $gte: inquiry.minRating };
    if (inquiry.type && Object.values(VenueType).includes(inquiry.type))
      match.venueType = inquiry.type;

    return match;
  }

  public async countVenues(inquiry: VenueInquiry): Promise<number> {
    return await this.venueModel.countDocuments(this.buildVenueMatch(inquiry)).exec();
  }

  public async getVenues(inquiry: VenueInquiry): Promise<Venue[]> {
    const match = this.buildVenueMatch(inquiry);

    let sort: T = { pricePerHour: 1, _id: 1 };
    if (inquiry.sort === "expensive") sort = { pricePerHour: -1, _id: 1 };
    else if (inquiry.sort === "popular") sort = { bookingCount: -1, _id: 1 };
    else if (inquiry.sort === "rating")
      sort = { avgRating: -1, reviewCount: -1, _id: 1 };

    // EXPLICIT NUMERIC CASTING: Prevents pipeline type breaks
    const cleanPage = Math.max(1, Number(inquiry.page));
    const cleanLimit = Math.max(1, Number(inquiry.limit));
    const skipCount = (cleanPage - 1) * cleanLimit;

    const result = await this.venueModel
      .aggregate([
        { $match: match },
        { $sort: sort },
        { $skip: skipCount },
        { $limit: cleanLimit },
      ])
      .exec();

    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return result;
  }

  public async getVenue(id: string): Promise<Venue> {
    if (!isValidObjectIdString(id))
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    const venueId = shapeIntoMongooseObjectId(id);

    const result = await this.venueModel
      .findOne({
        _id: venueId,
        venueStatus: VenueStatus.ACTIVE,
      })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  // up to 4 other active venues: same type first, then closest price, then most popular
  public async getSimilarVenues(id: string): Promise<Venue[]> {
    const venue: any = await this.getVenue(id);

    return await this.venueModel
      .aggregate([
        { $match: { venueStatus: VenueStatus.ACTIVE, _id: { $ne: venue._id } } },
        {
          $addFields: {
            _typeRank: { $cond: [{ $eq: ["$venueType", venue.venueType ?? null] }, 0, 1] },
            _priceGap: { $abs: { $subtract: ["$pricePerHour", venue.pricePerHour] } },
          },
        },
        { $sort: { _typeRank: 1, _priceGap: 1, bookingCount: -1, _id: 1 } },
        { $limit: 4 },
        { $project: { _typeRank: 0, _priceGap: 0 } },
      ])
      .exec();
  }

  public async getTopVenues(): Promise<Venue[]> {
    const result = await this.venueModel
      .find({ venueStatus: VenueStatus.ACTIVE })
      .sort({ bookingCount: -1 })
      .limit(4)
      .lean()
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result as Venue[];
  }

  public async getStats(): Promise<{
    totalBookings: number;
    totalVenues: number;
    totalUsers: number;
  }> {
    const [totalBookings, totalVenues, totalUsers] = await Promise.all([
      BookingModel.countDocuments({
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.FINISHED] },
      }),
      this.venueModel.countDocuments({ venueStatus: VenueStatus.ACTIVE }),
      UserModel.countDocuments({
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      }),
    ]);
    return { totalBookings, totalVenues, totalUsers };
  }

  /** ADMIN **/

  public async getAllVenues(): Promise<Venue[]> {
    const result = await this.venueModel.find().lean().exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result as Venue[];
  }

  // only these fields can be written by the client (never bookingCount etc.)
  private pickVenueFields(input: any): T {
    const fields = [
      "venueStatus",
      "venueType",
      "venueName",
      "venueLocation",
      "pricePerHour",
      "venueDesc",
      "venueImages",
    ];
    const data: T = {};
    for (const key of fields) {
      if (input?.[key] !== undefined) data[key] = input[key];
    }
    return data;
  }

  public async createNewVenue(input: VenueInput): Promise<Venue> {
    try {
      return await this.venueModel.create(this.pickVenueFields(input));
    } catch (err: any) {
      console.error("Error, model:createNewVenue:", err);
      if (err?.code === 11000) throw new Errors(HttpCode.BAD_REQUEST, Message.VENUE_EXISTS);
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  public async updateChosenVenue(
    id: string,
    input: VenueUpdateInput,
    images?: { keep: string[]; added: string[] }
  ): Promise<Venue> {
    id = shapeIntoMongooseObjectId(id);
    const data = this.pickVenueFields(input);

    // images are only touched when the client sends them: kept ones (must already belong
    // to this venue) plus newly uploaded ones, 1 to 5 in total
    let dropped: string[] = [];
    if (images) {
      const current: any = await this.venueModel.findById(id).select("venueImages").lean().exec();
      if (!current) throw new Errors(HttpCode.NOT_FOUND, Message.UPDATE_FAILED);
      const existing: string[] = current.venueImages ?? [];
      const kept = images.keep.filter((img) => existing.includes(img));
      const finalList = [...kept, ...images.added];
      if (finalList.length < 1 || finalList.length > 5)
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
      data.venueImages = finalList;
      dropped = existing.filter((img) => !finalList.includes(img));
    }

    let result;
    try {
      result = await this.venueModel
        .findOneAndUpdate({ _id: id }, data, {
          new: true,
          runValidators: true,
        })
        .exec();
    } catch (err: any) {
      console.error("Error, model:updateChosenVenue:", err);
      if (err?.code === 11000) throw new Errors(HttpCode.BAD_REQUEST, Message.VENUE_EXISTS);
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.UPDATE_FAILED);

    // files that are no longer used by the venue are removed from disk
    dropped
      .filter((img) => img.startsWith("uploads/venues/") && !img.includes(".."))
      .forEach((img) => fs.unlink(path.join(process.cwd(), img), () => {}));

    return result;
  }

  public async incrementBookingCount(venueId: any): Promise<void> {
    await this.venueModel
      .findByIdAndUpdate(venueId, { $inc: { bookingCount: 1 } })
      .exec();
  }

  public async decrementBookingCount(venueId: any): Promise<void> {
    await this.venueModel
      .updateOne(
        { _id: venueId, bookingCount: { $gt: 0 } },
        { $inc: { bookingCount: -1 } }
      )
      .exec();
  }
}

export default VenueService;
