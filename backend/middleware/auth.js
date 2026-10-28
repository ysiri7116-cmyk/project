const supabase = require("../supabase");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(match[1]);
    if (authError || !authData.user) return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id, display_name, role").eq("id", authData.user.id).single();
    if (profileError || !profile) return res.status(403).json({ error: "Your user profile was not found." });
    req.user = { id: authData.user.id, email: authData.user.email, display_name: profile.display_name, role: profile.role };
    req.accessToken = match[1];
    next();
  } catch {
    return res.status(500).json({ error: "Could not verify your session." });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Administrator access is required." });
  next();
}
module.exports = { requireAuth, requireAdmin };
