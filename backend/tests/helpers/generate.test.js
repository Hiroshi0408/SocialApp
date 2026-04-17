// generate.test.js

jest.mock("jsonwebtoken");

const jwt = require("jsonwebtoken");
const {
  generateRandomString,
  generateRandomNumber,
  generateToken,
  generateRawToken,
} = require("../../helpers/generate");

describe("generate helper", () => {
  const oldJwtSecret = process.env.JWT_SECRET;
  const oldJwtExpire = process.env.JWT_EXPIRE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRE = "7d";
  });

  afterAll(() => {
    process.env.JWT_SECRET = oldJwtSecret;
    process.env.JWT_EXPIRE = oldJwtExpire;
  });

  test("generateRandomString tao chuoi dung do dai va charset", () => {
    const result = generateRandomString(32);

    expect(result).toHaveLength(32);
    expect(result).toMatch(/^[A-Za-z0-9]+$/);
  });

  test("generateRandomNumber tao so dung so chu so", () => {
    const result = generateRandomNumber(6);

    expect(result).toBeGreaterThanOrEqual(100000);
    expect(result).toBeLessThanOrEqual(999999);
    expect(String(result)).toHaveLength(6);
  });

  test("generateToken goi jwt.sign voi payload va expiresIn dung", () => {
    jwt.sign.mockReturnValue("jwt-token");

    const token = generateToken("user123", "nhan");

    expect(jwt.sign).toHaveBeenCalledWith(
      { id: "user123", username: "nhan" },
      "test-secret",
      { expiresIn: "7d" },
    );
    expect(token).toBe("jwt-token");
  });

  test("generateToken fallback ve JWT_EXPIRATION khi JWT_EXPIRE khong duoc set", () => {
    jwt.sign.mockReturnValue("jwt-token");
    delete process.env.JWT_EXPIRE;

    generateToken("user123", "nhan");

    expect(jwt.sign).toHaveBeenCalledWith(
      { id: "user123", username: "nhan" },
      "test-secret",
      { expiresIn: "7d" },
    );
  });

  test("generateRawToken tao chuoi hex 64 ky tu", () => {
    const token = generateRawToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });
});
