const express = require("express");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many authentication attempts. Please wait and try again." } });

function validEmail(value) { return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (!validEmail(email) || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Enter a valid email and a password between 8 and 128 characters." });
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0].slice(0, 60) } } });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.session) return res.status(201).json({ message: "Account request received. If email confirmation is enabled, confirm your email before signing in." });
    const { data: profile } = await supabase.from("profiles").select("id, display_name, role").eq("id", data.user.id).single();
    return res.status(201).json({ token: data.session.access_token, user: { id: data.user.id, email: data.user.email, display_name: profile?.display_name || "", role: profile?.role || "citizen" } });
  } catch (error) { next(error); }
});
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (!validEmail(email) || typeof password !== "string" || password.length < 1 || password.length > 128) return res.status(400).json({ error: "Enter a valid email and password." });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) return res.status(401).json({ error: "Email or password is incorrect, or the email is not confirmed." });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, display_name, role").eq("id", data.user.id).single();
    if (profileError || !profile) return res.status(403).json({ error: "Your profile is missing. Please contact the project administrator." });
    res.json({ token: data.session.access_token, user: { id: data.user.id, email: data.user.email, display_name: profile.display_name, role: profile.role } });
  } catch (error) { next(error); }
});
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
module.exports = router;
