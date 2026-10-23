import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(root, "public")));

app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: Boolean(apiKey) }));

app.post("/api/scan", async (req, res) => {
  try {
    if (!apiKey) return res.status(503).json({ error: "AI is not configured yet. Add GEMINI_API_KEY in your hosting environment." });
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64 || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({ error: "Please provide a JPEG, PNG, or WebP food photo." });
    }
    const prompt = `Identify the visible food cautiously. Return only JSON with keys foodName, confidence (high/medium/low), portionEstimate, calorieMin (integer), calorieMax (integer), basis, suggestion. Calories are estimates, never exact; do not invent hidden ingredients or exact weight. If portion is unclear, say so and use a wider range. Do not label foods morally or tell users they must not eat. Give a short, supportive suggestion for weight management. If no food is visible, foodName must be "Food not identified" and calories 0. The user must confirm before logging.`;
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      })
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      console.error("Gemini error:", payload?.error?.message || upstream.status);
      return res.status(502).json({ error: "AI could not analyze this photo. Check the server API key and model." });
    }
    const raw = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!raw) return res.status(502).json({ error: "AI returned no result. Please try again." });
    let result;
    try { result = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "")); }
    catch { return res.status(502).json({ error: "Could not read the AI result. Please try another photo." }); }
    const min = Number(result.calorieMin), max = Number(result.calorieMax);
    result.calorieMin = Number.isFinite(min) ? Math.max(0, Math.min(5000, Math.round(min))) : 0;
    result.calorieMax = Number.isFinite(max) ? Math.max(result.calorieMin, Math.min(5000, Math.round(max))) : result.calorieMin;
    res.json(result);
  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ error: "Something went wrong while scanning. Please try again." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));
app.listen(port, () => console.log(`NutriGlass AI running on port ${port}`));