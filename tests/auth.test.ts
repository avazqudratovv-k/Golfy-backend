import request from "supertest";
import app from "../src/app";
import UserModel from "../src/schema/User.model";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { PASSWORD, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const body = (over: Record<string, unknown> = {}) => ({
  name: "Kim Test",
  email: "kim@test.dev",
  phone: "010-1234-5678",
  password: PASSWORD,
  ...over,
});

describe("signup", () => {
  it("creates a player and never returns the password hash", async () => {
    const res = await request(app).post("/user/signup").send(body()).expect(201);
    expect(res.body.user.email).toBe("kim@test.dev");
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user.password).toBeFalsy();
  });

  it("ignores role/status sent by the client", async () => {
    const res = await request(app).post("/user/signup").send(body({ role: "ADMIN", status: "BLOCK" })).expect(201);
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user.status).toBe("ACTIVE");
  });

  it("rejects short passwords, missing fields and duplicates", async () => {
    await request(app).post("/user/signup").send(body({ password: "short" })).expect(400);
    await request(app).post("/user/signup").send(body({ name: "" })).expect(400);
    await request(app).post("/user/signup").send(body()).expect(201);
    const dupEmail = await request(app).post("/user/signup").send(body({ phone: "010-9999-0000" })).expect(400);
    expect(dupEmail.body.message).toMatch(/email/i);
    const dupPhone = await request(app).post("/user/signup").send(body({ email: "other@test.dev" })).expect(400);
    expect(dupPhone.body.message).toMatch(/phone/i);
  });

  it("treats emails case-insensitively", async () => {
    await request(app).post("/user/signup").send(body()).expect(201);
    await request(app).post("/user/signup").send(body({ email: "KIM@test.dev", phone: "010-0000-1111" })).expect(400);
  });
});

describe("login", () => {
  it("logs in with the right password, any email case and surrounding spaces", async () => {
    await request(app).post("/user/signup").send(body()).expect(201);
    const res = await request(app).post("/user/login").send({ email: "  KIM@Test.dev ", password: PASSWORD }).expect(200);
    expect(res.body.user.name).toBe("Kim Test");
  });

  it("answers 401 for a wrong password and 404 for an unknown email", async () => {
    await request(app).post("/user/signup").send(body()).expect(201);
    await request(app).post("/user/login").send({ email: "kim@test.dev", password: "wrong-password" }).expect(401);
    await request(app).post("/user/login").send({ email: "nobody@test.dev", password: PASSWORD }).expect(404);
    await request(app).post("/user/login").send({ email: "kim@test.dev" }).expect(400);
  });

  it("a blocked user cannot log in, and an existing session stops working", async () => {
    const { agent, user, email } = await signupPlayer();
    await agent.get("/user/profile").expect(200);
    await UserModel.updateOne({ _id: user._id }, { status: "BLOCK" });
    await request(app).post("/user/login").send({ email, password: PASSWORD }).expect(403);
    await agent.get("/user/profile").expect(403);
  });

  it("a deleted user cannot log in", async () => {
    const { user, email } = await signupPlayer();
    await UserModel.updateOne({ _id: user._id }, { status: "DELETE" });
    await request(app).post("/user/login").send({ email, password: PASSWORD }).expect(404);
  });

  it("protected routes need a session", async () => {
    await request(app).get("/user/profile").expect(401);
    await request(app).post("/booking/create").send({}).expect(401);
    await request(app).get("/favorite/my").expect(401);
  });
});

describe("profile", () => {
  it("changing the password needs the current one and 8+ characters", async () => {
    const { agent, email } = await signupPlayer();
    await agent.post("/user/profile").send({ password: "new-password-1" }).expect(401);
    await agent.post("/user/profile").send({ password: "short", currentPassword: PASSWORD }).expect(400);
    await agent.post("/user/profile").send({ password: "new-password-1", currentPassword: PASSWORD }).expect(200);
    await request(app).post("/user/login").send({ email, password: "new-password-1" }).expect(200);
    await request(app).post("/user/login").send({ email, password: PASSWORD }).expect(401);
  });
});
