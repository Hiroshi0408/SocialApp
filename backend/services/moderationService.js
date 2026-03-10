const http = require("http");
const https = require("https");

/**
 * Simple text moderation client (Vietnamese).
 *
 * Expected moderation service API:
 *  POST /predict  { text: string }
 *  -> { label: string, score: number, scores: Record<string, number> }
 */

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

function httpJson(urlStr, path, payload, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload);

    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: (u.pathname || "").replace(/\/$/, "") + path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data || "{}"));
            } catch (e) {
              reject(new Error("Invalid JSON from moderation service"));
            }
          } else {
            reject(
              new Error(
                `Moderation service error: ${res.statusCode || "?"} ${data}`
              )
            );
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Moderation service timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Moderate a Vietnamese text.
 * Returns an object safe to expose to client.
 */
async function moderateText(text) {
  const enabled = parseBool(process.env.MODERATION_ENABLED, true);
  const serviceUrl = process.env.MODERATION_SERVICE_URL || "http://127.0.0.1:8001";
  const threshold = Number(process.env.MODERATION_THRESHOLD || 0.6);
  const failOpen = parseBool(process.env.MODERATION_FAIL_OPEN, true);
  const blockLabels = (process.env.MODERATION_BLOCK_LABELS || "offensive,hate")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const cleanText = (text ?? "").toString();

  if (!enabled) {
    return { enabled: false, blocked: false, label: "disabled", score: 0, scores: {} };
  }

  // Empty text -> allow
  if (!cleanText.trim()) {
    return { enabled: true, blocked: false, label: "empty", score: 0, scores: {} };
  }

  try {
    const result = await httpJson(serviceUrl, "/predict", { text: cleanText });
    const label = String(result.label || "").toLowerCase();
    const score = Number(result.score || 0);
    const scores = result.scores && typeof result.scores === "object" ? result.scores : {};

    const blocked = blockLabels.includes(label) && score >= threshold;
    return {
      enabled: true,
      blocked,
      label,
      score,
      threshold,
      blockLabels,
      scores,
      provider: "nd-khoa/vihsd-uit-visobert",
    };
  } catch (err) {
    // Fail-open by default so posting doesn't break if ML service is down.
    return {
      enabled: true,
      blocked: failOpen ? false : true,
      label: "service_error",
      score: 0,
      threshold,
      blockLabels,
      scores: {},
      provider: "nd-khoa/vihsd-uit-visobert",
      error: err?.message || String(err),
      failOpen,
    };
  }
}

module.exports = { moderateText };
