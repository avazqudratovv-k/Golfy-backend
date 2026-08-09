import { VenueStatus } from "../libs/enums/venue.enum";
import { shapeIntoMongooseObjectId } from "../libs/utils/config";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import {
  Venue,
  VenueInput,
  VenueInquiry,
  VenueUpdateInput,
} from "../libs/types/venue";
import VenueModel from "../schema/Venue.model";
import { T } from "../libs/types/common";

class VenueService {
  private readonly venueModel;

  constructor() {
    this.venueModel = VenueModel;
  }

  /** USER SIDE **/

  public async getVenues(inquiry: VenueInquiry): Promise<Venue[]> {
    const match: T = { venueStatus: VenueStatus.ACTIVE };

    if (inquiry.search) {
      match.venueName = { $regex: new RegExp(inquiry.search, "i") };
    }

    let sort: T = { pricePerHour: 1 }; // default: cheapest first
    if (inquiry.sort === "expensive") sort = { pricePerHour: -1 };
    else if (inquiry.sort === "popular") sort = { bookingCount: -1 };

    const result = await this.venueModel
      .aggregate([
        { $match: match },
        { $sort: sort },
        { $skip: (inquiry.page * 1 - 1) * inquiry.limit },
        { $limit: inquiry.limit * 1 },
      ])
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return result;
  }

  public async getVenue(id: string): Promise<Venue> {
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

  public async getTopVenues(): Promise<Venue[]> {
    const result = await this.venueModel
      .find({ venueStatus: VenueStatus.ACTIVE })
      .sort({ bookingCount: -1 })
      .limit(4)
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  /** ADMIN **/

  public async getAllVenues(): Promise<Venue[]> {
    const result = await this.venueModel.find().exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  public async createNewVenue(input: VenueInput): Promise<Venue> {
    try {
      return await this.venueModel.create(input);
    } catch (err) {
      console.error("Error, model:createNewVenue:", err);
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  public async updateChosenVenue(
    id: string,
    input: VenueUpdateInput
  ): Promise<Venue> {
    id = shapeIntoMongooseObjectId(id);
    const result = await this.venueModel
      .findOneAndUpdate({ _id: id }, input, { new: true })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);

    return result;
  }

  public async incrementBookingCount(venueId: any): Promise<void> {
    await this.venueModel
      .findByIdAndUpdate(venueId, { $inc: { bookingCount: 1 } })
      .exec();
}
}

export default VenueService;