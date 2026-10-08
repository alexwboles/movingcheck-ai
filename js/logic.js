/* MovingCheck AI — pure planning logic. Testable in Node (UMD). */

function getBank() {
  if (typeof CHECKLIST_TEMPLATE !== "undefined" && CHECKLIST_TEMPLATE) {
    return { t: CHECKLIST_TEMPLATE, rooms: (typeof MOVE_ROOMS !== "undefined" ? MOVE_ROOMS : []) };
  }
  if (typeof require !== "undefined") {
    var b = require("./movebank.js");
    return { t: b.CHECKLIST_TEMPLATE, rooms: b.MOVE_ROOMS };
  }
  return { t: [], rooms: [] };
}

function parseDay(iso) {
  var d = new Date(iso + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function isoDay(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* Whole days from today until the move (negative = past). */
function daysUntil(moveISO, todayISO) {
  var m = parseDay(moveISO), t = parseDay(todayISO);
  if (!m || !t) return null;
  return Math.round((m - t) / 86400000);
}

/* Build the dated plan: each template task gets a scheduled date = move - week*7. */
function buildPlan(moveISO, todayISO) {
  var bank = getBank().t;
  var m = parseDay(moveISO), t = parseDay(todayISO);
  if (!m || !t) return [];
  return bank.map(function (it, i) {
    var due = new Date(m.getTime() - it.week * 7 * 86400000);
    return {
      id: i, week: it.week, cat: it.cat, task: it.task,
      due: isoDay(due),
      overdue: due < t && it.week > 0
    };
  });
}

/* Progress: doneIds is an array of task ids. */
function planProgress(plan, doneIds) {
  var done = {};
  (doneIds || []).forEach(function (id) { done[id] = true; });
  var total = plan.length, n = 0;
  plan.forEach(function (p) { if (done[p.id]) n++; });
  return { total: total, done: n, pct: total ? Math.round(n / total * 100) : 0 };
}

/* ---- Box inventory ---- */
function addBox(boxes, box) {
  var label = (box && box.label || "").trim();
  if (!label) throw new Error("Box needs a label");
  var next = (boxes || []).slice();
  next.push({
    id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    label: label,
    room: (box.room || "").trim(),
    contents: (box.contents || "").trim(),
    fragile: !!box.fragile,
    essentials: !!box.essentials
  });
  return next;
}

function removeBox(boxes, id) {
  return (boxes || []).filter(function (b) { return b.id !== id; });
}

function toggleEssential(boxes, id) {
  return (boxes || []).map(function (b) {
    if (b.id !== id) return b;
    var c = {}; for (var k in b) c[k] = b[k];
    c.essentials = !c.essentials;
    return c;
  });
}

function essentialsBoxes(boxes) {
  return (boxes || []).filter(function (b) { return b.essentials; });
}

/* ---- Mover comparison ---- */
function addMover(movers, mover) {
  var name = (mover && mover.name || "").trim();
  if (!name) throw new Error("Mover needs a name");
  var q = parseFloat(mover.quote);
  var next = (movers || []).slice();
  next.push({
    id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name: name,
    quote: isNaN(q) || q < 0 ? 0 : q,
    rating: Math.max(0, Math.min(5, parseFloat(mover.rating) || 0)),
    notes: (mover.notes || "").trim()
  });
  return next;
}

/* Cheapest valid quote first; ties broken by higher rating. */
function rankMovers(movers) {
  return (movers || []).slice().sort(function (a, b) {
    if (a.quote !== b.quote) return a.quote - b.quote;
    return b.rating - a.rating;
  });
}

/* ---- Custom user tasks ---- */
var TASK_CATS = ["Declutter", "Packing", "Admin", "Research", "Plan", "Moving day"];

function addCustomTask(tasks, task) {
  var title = (task && task.title || "").trim();
  if (!title) throw new Error("Task needs a title");
  var week = task.week === undefined || task.week === null ? 2 : parseInt(task.week, 10);
  if (isNaN(week) || week < 0 || week > 8) throw new Error("Week must be between 0 and 8");
  var cat = TASK_CATS.indexOf(task.cat) >= 0 ? task.cat : "Plan";
  var next = (tasks || []).slice();
  next.push({
    id: "u" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    title: title, week: week, cat: cat, custom: true
  });
  return next;
}

function removeCustomTask(tasks, id) {
  return (tasks || []).filter(function (t) { return t.id !== id; });
}

/* Merge template plan + user tasks into one dated list. */
function mergePlan(plan, customTasks, moveISO, todayISO) {
  var m = parseDay(moveISO), t = parseDay(todayISO);
  var out = (plan || []).slice();
  (customTasks || []).forEach(function (ct) {
    var due = m ? new Date(m.getTime() - ct.week * 7 * 86400000) : null;
    out.push({
      id: ct.id, week: ct.week, cat: ct.cat, task: ct.title,
      due: due ? isoDay(due) : "",
      overdue: !!(due && t && due < t && ct.week > 0),
      custom: true
    });
  });
  return out;
}

/* Search across a dated plan: match task text or category (case-insensitive). */
function filterPlan(plan, query) {
  var q = (query || "").trim().toLowerCase();
  if (!q) return (plan || []).slice();
  return (plan || []).filter(function (p) {
    return (p.task + " " + p.cat).toLowerCase().indexOf(q) >= 0;
  });
}

/* ---- Room counts + CSV export ---- */
function roomCounts(boxes) {
  var counts = {};
  (boxes || []).forEach(function (b) {
    var r = (b.room || "").trim() || "Unassigned";
    counts[r] = (counts[r] || 0) + 1;
  });
  return counts;
}

function csvCell(v) {
  var s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function boxesToCSV(boxes) {
  var rows = [["Label", "Room", "Contents", "Fragile", "First-night essentials"]];
  (boxes || []).forEach(function (b) {
    rows.push([b.label, b.room, b.contents, b.fragile ? "yes" : "no", b.essentials ? "yes" : "no"]);
  });
  return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
}

function moversToCSV(movers) {
  var rows = [["Company", "Quote", "Rating", "Notes"]];
  (movers || []).forEach(function (m) {
    rows.push([m.name, m.quote, m.rating, m.notes]);
  });
  return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
}

/* ---- Packing supplies estimator ---- */
/* Rough rule-of-thumb: ~15 boxes per bedroom + 10 for shared spaces, scaled. */
function estimateSupplies(opts) {
  var bedrooms = Math.max(0, Math.min(8, parseInt((opts || {}).bedrooms, 10) || 0));
  var boxes = 10 + bedrooms * 15;
  return {
    bedrooms: bedrooms,
    boxes: boxes,
    tapeRolls: Math.max(2, Math.ceil(boxes / 12)),
    bubbleWrapRolls: Math.max(1, Math.ceil(boxes / 20)),
    markers: Math.max(1, Math.ceil(boxes / 30)),
    mattressBags: bedrooms
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    daysUntil, buildPlan, planProgress,
    addBox, removeBox, toggleEssential, essentialsBoxes,
    addMover, rankMovers, parseDay, isoDay,
    TASK_CATS, addCustomTask, removeCustomTask, mergePlan, filterPlan,
    roomCounts, boxesToCSV, moversToCSV, estimateSupplies
  };
}
