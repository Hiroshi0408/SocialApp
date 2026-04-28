// validation.middleware.test.js

const express = require("express");
const request = require("supertest");

const {
  loginValidation,
  walletLoginValidation,
} = require("../../middlewares/validation.middleware");

const createApp = (path, middlewares) => {
  const app = express();
  app.use(express.json());
  app.post(path, middlewares, (req, res) => {
    res.json({ success: true });
  });
  return app;
};

describe("validation middleware", () => {
  test("loginValidation tra ve 400 khi thieu username", async () => {
    const app = createApp("/login", loginValidation);

    const res = await request(app).post("/login").send({ password: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors.username).toBe("Username or email is required");
  });

  test("loginValidation tra ve 400 khi thieu password", async () => {
    const app = createApp("/login", loginValidation);

    const res = await request(app).post("/login").send({ username: "nhan" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.password).toBe("Password is required");
  });

  test("loginValidation pass voi payload hop le", async () => {
    const app = createApp("/login", loginValidation);

    const res = await request(app).post("/login").send({
      username: "nhan",
      password: "123456",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("walletLoginValidation tra ve 400 neu wallet address khong hop le", async () => {
    const app = createApp("/wallet-login", walletLoginValidation);

    const res = await request(app).post("/wallet-login").send({
      walletAddress: "abc",
      signature: "sig",
      message: "hello",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.walletAddress).toBe("Invalid wallet address");
  });
});
