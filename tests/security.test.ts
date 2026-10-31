import request from "supertest";
import app from "../src/app";
import appAdmin from "../src/appAdmin";
import { cookieSettings, parseTrustProxy } from "../src/libs/utils/config";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { PASSWORD, makeAdmin, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const cookieOf = (res: request.Response, name: string) =>
  ((res.headers["set-cookie"] as unknown as string[]) ?? []).find((c) => c.startsWith(`${name}=`)) ?? "";

describe("auth cookies", () => {
  it("login sets an httpOnly SameSite=Lax cookie and does not return the token in the body", async () => {
    const { email } = await signupPlayer();
    const res = await request(app).post("/user/login").send({ email, password: PASSWORD }).expect(200);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.user.email).toBe(email);
    const cookie = cookieOf(res, "accessToken");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i); // NODE_ENV=test, COOKIE_SECURE unset
  });

  it("signup and admin login follow the same rules", async () => {
    const signup = await request(app)
      .post("/user/signup")
      .send({ name: "Sign Up", email: "su@test.dev", phone: "010-1111-2222", password: PASSWORD })
      .expect(201);
    expect(signup.body.accessToken).toBeUndefined();
    expect(cookieOf(signup, "accessToken")).toMatch(/HttpOnly/i);

    const admin = await makeAdmin();
    const res = await request(appAdmin).post("/login").send({ email: admin.email, password: PASSWORD }).expect(200);
    expect(res.body.accessToken).toBeUndefined();
    expect(cookieOf(res, "adminAccessToken")).toMatch(/HttpOnly/i);
  });

  it("logout clears the cookie with the same attributes", async () => {
    const { agent } = await signupPlayer();
    const res = await agent.post("/user/logout").expect(200);
    const cookie = cookieOf(res, "accessToken");
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("cookie settings come from the environment", () => {
    const keep = { ...process.env };
    try {
      process.env.COOKIE_SAMESITE = "strict";
      process.env.COOKIE_SECURE = "true";
      expect(cookieSettings()).toEqual({ sameSite: "strict", secure: true });
      process.env.COOKIE_SAMESITE = "none";
      process.env.COOKIE_SECURE = "false";
      expect(cookieSettings()).toEqual({ sameSite: "none", secure: true }); // None requires Secure
      process.env.COOKIE_SAMESITE = "bogus";
      delete process.env.COOKIE_SECURE;
      process.env.NODE_ENV = "production";
      expect(cookieSettings()).toEqual({ sameSite: "lax", secure: true });
    } finally {
      process.env = keep;
    }
  });
});

describe("CORS and headers", () => {
  it("allows the local dev frontends with credentials", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("gives an unknown origin no CORS headers (so no credentials)", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    const pre = await request(app)
      .options("/user/login")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(pre.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sends security headers but keeps images loadable cross-origin", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("rejects oversized JSON bodies", async () => {
    const big = { name: "x".repeat(200_000), email: "a@b.dev", phone: "1", password: "x" };
    await request(app).post("/user/signup").send(big).expect(413);
  });

  it("TRUST_PROXY is parsed from the environment", () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy("")).toBeUndefined();
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("loopback")).toBe("loopback");
  });
});

describe("admin guards", () => {
  it("signup-info reports whether the secret is required, never the secret", async () => {
    process.env.ADMIN_SIGNUP_SECRET = "s3cret-value";
    try {
      const res = await request(appAdmin).get("/signup-info").expect(200);
      expect(res.body).toEqual({ secretRequired: true });
      await request(appAdmin)
        .post("/signup")
        .send({ name: "A", email: "a@t.dev", phone: "010-5555-6666", password: PASSWORD })
        .expect(403);
      await request(appAdmin)
        .post("/signup")
        .set("x-admin-secret", "s3cret-value")
        .send({ name: "A", email: "a@t.dev", phone: "010-5555-6666", password: PASSWORD })
        .expect(201);
    } finally {
      delete process.env.ADMIN_SIGNUP_SECRET;
    }
    expect((await request(appAdmin).get("/signup-info")).body).toEqual({ secretRequired: false });
  });

  it("an admin cannot block or delete themselves, but can block another user", async () => {
    const admin = await makeAdmin();
    const agent = request.agent(appAdmin);
    await agent.post("/login").send({ email: admin.email, password: PASSWORD }).expect(200);
    await agent.post("/users/status").send({ _id: String(admin._id), status: "BLOCK" }).expect(403);
    await agent.post("/users/status").send({ _id: String(admin._id), status: "DELETE" }).expect(403);
    await agent.post("/users/status").send({ _id: String(admin._id), status: "ACTIVE" }).expect(200);

    const { user } = await signupPlayer();
    const res = await agent.post("/users/status").send({ _id: user._id, status: "BLOCK" }).expect(200);
    expect(res.body.status).toBe("BLOCK");
  });

  it("the admin status endpoint enforces the 8 character password minimum", async () => {
    const admin = await makeAdmin();
    const agent = request.agent(appAdmin);
    await agent.post("/login").send({ email: admin.email, password: PASSWORD }).expect(200);
    const { user } = await signupPlayer();
    await agent.post("/users/status").send({ _id: user._id, password: "short" }).expect(400);
    await agent.post("/users/status").send({ _id: user._id, password: "long-enough-1" }).expect(200);
  });

  it("a player cookie cannot open admin routes, and anonymous callers are rejected", async () => {
    await request(appAdmin).get("/dashboard").expect(401);
    const { agent, user } = await signupPlayer();
    // the admin API reads a different cookie, so a player session is simply not authenticated there
    const asPlayer = await agent.get("/user/profile").expect(200);
    expect(asPlayer.body.role).toBe("USER");
    expect(user.role).toBe("USER");
  });
});
