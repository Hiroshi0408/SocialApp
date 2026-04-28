const cron = require("node-cron");
const campaignDAO = require("../dao/campaignDAO");
const charityService = require("../services/charityService");
const logger = require("../utils/logger");

// Số campaign tối đa xử lý mỗi lần chạy (chống tx spam nếu nhiều campaign expire cùng lúc)
const BATCH_SIZE = 20;

let isRunning = false;

async function runExpiryCheck() {
  // Skip nếu blockchain chưa cấu hình (dev không có .env blockchain)
  if (!process.env.CHARITY_ADDRESS) return;

  // Guard chống concurrent run nếu 1 lần chạy mất > 30 phút (Sepolia chậm + nhiều tx)
  if (isRunning) {
    logger.warn("Charity expiry cron: previous run still in progress, skipping");
    return;
  }
  isRunning = true;

  try {
    const expired = await campaignDAO.findMany(
      {
        status: "OPEN",
        onChainStatus: "confirmed",
        deadline: { $lt: new Date() },
      },
      { limit: BATCH_SIZE, lean: true, sort: { deadline: 1 } }
    );

    if (!expired.length) return;

    logger.info(`Charity expiry cron: processing ${expired.length} expired campaign(s)`);

    let ok = 0;
    let skipped = 0;

    for (const campaign of expired) {
      try {
        await charityService.markFailedIfExpired(campaign._id);
        ok++;
        logger.info(
          `Charity expiry: marked FAILED — _id=${campaign._id} onChainId=${campaign.onChainId}`
        );
      } catch (err) {
        // "already met its goal" = race condition donation cuối, expected → skip
        // "not OPEN" = đã được process bởi run khác, expected → skip
        logger.warn(`Charity expiry: skip _id=${campaign._id} — ${err.message}`);
        skipped++;
      }
    }

    if (ok > 0 || skipped > 0) {
      logger.info(`Charity expiry cron done — marked=${ok}, skipped=${skipped}`);
    }
  } catch (err) {
    logger.error("Charity expiry cron fatal error:", err.message);
  } finally {
    isRunning = false;
  }
}

function startCharityExpiryCron() {
  // Mặc định: mỗi 30 phút. Có thể override bằng env CHARITY_EXPIRY_CRON.
  // Ví dụ test nhanh: CHARITY_EXPIRY_CRON="*/2 * * * *" (mỗi 2 phút)
  const schedule = process.env.CHARITY_EXPIRY_CRON || "*/30 * * * *";

  if (!cron.validate(schedule)) {
    logger.error(`Charity expiry cron: invalid schedule "${schedule}", falling back to */30 * * * *`);
    cron.schedule("*/30 * * * *", runExpiryCheck);
  } else {
    cron.schedule(schedule, runExpiryCheck);
  }

  logger.info(`Charity expiry cron started — schedule="${schedule}"`);

  // Chạy 1 lần sau 15s kể từ khi server start để catch campaigns expired khi server đang down.
  // Delay 15s để MongoDB đảm bảo đã connect (connectDatabase không được await ở server.js).
  setTimeout(runExpiryCheck, 15_000);
}

module.exports = { startCharityExpiryCron };
