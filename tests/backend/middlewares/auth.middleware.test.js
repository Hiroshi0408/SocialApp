// auth.middleware.test.js

jest.mock("jsonwebtoken");
jest.mock("../../models/User");
jest.mock("../../utils/logger.js");

const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const logger = require("../../utils/logger.js");
const authMiddleware = require("../../middlewares/auth.middleware");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  test("tra ve 401 neu khong co token", async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "No token provided. Please login.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("tra ve 401 neu token khong co Bearer prefix", async () => {
    const req = { headers: { authorization: "token-value" } };
    const res = createRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "No token provided. Please login.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("tra ve 401 neu jwt khong hop le", async () => {
    const req = { headers: { authorization: "Bearer bad-token" } };
    const res = createRes();
    const next = jest.fn();
    const err = new Error("invalid");
    err.name = "JsonWebTokenError";
    jwt.verify.mockImplementation(() => {
      throw err;
    });

    await authMiddleware(req, res, next);

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("tra ve 401 neu token het han", async () => {
    const req = { headers: { authorization: "Bearer expired-token" } };
    const res = createRes();
    const next = jest.fn();
    const err = new Error("expired");
    err.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => {
      throw err;
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Token expired. Please login again.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("tra ve 401 neu user khong ton tai hoac khong active", async () => {
    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockReturnValue({ id: "user1" });
    User.findById.mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret");
    expect(User.findById).toHaveBeenCalledWith("user1");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid token or user not found",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("gan req.user va goi next neu auth thanh cong", async () => {
    const req = { headers: { authorization: "Bearer good-token" } };
    const res = createRes();
    const next = jest.fn();

    jwt.verify.mockReturnValue({ id: "user123" });
    User.findById.mockResolvedValue({
      _id: "user123",
      username: "nhan",
      email: "nhan@example.com",
      role: "admin",
      status: "active",
      isEmailVerified: true,
      deleted: false,
    });

    await authMiddleware(req, res, next);

    expect(req.user).toEqual({
      id: "user123",
      username: "nhan",
      email: "nhan@example.com",
      role: "admin",
      status: "active",
      isEmailVerified: true,
    });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
