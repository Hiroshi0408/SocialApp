// authService.test.js

// 1. Mock các dependency TRƯỚC KHI import service
jest.mock("../../dao/userDAO");
jest.mock("../../services/emailService");
jest.mock("../../helpers/generate");

// Mock firebaseAdmin để tránh khởi tạo Firebase thật
jest.mock("../../config/firebaseAdmin", () => ({
  auth: jest.fn(),
}));

// 2. Import SAU KHI mock
const authService = require("../../services/authService");
const userDAO = require("../../dao/userDAO");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../../services/emailService");
const { generateToken, generateRawToken } = require("../../helpers/generate");

// ─────────────────────────────────────────────
// Helper: tạo fake user object với các method phổ biến
// ─────────────────────────────────────────────
const makeFakeUser = (overrides = {}) => ({
  _id: "userId123",
  username: "nhan",
  email: "nhan@example.com",
  fullName: "Nhan Nguyen",
  isEmailVerified: false,
  firebaseUid: null,
  avatar: null,
  comparePassword: jest.fn(),
  save: jest.fn(),
  toJSON: jest.fn().mockReturnValue({
    _id: "userId123",
    username: "nhan",
    email: "nhan@example.com",
  }),
  ...overrides,
});

// ─────────────────────────────────────────────
// Setup chung
// ─────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  generateToken.mockReturnValue("fake-jwt-token");
  generateRawToken.mockReturnValue("fake-raw-token");
});

// =============================================================
// register
// =============================================================
describe("register", () => {
  test("throw 400 nếu username đã tồn tại", async () => {
    userDAO.findOne.mockResolvedValue({
      username: "nhan",
      email: "other@example.com",
    });

    await expect(
      authService.register({
        fullName: "Nhan",
        username: "nhan",
        email: "new@example.com",
        password: "123456",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errors: { username: "Username already taken" },
    });
  });

  test("throw 400 nếu email đã tồn tại", async () => {
    userDAO.findOne.mockResolvedValue({
      username: "khac",
      email: "nhan@example.com",
    });

    await expect(
      authService.register({
        fullName: "Nhan",
        username: "nhan_new",
        email: "nhan@example.com",
        password: "123456",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errors: { email: "Email already registered" },
    });
  });

  test("trả về token + user khi đăng ký thành công", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findOne.mockResolvedValue(null);
    userDAO.createUser.mockResolvedValue(fakeUser);
    userDAO.saveVerificationToken.mockResolvedValue();
    sendVerificationEmail.mockResolvedValue();

    const result = await authService.register({
      fullName: "Nhan Nguyen",
      username: "nhan",
      email: "nhan@example.com",
      password: "123456",
    });

    expect(result.token).toBe("fake-jwt-token");
    expect(result.user).toBe(fakeUser);
    expect(result.message).toMatch(/verify/i);
  });

  test("email send fail không block việc đăng ký (vẫn return token)", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findOne.mockResolvedValue(null);
    userDAO.createUser.mockResolvedValue(fakeUser);
    userDAO.saveVerificationToken.mockResolvedValue();
    // Giả lập email server chết
    sendVerificationEmail.mockRejectedValue(new Error("SMTP timeout"));

    const result = await authService.register({
      fullName: "Nhan Nguyen",
      username: "nhan",
      email: "nhan@example.com",
      password: "123456",
    });

    expect(result.token).toBe("fake-jwt-token");
    expect(result.user).toBe(fakeUser);
  });
});

// =============================================================
// login
// =============================================================
describe("login", () => {
  test("throw 400 nếu không truyền identifier hoặc password", async () => {
    await expect(authService.login("", "")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(authService.login("nhan", "")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("throw 401 nếu user không tồn tại", async () => {
    userDAO.findByUsernameOrEmail.mockResolvedValue(null);

    await expect(authService.login("ghost", "123456")).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    });
  });

  test("throw 401 nếu sai password", async () => {
    const fakeUser = makeFakeUser();
    fakeUser.comparePassword.mockResolvedValue(false);
    userDAO.findByUsernameOrEmail.mockResolvedValue(fakeUser);

    await expect(authService.login("nhan", "wrongpass")).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    });
  });

  test("trả về token + user khi đăng nhập thành công", async () => {
    const fakeUser = makeFakeUser();
    fakeUser.comparePassword.mockResolvedValue(true);
    userDAO.findByUsernameOrEmail.mockResolvedValue(fakeUser);

    const result = await authService.login("nhan", "123456");

    expect(result.token).toBe("fake-jwt-token");
    expect(result.message).toMatch(/successful/i);
    expect(fakeUser.toJSON).toHaveBeenCalled();
  });
});

// =============================================================
// getCurrentUser
// =============================================================
describe("getCurrentUser", () => {
  test("throw 404 nếu user không tồn tại", async () => {
    userDAO.findById.mockResolvedValue(null);

    await expect(
      authService.getCurrentUser("nonexistent"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("trả về user khi tìm thấy", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findById.mockResolvedValue(fakeUser);

    const result = await authService.getCurrentUser("userId123");

    expect(result.user).toBeDefined();
    expect(fakeUser.toJSON).toHaveBeenCalled();
  });
});

// =============================================================
// verifyEmail
// =============================================================
describe("verifyEmail", () => {
  test("throw 400 nếu token không hợp lệ hoặc đã hết hạn", async () => {
    userDAO.findByVerificationToken.mockResolvedValue(null);

    await expect(authService.verifyEmail("bad-token")).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid or expired verification token",
    });
  });

  test("trả về user đã verified khi token hợp lệ", async () => {
    const fakeUser = makeFakeUser({ isEmailVerified: true });
    const updatedUser = makeFakeUser({ isEmailVerified: true });
    userDAO.findByVerificationToken.mockResolvedValue(fakeUser);
    userDAO.clearVerificationToken.mockResolvedValue();
    userDAO.findById.mockResolvedValue(updatedUser);

    const result = await authService.verifyEmail("valid-token");

    expect(userDAO.clearVerificationToken).toHaveBeenCalledWith(fakeUser._id);
    expect(result.message).toMatch(/verified/i);
  });
});

// =============================================================
// resendVerification
// =============================================================
describe("resendVerification", () => {
  test("throw 404 nếu user không tồn tại", async () => {
    userDAO.findById.mockResolvedValue(null);

    await expect(
      authService.resendVerification("userId123"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("throw 400 nếu email đã được verified rồi", async () => {
    const fakeUser = makeFakeUser({ isEmailVerified: true });
    userDAO.findById.mockResolvedValue(fakeUser);

    await expect(
      authService.resendVerification("userId123"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Email is already verified",
    });
  });

  test("gửi lại email thành công", async () => {
    const fakeUser = makeFakeUser({ isEmailVerified: false });
    userDAO.findById.mockResolvedValue(fakeUser);
    userDAO.saveVerificationToken.mockResolvedValue();
    sendVerificationEmail.mockResolvedValue();

    const result = await authService.resendVerification("userId123");

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      fakeUser.email,
      fakeUser.username,
      "fake-raw-token",
    );
    expect(result.message).toMatch(/sent/i);
  });
});

// =============================================================
// forgotPassword
// =============================================================
describe("forgotPassword", () => {
  test("trả về cùng 1 message dù email không tồn tại (chống user enumeration)", async () => {
    userDAO.findByEmail.mockResolvedValue(null);

    const result = await authService.forgotPassword("notfound@example.com");

    expect(result.message).toMatch(/if an account exists/i);
    // Không gọi sendPasswordResetEmail khi user không tồn tại
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("gửi email reset khi user tồn tại và trả về cùng message", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findByEmail.mockResolvedValue(fakeUser);
    userDAO.savePasswordResetToken.mockResolvedValue();
    sendPasswordResetEmail.mockResolvedValue();

    const result = await authService.forgotPassword("nhan@example.com");

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      fakeUser.email,
      fakeUser.username,
      "fake-raw-token",
    );
    expect(result.message).toMatch(/if an account exists/i);
  });

  test("throw 500 và rollback token nếu email send fail", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findByEmail.mockResolvedValue(fakeUser);
    userDAO.savePasswordResetToken.mockResolvedValue();
    userDAO.clearPasswordResetToken.mockResolvedValue();
    sendPasswordResetEmail.mockRejectedValue(new Error("SMTP error"));

    await expect(
      authService.forgotPassword("nhan@example.com"),
    ).rejects.toMatchObject({
      statusCode: 500,
    });
    // Phải rollback token khi email fail
    expect(userDAO.clearPasswordResetToken).toHaveBeenCalledWith(fakeUser._id);
  });
});

// =============================================================
// resetPassword
// =============================================================
describe("resetPassword", () => {
  test("throw 400 nếu password quá ngắn (< 6 ký tự)", async () => {
    await expect(
      authService.resetPassword("some-token", "12345"),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("throw 400 nếu token không hợp lệ", async () => {
    userDAO.findByResetToken.mockResolvedValue(null);

    await expect(
      authService.resetPassword("bad-token", "newpass123"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid or expired password reset token",
    });
  });

  test("reset password thành công và trả về token mới", async () => {
    const fakeUser = makeFakeUser();
    fakeUser.save.mockResolvedValue();
    userDAO.findByResetToken.mockResolvedValue(fakeUser);

    const result = await authService.resetPassword("valid-token", "newpass123");

    // Phải dùng user.save() để trigger bcrypt pre-save hook (không dùng updateById)
    expect(fakeUser.save).toHaveBeenCalled();
    expect(fakeUser.password).toBe("newpass123");
    expect(result.token).toBe("fake-jwt-token");
    expect(result.message).toMatch(/successful/i);
  });
});

// =============================================================
// changePassword
// =============================================================
describe("changePassword", () => {
  test("throw 400 nếu thiếu currentPassword hoặc newPassword", async () => {
    await expect(
      authService.changePassword("userId123", "", "newpass"),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      authService.changePassword("userId123", "currentpass", ""),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("throw 400 nếu newPassword quá ngắn", async () => {
    await expect(
      authService.changePassword("userId123", "currentpass", "12345"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("throw 404 nếu user không tồn tại", async () => {
    userDAO.findByIdWithPassword.mockResolvedValue(null);

    await expect(
      authService.changePassword("userId123", "currentpass", "newpass123"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("throw 401 nếu sai currentPassword", async () => {
    const fakeUser = makeFakeUser();
    fakeUser.comparePassword.mockResolvedValue(false);
    userDAO.findByIdWithPassword.mockResolvedValue(fakeUser);

    await expect(
      authService.changePassword("userId123", "wrongpass", "newpass123"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Current password is incorrect",
    });
  });

  test("đổi mật khẩu thành công", async () => {
    const fakeUser = makeFakeUser();
    fakeUser.comparePassword.mockResolvedValue(true);
    fakeUser.save.mockResolvedValue();
    userDAO.findByIdWithPassword.mockResolvedValue(fakeUser);

    const result = await authService.changePassword(
      "userId123",
      "currentpass",
      "newpass123",
    );

    // Phải dùng user.save() để trigger bcrypt hook
    expect(fakeUser.save).toHaveBeenCalled();
    expect(fakeUser.password).toBe("newpass123");
    expect(result.message).toMatch(/successful/i);
  });
});
