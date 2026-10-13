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

/* ---- Move budget tracker ---- */
var MOVE_EXPENSE_CATS = ["Movers", "Supplies", "Travel", "Deposits & fees", "Cleaning & repairs", "Other"];

function addExpense(expenses, exp) {
  var label = (exp && exp.label || "").trim();
  if (!label) throw new Error("Expense needs a label");
  var amount = parseFloat(exp.amount);
  if (isNaN(amount) || amount <= 0) throw new Error("Expense needs an amount over $0");
  var cat = MOVE_EXPENSE_CATS.indexOf(exp.category) >= 0 ? exp.category : "Other";
  var date = String(exp.date || "").trim();
  var next = (expenses || []).slice();
  next.push({
    id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    label: label,
    category: cat,
    amount: Math.round(amount * 100) / 100,
    date: date,
    note: String(exp.note || "").trim()
  });
  return next;
}

function removeExpense(expenses, id) {
  return (expenses || []).filter(function (e) { return e.id !== id; });
}

/* Totals overall + per category. */
function expenseTotals(expenses) {
  var byCat = {};
  var total = 0;
  (expenses || []).forEach(function (e) {
    var a = Number(e.amount) || 0;
    total += a;
    byCat[e.category] = (byCat[e.category] || 0) + a;
  });
  total = Math.round(total * 100) / 100;
  Object.keys(byCat).forEach(function (k) { byCat[k] = Math.round(byCat[k] * 100) / 100; });
  return { total: total, byCat: byCat, count: (expenses || []).length };
}

/* Spend vs a target budget: {spent, budget, remaining, pct}. */
function budgetVsTarget(expenses, target) {
  var t = expenseTotals(expenses);
  var b = Math.max(0, parseFloat(target) || 0);
  return {
    spent: t.total, budget: b,
    remaining: Math.round((b - t.total) * 100) / 100,
    pct: b > 0 ? Math.round(t.total / b * 100) : 0,
    over: b > 0 && t.total > b
  };
}

function expensesToCSV(expenses) {
  var rows = [["Label", "Category", "Amount ($)", "Date", "Note"]];
  (expenses || []).forEach(function (e) {
    rows.push([e.label, e.category, Number(e.amount).toFixed(2), e.date || "", e.note || ""]);
  });
  return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
}

/* ---- Booked mover ---- */
/* Mark exactly one mover as booked (the one you actually hired). */
function setBookedMover(movers, id) {
  return (movers || []).map(function (m) {
    var c = {}; for (var k in m) c[k] = m[k];
    c.booked = (id && m.id === id) ? true : false;
    return c;
  });
}
function bookedMover(movers) {
  return ((movers || []).filter(function (m) { return m.booked; }))[0] || null;
}

/* ---- Box search: "where did I pack the coffee maker?" ---- */
function searchBoxes(boxes, query) {
  var q = (query || "").trim().toLowerCase();
  if (!q) return (boxes || []).slice();
  return (boxes || []).filter(function (b) {
    return ((b.label || "") + " " + (b.room || "") + " " + (b.contents || ""))
      .toLowerCase().indexOf(q) >= 0;
  });
}

/* ---- Moving-day timeline: hour-by-hour run sheet for the big day ---- */
function validClock(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t || ""); }

function addTimelineEntry(entries, entry) {
  var time = String((entry && entry.time) || "").trim();
  var label = String((entry && entry.label) || "").trim();
  if (!validClock(time)) throw new Error("Timeline entry needs a valid time (HH:MM)");
  if (!label) throw new Error("Timeline entry needs a label");
  var next = (entries || []).slice();
  next.push({
    id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    time: time, label: label
  });
  return sortTimeline(next);
}

function removeTimelineEntry(entries, id) {
  return (entries || []).filter(function (e) { return e.id !== id; });
}

function sortTimeline(entries) {
  return (entries || []).slice().sort(function (a, b) {
    return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0);
  });
}

/* ---- Address-change checklist ---- */
/* The who-to-notify list: utilities, government, money, and everyone else. */
var ADDRESS_TASKS = [
  { id: "usps",    group: "Mail",       task: "File USPS change of address / mail forwarding" },
  { id: "power",   group: "Utilities",  task: "Electric company — stop old, start new" },
  { id: "water",   group: "Utilities",  task: "Water / sewer — stop old, start new" },
  { id: "gas",     group: "Utilities",  task: "Gas company — stop old, start new" },
  { id: "internet",group: "Utilities",  task: "Internet / TV provider — move or cancel service" },
  { id: "trash",   group: "Utilities",  task: "Trash / recycling service at the new address" },
  { id: "dmv",     group: "Government", task: "Driver's license + vehicle registration address" },
  { id: "voter",   group: "Government", task: "Voter registration address" },
  { id: "irs",     group: "Government", task: "IRS / state tax agency address (Form 8822)" },
  { id: "bank",    group: "Money",      task: "Bank + credit card billing addresses" },
  { id: "insurance", group: "Money",    task: "Renters / homeowners + auto insurance address" },
  { id: "employer",group: "Money",      task: "Employer payroll / HR address" },
  { id: "subs",    group: "Everyone else", task: "Subscriptions + recurring deliveries" },
  { id: "pharmacy",group: "Everyone else", task: "Pharmacy + doctor / dentist offices" },
  { id: "school",  group: "Everyone else", task: "Schools — transfer records if needed" },
  { id: "contacts",group: "Everyone else", task: "Tell family, friends, and your emergency contacts" }
];

function addressProgress(taskIds, doneIds) {
  var done = {};
  (doneIds || []).forEach(function (id) { done[id] = true; });
  var total = (taskIds || []).length, n = 0;
  (taskIds || []).forEach(function (id) { if (done[id]) n++; });
  return { total: total, done: n, pct: total ? Math.round(n / total * 100) : 0 };
}

/* ---- Plan -> iCalendar (.ics) ---- */
/* Export the dated plan as a valid ICS file for Google/Apple/Outlook import. */
function icsEscape(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
function icsDate(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? m[1] + m[2] + m[3] : null;
}
function planToICS(plan, eventName) {
  var lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MovingCheck AI//Move plan//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH"
  ];
  (plan || []).forEach(function (p, i) {
    var dt = icsDate(p.due);
    if (!dt) return;
    var title = (p.task || "Move task") + " [" + (p.cat || "Plan") + "]";
    var desc = "Week label: " + (p.week === 0 ? "Moving day" : p.week + " week(s) before") +
      (p.custom ? " (your task)" : "") + ". Planned with MovingCheck AI" +
      (eventName ? " for " + eventName : "");
    lines.push("BEGIN:VEVENT");
    lines.push("UID:mc" + i + "-" + dt + "@movingcheck-ai");
    lines.push("DTSTAMP:" + dt + "T120000Z");
    lines.push("DTSTART;VALUE=DATE:" + dt);
    lines.push("SUMMARY:" + icsEscape(title));
    lines.push("DESCRIPTION:" + icsEscape(desc));
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    daysUntil, buildPlan, planProgress,
    addBox, removeBox, toggleEssential, essentialsBoxes,
    addMover, rankMovers, parseDay, isoDay,
    TASK_CATS, addCustomTask, removeCustomTask, mergePlan, filterPlan,
    roomCounts, boxesToCSV, moversToCSV, estimateSupplies,
    MOVE_EXPENSE_CATS, addExpense, removeExpense, expenseTotals, budgetVsTarget, expensesToCSV,
    setBookedMover, bookedMover,
    searchBoxes,
    addTimelineEntry, removeTimelineEntry, sortTimeline, validClock,
    ADDRESS_TASKS, addressProgress,
    planToICS, icsEscape, icsDate
  };
}
