import request from "supertest";
import appAdmin from "../src/appAdmin";
import UserModel from "../src/schema/User.model";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { PASSWORD, kstDay, makeAdmin, makeVenue, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

async function adminAgent() {
  const admin = await makeAdmin();
  const agent = request.agent(appAdmin);
  await agent.post("/login").send({ email: admin.email, password: PASSWORD }).expect(200);
  return { agent, admin };
}

describe("admin guards", () => {
  const routes = ["/dashboard", "/users", "/venues", "/bookings", "/messages"];

  it("anonymous callers get 401 on every admin route", async () => {
    for (const r of routes) await request(appAdmin).get(r).expect(401);
  });

  it("a player cannot log in through the admin API", async () => {
    const { email } = await signupPlayer();
    await request(appAdmin).post("/login").send({ email, password: PASSWORD }).expect(403);
  });

  it("a player's token in the admin cookie is rejected (role check)", async () => {
    const { agent } = await signupPlayer();
    const login = await agent.post("/user/login").send({ email: (await UserModel.findOne({ role: "USER" }))!.email, password: PASSWORD });
    const playerToken = /accessToken=([^;]+)/.exec(String(login.headers["set-cookie"]))![1];
    for (const r of routes) await request(appAdmin).get(r).set("Cookie", `adminAccessToken=${playerToken}`).expect(403);
  });

  it("a blocked or demoted admin loses access even with a valid token", async () => {
    const { agent, admin } = await adminAgent();
    await agent.get("/dashboard").expect(200);
    await UserModel.updateOne({ _id: admin._id }, { status: "BLOCK" });
    await agent.get("/dashboard").expect(403);
    await UserModel.updateOne({ _id: admin._id }, { status: "ACTIVE", role: "USER" });
    await agent.get("/dashboard").expect(403);
  });

  it("a tampered token is rejected", async () => {
    await request(appAdmin).get("/dashboard").set("Cookie", "adminAccessToken=not.a.jwt").expect(401);
  });
});

describe("admin lists and pagination", () => {
  it("lists stay plain arrays until page/limit is sent, then X-Total-Count is set", async () => {
    const { agent } = await adminAgent();
    for (let i = 0; i < 5; i++) await signupPlayer();

    const plain = await agent.get("/users").expect(200);
    expect(Array.isArray(plain.body)).toBe(true);
    expect(plain.headers["x-total-count"]).toBeUndefined();
    expect(plain.body.length).toBe(6); // 5 players + the admin

    const page1 = await agent.get("/users").query({ page: 1, limit: 4 }).expect(200);
    expect(page1.body).toHaveLength(4);
    expect(page1.headers["x-total-count"]).toBe("6");
    const page2 = await agent.get("/users").query({ page: 2, limit: 4 }).expect(200);
    expect(page2.body).toHaveLength(2);
    const ids = new Set([...page1.body, ...page2.body].map((u: any) => u._id));
    expect(ids.size).toBe(6);
    expect(page1.body.every((u: any) => !u.password)).toBe(true);
  });

  it("clamps silly page/limit values", async () => {
    const { agent } = await adminAgent();
    await makeVenue();
    const res = await agent.get("/venues").query({ page: -3, limit: 100000 }).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.headers["x-total-count"]).toBe("1");
    const none = await agent.get("/venues").query({ page: 5, limit: 10 }).expect(200);
    expect(none.body).toHaveLength(0);
  });

  it("filters venues by search/type/status and paginates bookings", async () => {
    const { agent } = await adminAgent();
    const a = await makeVenue({ venueName: "Alpha Range", venueType: "RANGE" });
    await makeVenue({ venueName: "Beta Course", venueType: "COURSE", venueStatus: "INACTIVE" });
    expect((await agent.get("/venues").query({ page: 1, limit: 10, search: "alpha" })).body).toHaveLength(1);
    expect((await agent.get("/venues").query({ page: 1, limit: 10, type: "COURSE" })).body).toHaveLength(1);
    expect((await agent.get("/venues").query({ page: 1, limit: 10, status: "INACTIVE" })).body).toHaveLength(1);

    const p = await signupPlayer();
    for (let h = 8; h < 13; h++)
      await p.agent.post("/booking/create").send({ venueId: String(a._id), bookingDate: kstDay(2), startTime: `${h}:00`, endTime: `${h + 1}:00` }).expect(201);
    const first = await agent.get("/bookings").query({ page: 1, limit: 2 }).expect(200);
    expect(first.body).toHaveLength(2);
    expect(first.headers["x-total-count"]).toBe("5");
    expect(first.body[0].venueData[0].venueName).toBe("Alpha Range");
    expect(first.body[0].userData[0].password).toBeUndefined();
  });

  it("filters bookings by KST date range, inclusive on both ends", async () => {
    const { agent } = await adminAgent();
    const venue = await makeVenue();
    const p = await signupPlayer();
    for (const d of [kstDay(1), kstDay(2), kstDay(3)])
      await p.agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: d, startTime: "09:00", endTime: "10:00" }).expect(201);
    const res = await agent.get("/bookings").query({ page: 1, limit: 10, from: kstDay(2), to: kstDay(3) }).expect(200);
    expect(res.headers["x-total-count"]).toBe("2");
  });

  it("toggles a venue's status without touching anything else", async () => {
    const { agent } = await adminAgent();
    const venue = await makeVenue();
    const off = await agent.post(`/venues/${venue._id}/status`).send({ venueStatus: "INACTIVE" }).expect(200);
    expect(off.body.venueStatus).toBe("INACTIVE");
    await agent.post(`/venues/${venue._id}/status`).send({ venueStatus: "BANANA" }).expect(400);
    const on = await agent.post(`/venues/${venue._id}/status`).send({ venueStatus: "ACTIVE" }).expect(200);
    expect(on.body.venueStatus).toBe("ACTIVE");
  });

  it("deleting a confirmed booking lowers the venue counter", async () => {
    const { agent } = await adminAgent();
    const venue = await makeVenue();
    const p = await signupPlayer();
    const b = await p.agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: kstDay(2), startTime: "09:00", endTime: "10:00" }).expect(201);
    await p.agent.post("/booking/update").send({ bookingId: b.body._id, status: "CONFIRMED" }).expect(200);
    await agent.delete(`/bookings/${b.body._id}`).expect(200);
    await agent.delete(`/bookings/${b.body._id}`).expect(404);
  });
});
