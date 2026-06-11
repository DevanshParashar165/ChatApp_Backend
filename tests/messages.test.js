import request from "supertest";
import express from "express";
import userRouter from "../src/routes/user.route.js";
import messageRouter from "../src/routes/message.route.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

const app = express();
app.use(express.json());
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);
app.use(errorHandler);

const registerUser = async (email, name) => {
  const res = await request(app).post("/api/auth/signup").send({
    fullname: name,
    email,
    password: "secret12",
    bio: "test bio",
  });
  return res.body.data;
};

describe("Messages API", () => {
  let userA;
  let userB;

  beforeEach(async () => {
    userA = await registerUser("alice@test.com", "Alice");
    userB = await registerUser("bob@test.com", "Bob");
  });

  test("send message creates message with sent status", async () => {
    const res = await request(app)
      .post(`/api/messages/send/${userB.user._id}`)
      .set("token", userA.token)
      .send({ text: "Hello Bob" });

    expect(res.status).toBe(200);
    expect(res.body.data.newMessage.text).toBe("Hello Bob");
    expect(res.body.data.newMessage.deliveryStatus).toBe("sent");
  });

  test("get messages returns paginated conversation", async () => {
    await request(app)
      .post(`/api/messages/send/${userB.user._id}`)
      .set("token", userA.token)
      .send({ text: "Message 1" });

    const res = await request(app)
      .get(`/api/messages/${userA.user._id}`)
      .set("token", userB.token);

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
    expect(res.body.data.hasMore).toBe(false);
    expect(res.body.data.messages[0].deliveryStatus).toBe("read");
  });

  test("search messages finds text", async () => {
    await request(app)
      .post(`/api/messages/send/${userB.user._id}`)
      .set("token", userA.token)
      .send({ text: "unique searchable phrase" });

    const res = await request(app)
      .get("/api/messages/search")
      .query({ q: "searchable", userId: userB.user._id })
      .set("token", userA.token);

    expect(res.status).toBe(200);
    expect(res.body.data.messages.length).toBeGreaterThan(0);
  });

  test("edit and delete message", async () => {
    const sent = await request(app)
      .post(`/api/messages/send/${userB.user._id}`)
      .set("token", userA.token)
      .send({ text: "Original text" });

    const messageId = sent.body.data.newMessage._id;

    const edited = await request(app)
      .put(`/api/messages/${messageId}`)
      .set("token", userA.token)
      .send({ text: "Edited text" });

    expect(edited.status).toBe(200);
    expect(edited.body.data.message.text).toBe("Edited text");

    const deleted = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set("token", userA.token);

    expect(deleted.status).toBe(200);
  });

  test("rejects empty message body", async () => {
    const res = await request(app)
      .post(`/api/messages/send/${userB.user._id}`)
      .set("token", userA.token)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
