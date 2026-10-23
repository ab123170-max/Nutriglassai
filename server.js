import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const requestTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 35000);
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(root, "public")));

app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: Boolean(apiKey), databaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) }));

// Supabase URL and publishable/anon key are intended for browser use; database access is protected by RLS.
app.get("/api/config", (_req, res) => res.json({
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
}));

app.post("/api/scan", async (req, res) => {
  try {
    if (!apiKey) return res.status(503).json({ error: "AI is not configured yet. Add GEMINI_API_KEY in your hosting environment." });
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64 || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({ error: "Please provide a JPEG, PNG, or WebP food photo." });
    }
    const prompt = `Identify the visible food cautiously. Return only JSON with keys foodName, confidence (high/medium/low), portionEstimate, calorieMin (integer), calorieMax (integer), basis, suggestion. Calories are estimates, never exact; do not invent hidden ingredients or exact weight. If portion is unclear, say so and use a wider range. Do not label foods morally or tell users they must not eat. Give a short, supportive suggestion for weight management. If no food is visible, foodName must be "Food not identified" and calories 0. The user must confirm before logging.`;
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(requestTimeoutMs),
      body: JSON.stringify({
        model,
        input: [
          { type: "text", text: prompt },
          { type: "image", data: imageBase64, mime_type: mimeType }
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              foodName: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              portionEstimate: { type: "string" },
              calorieMin: { type: "integer" },
              calorieMax: { type: "integer" },
              basis: { type: "string" },
              suggestion: { type: "string" }
            },
            required: ["foodName", "confidence", "portionEstimate", "calorieMin", "calorieMax", "basis", "suggestion"]
          }
        },
        generation_config: { thinking_level: "low", max_output_tokens: 300 }
      })
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      const upstreamMessage = payload?.error?.message || `HTTP ${upstream.status}`;
      console.error("Gemini error:", upstreamMessage);
      const friendly = upstream.status === 429
        ? "AI is busy or the API quota is exhausted. Please wait a little and try again."
        : upstream.status === 400
          ? "Gemini rejected the request. Check the selected model and try a clear food photo."
          : "AI service failed. Check that GEMINI_API_KEY is valid and GEMINI_MODEL is available to your account.";
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: friendly, code: upstream.status === 429 ? "RATE_LIMIT" : "GEMINI_ERROR" });
    }
    let raw = payload?.output_text;
    if (!raw && Array.isArray(payload?.outputs)) {
      raw = payload.outputs.map(o => o?.text || o?.content?.map?.(p => p.text || "").join("") || "").join("").trim();
    }
    if (!raw && Array.isArray(payload?.output)) {
      raw = payload.output.map(o => o?.text || o?.content?.map?.(p => p.text || "").join("") || "").join("").trim();
    }
    if (raw && typeof raw !== "string") raw = JSON.stringify(raw);
    if (!raw) return res.status(502).json({ error: "AI returned no result. Please try again.", code: "EMPTY_AI_RESULT" });
    let result;
    try { result = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "")); }
    catch { console.error("Could not parse Gemini response:", String(raw).slice(0, 500)); return res.status(502).json({ error: "Could not read the AI result. Please try again.", code: "INVALID_AI_JSON" }); }
    const min = Number(result.calorieMin), max = Number(result.calorieMax);
    result.calorieMin = Number.isFinite(min) ? Math.max(0, Math.min(5000, Math.round(min))) : 0;
    result.calorieMax = Number.isFinite(max) ? Math.max(result.calorieMin, Math.min(5000, Math.round(max))) : result.calorieMin;
    res.json(result);
  } catch (err) {
    console.error("Scan error:", err?.name || err, err?.message || "");
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return res.status(504).json({ error: "AI took too long to respond. Try a smaller, clearer photo and scan again.", code: "SCAN_TIMEOUT" });
    }
    res.status(500).json({ error: "Scan failed unexpectedly. Please try again.", code: "SCAN_FAILED" });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));
// Vercel imports this app as a serverless function; local Node runs it directly.
if (process.env.VERCEL !== "1") {
  app.listen(port, () => console.log(`NutriGlass AI running on port ${port}`));
}

export default app;