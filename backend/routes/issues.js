const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();

const categories = ["Roads & Potholes", "Waste & Sanitation", "Water Supply", "Streetlights", "Public Safety", "Parks & Public Spaces", "Other"];
const priorities = ["low", "medium", "high"];
const statuses = ["reported", "in_progress", "resolved", "rejected"];
const fields = "id, reporter_id, title, category, priority, location, description, status, created_at, updated_at";

router.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    if (status && !statuses.includes(status)) return res.status(400).json({ error: "Invalid status filter." });
    let query = supabase.from("issues").select(fields).order("created_at", { ascending: false }).limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    // Names are added only for authenticated owners/admins in the frontend, not exposed publicly.
    res.json({ issues: data || [] });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, category, priority = "medium", location, description } = req.body;
    if (typeof title !== "string" || title.trim().length < 5 || title.trim().length > 120) return res.status(400).json({ error: "Title must be between 5 and 120 characters." });
    if (!categories.includes(category)) return res.status(400).json({ error: "Choose a valid category." });
    if (!priorities.includes(priority)) return res.status(400).json({ error: "Choose a valid priority." });
    if (typeof location !== "string" || location.trim().length < 3 || location.trim().length > 180) return res.status(400).json({ error: "Location must be between 3 and 180 characters." });
    if (typeof description !== "string" || description.trim().length < 10 || description.trim().length > 2000) return res.status(400).json({ error: "Description must be between 10 and 2000 characters." });
    const { data, error } = await supabase.from("issues").insert({
      reporter_id: req.user.id, title: title.trim(), category, priority,
      location: location.trim(), description: description.trim()
    }).select(fields).single();
    if (error) throw error;
    res.status(201).json({ issue: data });
  } catch (error) { next(error); }
});

router.patch("/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ error: "Choose a valid status." });
    const { data, error } = await supabase.from("issues").update({ status }).eq("id", req.params.id).select(fields).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Issue not found." });
    res.json({ issue: data });
  } catch (error) { next(error); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { data: issue, error: findError } = await supabase.from("issues").select("id, reporter_id, status").eq("id", req.params.id).maybeSingle();
    if (findError) throw findError;
    if (!issue) return res.status(404).json({ error: "Issue not found." });
    if (issue.reporter_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "You can delete only your own report." });
    if (req.user.role !== "admin" && issue.status !== "reported") return res.status(409).json({ error: "Only reports with Reported status can be deleted by their owner." });
    const { error } = await supabase.from("issues").delete().eq("id", issue.id);
    if (error) throw error;
    res.json({ message: "Issue deleted." });
  } catch (error) { next(error); }
});
module.exports = router;
