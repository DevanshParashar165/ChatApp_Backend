import request from "supertest";
import express from "express";
import userRouter from "../src/routes/user.route.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

const app = express();
app.use(express.json());
app.use("/api/auth", userRouter);
app.use(errorHandler);

describe("Auth API", () => {
  const userPayload = {
    fullname: "Test User",
    email: "test@example.com",
    password: "secret12",
    bio: "Hello world",
  };

  test("signup creates user and returns tokens", async () => {
    const res = await request(app).post("/api/auth/signup").send(userPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(userPayload.email);
  });

  test("signup rejects duplicate email", async () => {
    await request(app).post("/api/auth/signup").send(userPayload);
    const res = await request(app).post("/api/auth/signup").send(userPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test("login returns tokens for valid credentials", async () => {
    await request(app).post("/api/auth/signup").send(userPayload);

    const res = await request(app).post("/api/auth/login").send({
      email: userPayload.email,
      password: userPayload.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  test("login rejects invalid password", async () => {
    await request(app).post("/api/auth/signup").send(userPayload);

    const res = await request(app).post("/api/auth/login").send({
      email: userPayload.email,
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("refresh token returns new access token", async () => {
    const signup = await request(app).post("/api/auth/signup").send(userPayload);

    const res = await request(app).post("/api/auth/refresh").send({
      refreshToken: signup.body.data.refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });
});
