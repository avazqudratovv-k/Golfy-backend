import FavoriteModel from "../schema/Favorite.model";
import { User } from "../libs/types/user";
import { Venue } from "../libs/types/venue";
import { VenueStatus } from "../libs/enums/venue.enum";
import { shapeIntoMongooseObjectId } from "../libs/utils/config";
import Errors, { HttpCode, Message } from "../libs/utils/Errors";
import VenueService from "./Venue.service";

class FavoriteService {
  private readonly favoriteModel;
  private readonly venueService;

  constructor() {
    this.favoriteModel = FavoriteModel;
    this.venueService = new VenueService();
  }

  // adds the venue if it is not a favourite yet, removes it otherwise
  public async toggle(
    user: User,
    input: { venueId: string }
  ): Promise<{ venueId: string; favorited: boolean }> {
    const userId = shapeIntoMongooseObjectId(user._id);
    const venueId = shapeIntoMongooseObjectId(input?.venueId);

    const removed = await this.favoriteModel
      .findOneAndDelete({ userId, venueId })
      .exec();
    if (removed) return { venueId: String(venueId), favorited: false };

    // only active venues can be added (throws 404 otherwise)
    await this.venueService.getVenue(String(input.venueId));
    try {
      await this.favoriteModel.create({ userId, venueId });
    } catch (err: any) {
      // a parallel request already added it
      if (err?.code !== 11000)
        throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
    return { venueId: String(venueId), favorited: true };
  }

  public async getMyFavorites(
    user: User,
    inquiry: { page: number; limit: number }
  ): Promise<Venue[]> {
    const userId = shapeIntoMongooseObjectId(user._id);

    return await this.favoriteModel
      .aggregate([
        { $match: { userId } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "venues",
            localField: "venueId",
            foreignField: "_id",
            as: "venue",
          },
        },
        { $unwind: "$venue" },
        { $match: { "venue.venueStatus": VenueStatus.ACTIVE } },
        { $skip: Math.max(0, (inquiry.page - 1) * inquiry.limit) },
        { $limit: inquiry.limit },
        { $replaceRoot: { newRoot: { $mergeObjects: ["$venue", { favoritedAt: "$createdAt" }] } } },
      ])
      .exec();
  }

  // venue ids only, handy for drawing the heart state on lists
  public async getMyFavoriteIds(user: User): Promise<string[]> {
    const userId = shapeIntoMongooseObjectId(user._id);
    const rows = await this.favoriteModel.find({ userId }).select("venueId").lean().exec();
    return rows.map((r: any) => String(r.venueId));
  }
}

export default FavoriteService;
