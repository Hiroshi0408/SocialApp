// errorHandler.test.js

jest.mock("../../utils/logger.js");

const logger = require("../../utils/logger.js");
const AppError = require("../../utils/AppError");
const errorHandler = require("../../middlewares/errorHandler");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("errorHandler", () => {
  const oldNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = oldNodeEnv;
    jest.clearAllMocks();
  });

  test("tra ve dung status va field errors cho AppError", () => {
    const err = new AppError("Validation failed", 400, {
      username: "Username already taken",
    });
    const req = {};
    const res = createRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Validation failed",
      errors: { username: "Username already taken" },
    });
  });

  test("tra ve 500 va an chi tiet loi o production", () => {
    process.env.NODE_ENV = "production";

    const err = new Error("db crash");
    const req = {};
    const res = createRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(logger.error).toHaveBeenCalledWith("UNEXPECTED ERROR:", err);
    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.message).toBe("Something went wrong");
    expect(payload.error).toBeUndefined();
  });

  test("tra ve 500 va hien message loi o development", () => {
    process.env.NODE_ENV = "development";

    const err = new Error("db crash");
    const req = {};
    const res = createRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Something went wrong",
      error: "db crash",
    });
  });
});
