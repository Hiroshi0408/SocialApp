// role.middleware.test.js

const { requireRole } = require("../../middlewares/role.middleware");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("requireRole", () => {
  test("cho phep role hop le (case-insensitive)", () => {
    const middleware = requireRole("admin", "mod");
    const req = { user: { role: "Admin" } };
    const res = createRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("tu choi neu role khong du quyen", () => {
    const middleware = requireRole("admin", "mod");
    const req = { user: { role: "user" } };
    const res = createRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden: insufficient permissions",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("mac dinh role user neu req.user khong ton tai", () => {
    const middleware = requireRole("admin");
    const req = {};
    const res = createRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
