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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    daysUntil, buildPlan, planProgress,
    addBox, removeBox, toggleEssential, essentialsBoxes,
    addMover, rankMovers, parseDay, isoDay
  };
}
