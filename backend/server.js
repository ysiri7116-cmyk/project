require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const supabase = require("./supabase");
const authRoutes = require("./routes/auth");
const issueRoutes = require("./routes/issues");

const app = express();
const port = Number(process.env.PORT) || 3000;
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase.from("issues").select("id", { head: true, count: "exact" });
    if (error) throw error;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable", message: "Check the Supabase URL, server key, and database schema." });
  }
});
app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API endpoint not found." });
  res.status(404).send("Page not found.");
});
app.use((err, req, res, next) => {
  // Keep detailed errors in the server console; return a safe message to clients.
  console.error("Request failed:", err.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "An unexpected server error occurred. Please try again." });
});
app.listen(port, () => console.log(`CivicTrack running at http://localhost:${port}`));
