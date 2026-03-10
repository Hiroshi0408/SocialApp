/**
 * Gemini-based text moderation for user-generated content.
 *
 * Uses the Google GenAI SDK (@google/genai).
 * References:
 * - Gemini API quickstart (JS): https://ai.google.dev/gemini-api/docs/quickstart
 * - Migration guide showing responseSchema/responseMimeType in JS: https://ai.google.dev/gemini-api/docs/migrate
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function clampText(text, maxLen = 4000) {
  if (!text) return "";
  const t = String(text);
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function buildSchema() {
  return {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["allow", "review", "block"] },
      language: { type: "string" },
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            severity: { type: "integer", minimum: 0, maximum: 3 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["name", "severity", "confidence"],
        },
      },
      reasons: { type: "array", items: { type: "string" } },
      suggested_clean_text: { type: "string" },
    },
    required: ["verdict", "language", "categories", "reasons"],
  };
}

/**
 * @param {string} text
 * @returns {Promise<{allowed:boolean, verdict:"allow"|"review"|"block", categories:any[], reasons:string[], suggested_clean_text?:string}>}
 */
async function moderateText(text) {
  if (process.env.ENABLE_GEMINI_MODERATION === "false") {
    return { allowed: true, verdict: "allow", categories: [], reasons: [] };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("Missing GEMINI_API_KEY in environment");
    err.code = "MISSING_GEMINI_API_KEY";
    throw err;
  }

  const content = clampText(text);
  if (!content.trim()) {
    return { allowed: true, verdict: "allow", categories: [], reasons: [] };
  }

  // Dynamic import so this file works in CommonJS projects.
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const schema = buildSchema();

  const prompt = [
    "You are a strict content-moderation classifier for a Vietnamese social network.",
    "Classify the USER_TEXT and decide one verdict: allow, review, or block.",
    "Consider: hate_speech, harassment, sexually_explicit, violence, self_harm, illegal_activity, profanity, spam/scam.",
    "Return ONLY valid JSON matching the provided schema.",
    "Scoring: severity 0=none, 1=low, 2=medium, 3=high. confidence is 0..1.",
    "If verdict is block, include clear short reasons (no policy citations).",
    "If verdict is review, include reasons too.",
    "Language should be a short code like 'vi' or 'en'.",
    "USER_TEXT:\n" + content,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (e) {
    const err = new Error("Gemini moderation response was not valid JSON");
    err.cause = e;
    err.raw = response.text;
    throw err;
  }

  const verdict = (parsed.verdict || "review").toLowerCase();
  const allowed = verdict === "allow";

  return {
    allowed,
    verdict,
    language: parsed.language,
    categories: parsed.categories || [],
    reasons: parsed.reasons || [],
    suggested_clean_text: parsed.suggested_clean_text || "",
  };
}

module.exports = {
  moderateText,
};
