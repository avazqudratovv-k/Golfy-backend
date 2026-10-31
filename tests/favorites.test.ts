import { clearDb, startDb, stopDb } from "./helpers/db";
import { makeVenue, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe("favourites", () => {
  it("toggle adds, then removes, and the id list follows", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const on = await a.agent.post("/favorite/toggle").send({ venueId: String(venue._id) }).expect(200);
    expect(on.body).toEqual({ venueId: String(venue._id), favorited: true });
    expect((await a.agent.get("/favorite/ids").expect(200)).body).toEqual([String(venue._id)]);
    const mine = await a.agent.get("/favorite/my").query({ page: 1, limit: 10 }).expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].venueName).toBe(venue.venueName);

    const off = await a.agent.post("/favorite/toggle").send({ venueId: String(venue._id) }).expect(200);
    expect(off.body.favorited).toBe(false);
    expect((await a.agent.get("/favorite/ids").expect(200)).body).toEqual([]);
  });

  it("favourites are per user", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    await a.agent.post("/favorite/toggle").send({ venueId: String(venue._id) }).expect(200);
    expect((await b.agent.get("/favorite/ids").expect(200)).body).toEqual([]);
  });

  it("only active, existing venues can be added", async () => {
    const inactive = await makeVenue({ venueStatus: "INACTIVE" });
    const a = await signupPlayer();
    await a.agent.post("/favorite/toggle").send({ venueId: String(inactive._id) }).expect(404);
    await a.agent.post("/favorite/toggle").send({ venueId: "nope" }).expect(400);
  });

  it("parallel toggles never create duplicates", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    await Promise.all(Array.from({ length: 4 }, () => a.agent.post("/favorite/toggle").send({ venueId: String(venue._id) })));
    const ids = (await a.agent.get("/favorite/ids").expect(200)).body as string[];
    expect(ids.length).toBeLessThanOrEqual(1);
  });
});
