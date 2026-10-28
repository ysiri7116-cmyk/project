const API = "/api";
const $ = (selector) => document.querySelector(selector);
let token = sessionStorage.getItem("civic_token") || "";
let currentUser = null;
let isRegisterMode = false;
let allIssues = [];
let toastTimer;

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function setMessage(text, kind = "info") {
  const el = $("#message");
  el.textContent = text;
  el.classList.remove("hidden");
  if (kind === "error") el.style.background = "#fce8e8";
  else el.style.background = "#fff3dd";
}
function clearMessage() { $("#message").classList.add("hidden"); }
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) logout(false);
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
function safeText(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value ?? "";
  return node;
}
function statusLabel(status) {
  return ({ reported: "Reported", in_progress: "In progress", resolved: "Resolved", rejected: "Rejected" })[status] || status;
}
function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function updateStats(issues) {
  $("#totalStat").textContent = issues.length;
  $("#pendingStat").textContent = issues.filter(i => ["reported", "in_progress"].includes(i.status)).length;
  $("#resolvedStat").textContent = issues.filter(i => i.status === "resolved").length;
}
function renderIssues() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  const visible = allIssues.filter(issue =>
    (!status || issue.status === status) &&
    (`${issue.title} ${issue.location} ${issue.category} ${issue.description}`).toLowerCase().includes(query)
  );
  const list = $("#issuesList");
  list.replaceChildren();
  if (!visible.length) {
    list.append(safeText("div", "empty-state", allIssues.length ? "No reports match these filters." : "No reports yet. Be the first to report a community issue."));
    return;
  }
  visible.forEach(issue => {
    const card = safeText("article", "issue-card", "");
    const top = safeText("div", "issue-top", "");
    const heading = document.createElement("div");
    heading.append(safeText("h3", "", issue.title));
    const meta = safeText("div", "issue-meta", `${issue.category} · ${issue.location}`);
    heading.append(meta);
    top.append(heading, safeText("span", `status ${issue.status}`, statusLabel(issue.status)));
    card.append(top);
    card.append(safeText("p", "issue-description", issue.description));
    const bottom = safeText("div", "issue-meta", `Reported ${formatDate(issue.created_at)} · `);
    bottom.append(safeText("span", `priority ${issue.priority}`, `${issue.priority} priority`));
    card.append(bottom);
    if (currentUser && (currentUser.id === issue.reporter_id || currentUser.role === "admin")) {
      const actions = safeText("div", "issue-actions", "");
      actions.append(safeText("span", "issue-meta", `By ${issue.reporter_name || "Community member"}`));
      if (currentUser.role === "admin") {
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Update status for ${issue.title}`);
        select.className = "small-btn";
        ["reported", "in_progress", "resolved", "rejected"].forEach(value => {
          const option = document.createElement("option");
          option.value = value; option.textContent = statusLabel(value); option.selected = issue.status === value;
          select.append(option);
        });
        select.addEventListener("change", () => updateStatus(issue.id, select.value));
        actions.append(select);
      } else {
        actions.append(safeText("span", "issue-meta", "Your report"));
      }
      if (currentUser.id === issue.reporter_id && issue.status === "reported") {
        const del = safeText("button", "small-btn", "Delete");
        del.type = "button";
        del.addEventListener("click", () => deleteIssue(issue.id));
        actions.append(del);
      }
      card.append(actions);
    }
    list.append(card);
  });
}
async function loadIssues() {
  clearMessage();
  $("#issuesList").replaceChildren(safeText("div", "empty-state", "Loading community reports…"));
  try {
    const data = await api("/issues");
    allIssues = data.issues || [];
    updateStats(allIssues);
    renderIssues();
  } catch (error) {
    $("#issuesList").replaceChildren(safeText("div", "empty-state", "Could not load reports."));
    setMessage(`${error.message} Check your server and Supabase setup.`, "error");
  }
}
function openAuth() {
  $("#authMessage").classList.add("hidden");
  $("#authDialog").showModal();
}
function updateAuthMode() {
  $("#authHeading").textContent = isRegisterMode ? "Create your account" : "Sign in to continue";
  $("#authSubmit").textContent = isRegisterMode ? "Create account" : "Sign in";
  $("#switchPrompt").textContent = isRegisterMode ? "Already registered?" : "New here?";
  $("#switchAuth").textContent = isRegisterMode ? "Sign in" : "Create account";
  $("#password").autocomplete = isRegisterMode ? "new-password" : "current-password";
}
function logout(show = true) {
  token = ""; currentUser = null;
  sessionStorage.removeItem("civic_token");
  $("#logoutBtn").classList.add("hidden");
  if (show) showToast("You have been signed out.");
  renderIssues();
}
async function refreshMe() {
  if (!token) return;
  try {
    const data = await api("/auth/me");
    currentUser = data.user;
    $("#logoutBtn").classList.remove("hidden");
  } catch {
    logout(false);
  }
}
async function updateStatus(id, status) {
  try {
    await api(`/issues/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    showToast("Issue status updated.");
    await loadIssues();
  } catch (error) { showToast(error.message); await loadIssues(); }
}
async function deleteIssue(id) {
  if (!confirm("Delete this report? This action cannot be undone.")) return;
  try {
    await api(`/issues/${encodeURIComponent(id)}`, { method: "DELETE" });
    showToast("Report deleted.");
    await loadIssues();
  } catch (error) { showToast(error.message); }
}
$("#reportForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!token || !currentUser) { openAuth(); return; }
  const form = new FormData(event.currentTarget);
  const body = Object.fromEntries(form.entries());
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = "Submitting…";
  try {
    await api("/issues", { method: "POST", body: JSON.stringify(body) });
    event.currentTarget.reset();
    showToast("Your issue has been reported.");
    await loadIssues();
    $("#issues").scrollIntoView({ behavior: "smooth" });
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.innerHTML = 'Submit report <span>→</span>'; }
});
$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("#authSubmit");
  button.disabled = true; button.textContent = "Please wait…";
  $("#authMessage").classList.add("hidden");
  try {
    const path = isRegisterMode ? "/auth/register" : "/auth/login";
    const data = await api(path, { method: "POST", body: JSON.stringify({ email: $("#email").value.trim(), password: $("#password").value }) });
    if (!data.token) throw new Error(data.message || "Account created. If email confirmation is enabled, confirm your email and then sign in.");
    token = data.token;
    sessionStorage.setItem("civic_token", token);
    currentUser = data.user;
    $("#authDialog").close();
    $("#logoutBtn").classList.remove("hidden");
    showToast(isRegisterMode ? "Account created. You can now report issues." : "Welcome back.");
    await loadIssues();
  } catch (error) {
    $("#authMessage").textContent = error.message;
    $("#authMessage").classList.remove("hidden");
  } finally { button.disabled = false; updateAuthMode(); }
});
$("#switchAuth").addEventListener("click", () => { isRegisterMode = !isRegisterMode; updateAuthMode(); $("#authMessage").classList.add("hidden"); });
$("#logoutBtn").addEventListener("click", () => logout());
$("#refreshBtn").addEventListener("click", loadIssues);
$("#searchInput").addEventListener("input", renderIssues);
$("#statusFilter").addEventListener("change", renderIssues);
document.querySelectorAll('a[href="#report"]').forEach(link => link.addEventListener("click", event => {
  if (!token) { /* Reporting form remains visible; sign-in opens on submit. */ }
}));
(async function init() {
  try {
    const response = await fetch(`${API}/health`);
    if (!response.ok) throw new Error("API unavailable");
  } catch { setMessage("The backend is not running yet. Follow the README setup steps, then refresh this page.", "error"); }
  await refreshMe();
  await loadIssues();
})();
