// organizationService.test.js

jest.mock("../../dao/organizationDAO");
jest.mock("../../dao/groupDAO");
jest.mock("../../services/notificationService");
jest.mock("../../utils/logger");

const organizationService = require("../../services/organizationService");
const organizationDAO = require("../../dao/organizationDAO");
const notificationService = require("../../services/notificationService");

const makeFakeOrg = (overrides = {}) => ({
  _id: "org1",
  name: "Green Hope",
  slug: "green-hope",
  description: "desc",
  logo: "",
  coverImage: "",
  categories: ["environment"],
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  status: "pending",
  verifiedAt: null,
  verifiedBy: null,
  rejectedReason: "",
  proofDocuments: ["proof.jpg"],
  contactEmail: "hello@example.com",
  website: "https://example.com",
  owner: "owner1",
  groupId: null,
  campaignsCount: 0,
  totalRaised: "0",
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  notificationService.createNotification.mockResolvedValue();
});

describe("reject", () => {
  test("xoa organization pending de giai phong wallet/slug khi admin reject", async () => {
    const org = makeFakeOrg();
    organizationDAO.findById.mockResolvedValue(org);
    organizationDAO.deleteById.mockResolvedValue(org);

    const result = await organizationService.reject("admin1", "org1", "Missing proof");

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      recipientId: "owner1",
      senderId: "admin1",
      type: "organization_rejected",
      targetType: "organization",
      targetId: "org1",
      text: 'Đơn đăng ký tổ chức "Green Hope" đã bị từ chối. Lý do: Missing proof',
    });
    expect(organizationDAO.deleteById).toHaveBeenCalledWith("org1");
    expect(organizationDAO.updateById).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: "org1",
        status: "rejected",
        rejectedReason: "Missing proof",
        verifiedBy: "admin1",
      }),
    );
  });

  test("khong cho reject organization da verified", async () => {
    organizationDAO.findById.mockResolvedValue(
      makeFakeOrg({ status: "verified" }),
    );

    await expect(
      organizationService.reject("admin1", "org1", "No"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot reject a verified organization",
    });

    expect(organizationDAO.deleteById).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});

describe("apply", () => {
  test("don rejected application cu cua owner/wallet truoc khi tao don moi", async () => {
    organizationDAO.deleteMany.mockResolvedValue({ deletedCount: 1 });
    organizationDAO.findByWallet.mockResolvedValue(null);
    organizationDAO.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    organizationDAO.create.mockResolvedValue(makeFakeOrg());

    const result = await organizationService.apply("owner1", {
      name: "Green Hope",
      walletAddress: "0x1234567890ABCDEF1234567890ABCDEF12345678",
      description: " desc ",
      proofDocuments: ["proof.pdf"],
    });

    expect(organizationDAO.deleteMany).toHaveBeenCalledWith({
      status: "rejected",
      $or: [
        { owner: "owner1" },
        { walletAddress: "0x1234567890abcdef1234567890abcdef12345678" },
      ],
    });
    expect(organizationDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner1",
        status: "pending",
        slug: "green-hope",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        proofDocuments: ["proof.pdf"],
      }),
    );
    expect(result).toEqual(expect.objectContaining({ status: "pending" }));
  });

  test("bat buoc co proof documents khi tao organization", async () => {
    await expect(
      organizationService.apply("owner1", {
        name: "Green Hope",
        walletAddress: "0x1234567890ABCDEF1234567890ABCDEF12345678",
        proofDocuments: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Proof documents are required",
    });

    expect(organizationDAO.deleteMany).not.toHaveBeenCalled();
    expect(organizationDAO.create).not.toHaveBeenCalled();
  });
});
