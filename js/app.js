/* MovingCheck AI — UI glue. localStorage key: movingcheck.v1 */
(function () {
  "use strict";
  var KEY = "movingcheck.v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  var state = Object.assign({ moveDate: "", done: [], boxes: [], movers: [], tab: "plan", customTasks: [], roomFilter: "" }, load());
  function persist() { save(state); }
  var planQuery = "";

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var WEEKS = [8, 7, 6, 5, 4, 3, 2, 1, 0];
  function weekLabel(w) { return w === 0 ? "Moving day" : w + (w === 1 ? " week before" : " weeks before"); }

  function renderHeader() {
    var el = document.getElementById("moveHead");
    if (!state.moveDate) {
      el.innerHTML = '<div class="ring-wrap" aria-hidden="true"><svg width="128" height="128" viewBox="0 0 128 128"><circle class="ring-bg" cx="64" cy="64" r="56" stroke-width="11"/><circle class="ring-fg" cx="64" cy="64" r="56" stroke-width="11" stroke-dasharray="351.9" stroke-dashoffset="351.9"/></svg><div class="ring-num"><div><b>—</b><span>COMPLETE</span></div></div></div>' +
        '<div class="hero-copy"><h2>Where to?</h2><p class="muted" style="color:#cbb9a4">Set your moving date above and your 8-week route map appears.</p></div>';
      return;
    }
    var days = daysUntil(state.moveDate, todayISO());
    var plan = buildPlan(state.moveDate, todayISO());
    var prog = planProgress(plan, state.done);
    var C = 351.9;
    var off = C - (C * prog.pct / 100);
    var when = days < 0 ? Math.abs(days) + " days ago" : days === 0 ? "today!" : "in " + days + " days";
    el.innerHTML =
      '<div class="ring-wrap" role="img" aria-label="' + prog.pct + '% complete"><svg width="128" height="128" viewBox="0 0 128 128">' +
      '<circle class="ring-bg" cx="64" cy="64" r="56" stroke-width="11"/>' +
      '<circle class="ring-fg" cx="64" cy="64" r="56" stroke-width="11" stroke-dasharray="' + C + '" stroke-dashoffset="' + off + '"/></svg>' +
      '<div class="ring-num"><div><b>' + prog.pct + '%</b><span>COMPLETE</span></div></div></div>' +
      '<div class="hero-copy"><h2>Moving ' + esc(state.moveDate) + '</h2>' +
      '<span class="when">' + esc(when) + '</span></div>' +
      '<div class="hero-stats">' +
      '<div class="stat"><span class="stat-num">' + prog.done + '/' + prog.total + '</span><span class="stat-lbl">tasks done</span></div>' +
      '<div class="stat"><span class="stat-num">' + state.boxes.length + '</span><span class="stat-lbl">boxes packed</span></div>' +
      '<div class="stat"><span class="stat-num">' + state.movers.length + '</span><span class="stat-lbl">mover quotes</span></div>' +
      "</div>";
  }

  function renderPlan() {
    var host = document.getElementById("tab-plan");
    if (!state.moveDate) { host.innerHTML = '<p class="muted">Pick a moving date above to see your week-by-week plan.</p>'; return; }
    var plan = mergePlan(buildPlan(state.moveDate, todayISO()), state.customTasks, state.moveDate, todayISO());
    var doneSet = {}; state.done.forEach(function (id) { doneSet[id] = true; });
    var q = planQuery;
    var html = '<div class="card form-grid" style="margin-bottom:1.25rem">' +
      '<input id="planSearch" placeholder="Search tasks (e.g. insurance)…" value="' + esc(q) + '" aria-label="Search tasks">' +
      '<select id="ctWeek" aria-label="Task week">' +
      [8,7,6,5,4,3,2,1,0].map(function (w) { return '<option value="' + w + '"' + (w === 2 ? " selected" : "") + ">" + esc(weekLabel(w)) + "</option>"; }).join("") +
      '</select>' +
      '<select id="ctCat" aria-label="Task category">' + TASK_CATS.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
      '<input id="ctTitle" placeholder="Add your own task…" maxlength="120">' +
      '<button type="button" id="ctAdd">Add task</button></div>';
    if (q) {
      var hits = filterPlan(plan, q);
      html += '<p class="muted small">' + hits.length + ' match' + (hits.length === 1 ? "" : "es") + ' for "' + esc(q) + '"</p>';
      if (!hits.length) html += '<p class="muted">No tasks match. Try another search, or add it as your own task above.</p>';
      else {
        html += '<ul class="tasks">';
        hits.forEach(function (p) {
          html += taskItemHtml(p, doneSet);
        });
        html += "</ul>";
      }
    } else {
      html += '<div class="route">';
      WEEKS.forEach(function (w) {
        var items = plan.filter(function (p) { return p.week === w; });
        if (!items.length) return;
        var terminal = w === 0 ? " terminal" : "";
        html += '<details class="week' + terminal + '" ' + (w >= 6 || w === 0 ? "open" : "") + '><summary>' +
          '<span class="wk-tag">' + (w === 0 ? "Terminal" : "Week " + w) + "</span>" + esc(weekLabel(w)) +
          ' <span class="count">' + items.filter(function (p) { return doneSet[p.id]; }).length + "/" + items.length + '</span><span class="chev">▾</span></summary><ul class="tasks">';
        items.forEach(function (p) {
          html += taskItemHtml(p, doneSet);
        });
        html += "</ul></details>";
      });
      html += "</div>";
    }
    host.innerHTML = html;
    host.querySelectorAll("input[data-task]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-task");
        var numId = parseInt(id, 10);
        var key = String(numId) === id ? numId : id;
        if (cb.checked) { if (state.done.indexOf(key) < 0) state.done.push(key); }
        else { state.done = state.done.filter(function (x) { return x !== key; }); }
        persist(); renderHeader(); renderPlan();
      });
    });
    host.querySelectorAll("button[data-delct]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.customTasks = removeCustomTask(state.customTasks, btn.getAttribute("data-delct"));
        state.done = state.done.filter(function (x) { return x !== btn.getAttribute("data-delct"); });
        persist(); renderPlan();
      });
    });
    var search = document.getElementById("planSearch");
    search.addEventListener("input", function () {
      planQuery = search.value;
      clearTimeout(search._t);
      search._t = setTimeout(renderPlan, 220);
    });
    document.getElementById("ctAdd").addEventListener("click", function () {
      var title = document.getElementById("ctTitle").value;
      try {
        state.customTasks = addCustomTask(state.customTasks, {
          title: title, week: document.getElementById("ctWeek").value, cat: document.getElementById("ctCat").value
        });
        persist(); renderPlan();
      } catch (err) { alert(err.message); }
    });
  }

  function taskItemHtml(p, doneSet) {
    var cls = doneSet[p.id] ? "done" : (p.overdue ? "overdue" : "");
    return '<li class="' + cls + '"><label><input type="checkbox" data-task="' + esc(p.id) + '"' +
      (doneSet[p.id] ? " checked" : "") + "> <span class='cat'>" + esc(p.cat) + "</span> <span class='task-text'>" + esc(p.task) + "</span>" +
      (p.custom ? ' <span class="badge star">yours</span>' : "") +
      (p.overdue && !doneSet[p.id] ? ' <span class="badge">overdue</span>' : "") +
      ' <span class="due">' + esc(p.due) + "</span>" +
      (p.custom ? ' <button type="button" class="danger ghost small" data-delct="' + esc(p.id) + '">Remove</button>' : "") +
      "</label></li>";
  }

  function renderBoxes() {
    var host = document.getElementById("tab-boxes");
    var rooms = (typeof MOVE_ROOMS !== "undefined") ? MOVE_ROOMS : [];
    var html = '<form id="boxForm" class="card form-grid">' +
      '<input id="boxLabel" placeholder="Box label (e.g. K-03)" required maxlength="20">' +
      '<select id="boxRoom"><option value="">Room…</option>' + rooms.map(function (r) { return '<option>' + esc(r) + "</option>"; }).join("") + "</select>" +
      '<input id="boxContents" placeholder="Contents (e.g. pots, utensils, dish towels)">' +
      '<label class="chk"><input type="checkbox" id="boxFragile"> Fragile</label>' +
      '<label class="chk"><input type="checkbox" id="boxEss"> First-night essentials</label>' +
      '<button type="submit">Add box</button></form>';

    var sug = (typeof FIRST_NIGHT_SUGGESTIONS !== "undefined") ? FIRST_NIGHT_SUGGESTIONS : [];
    html += '<div class="card"><h3>First-night essentials — suggested contents</h3><p class="muted">Pack one clearly-marked box with these; keep it with you, not in the truck.</p><div class="chips">' +
      sug.map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("") + "</div></div>";

    html += '<div class="card" style="margin-top:1.25rem"><h3>Packing supplies estimator</h3>' +
      '<p class="muted">Rough rule of thumb so you can buy supplies in one trip.</p>' +
      '<div class="row" style="align-items:center"><label class="small" style="font-weight:700">Bedrooms: ' +
      '<select id="supBedrooms" style="width:auto;display:inline-block">' +
      [0,1,2,3,4,5,6].map(function (n) { return '<option value="' + n + '">' + n + "</option>"; }).join("") +
      "</select></label></div>" +
      '<div id="supOut" class="small" style="margin-top:.6rem"></div></div>';

    if (!state.boxes.length) { html += '<p class="muted">No boxes yet. Add your first box above.</p>'; }
    else {
      var counts = roomCounts(state.boxes);
      var roomOpts = Object.keys(counts).sort().map(function (r) {
        return '<option value="' + esc(r) + '"' + (state.roomFilter === r ? " selected" : "") + ">" + esc(r) + " (" + counts[r] + ")</option>";
      }).join("");
      html += '<div class="row" style="margin-top:1.25rem;align-items:center">' +
        '<label class="small" style="font-weight:700">Filter by room: <select id="roomFilter" style="width:auto;display:inline-block"><option value="">All rooms (' + state.boxes.length + ")</option>" + roomOpts + "</select></label>" +
        '<button type="button" class="ghost small" id="boxCsv">Export boxes CSV</button></div>';
      var vis = state.boxes.filter(function (b) { return !state.roomFilter || (b.room || "Unassigned") === state.roomFilter; });
      if (!vis.length) html += '<p class="muted">No boxes in this room yet.</p>';
      html += '<div class="boxgrid">';
      vis.forEach(function (b) {
        html += '<div class="card box' + (b.essentials ? " essentials" : "") + '">' +
          '<div class="box-head"><strong>' + esc(b.label) + "</strong>" +
          (b.essentials ? ' <span class="badge star">first-night</span>' : "") +
          (b.fragile ? ' <span class="badge">fragile</span>' : "") + "</div>" +
          (b.room ? '<div class="room-tag">' + esc(b.room) + "</div>" : "") +
          (b.contents ? "<p>" + esc(b.contents) + "</p>" : "") +
          '<div class="row"><button data-ess="' + b.id + '">' + (b.essentials ? "Unmark essentials" : "Mark as essentials") + '</button>' +
          '<button class="danger" data-delbox="' + b.id + '">Remove</button></div></div>';
      });
      html += "</div>";
    }
    host.innerHTML = html;

    document.getElementById("boxForm").addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        state.boxes = addBox(state.boxes, {
          label: document.getElementById("boxLabel").value,
          room: document.getElementById("boxRoom").value,
          contents: document.getElementById("boxContents").value,
          fragile: document.getElementById("boxFragile").checked,
          essentials: document.getElementById("boxEss").checked
        });
        persist(); renderHeader(); renderBoxes();
      } catch (err) { alert(err.message); }
    });
    host.querySelectorAll("[data-delbox]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.boxes = removeBox(state.boxes, btn.getAttribute("data-delbox"));
        persist(); renderHeader(); renderBoxes();
      });
    });
    host.querySelectorAll("[data-ess]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.boxes = toggleEssential(state.boxes, btn.getAttribute("data-ess"));
        persist(); renderBoxes();
      });
    });
    var rf = document.getElementById("roomFilter");
    if (rf) rf.addEventListener("change", function () {
      state.roomFilter = rf.value; persist(); renderBoxes();
    });
    var bc = document.getElementById("boxCsv");
    if (bc) bc.addEventListener("click", function () {
      downloadCsv("movingcheck-boxes.csv", boxesToCSV(state.boxes));
    });
    var supSel = document.getElementById("supBedrooms");
    if (supSel) {
      var renderSup = function () {
        var s = estimateSupplies({ bedrooms: supSel.value });
        document.getElementById("supOut").innerHTML =
          "For a " + s.bedrooms + "-bedroom home, plan on roughly: <strong>" + s.boxes + " boxes</strong>, " +
          s.tapeRolls + " tape rolls, " + s.bubbleWrapRolls + " bubble-wrap roll" + (s.bubbleWrapRolls === 1 ? "" : "s") +
          ", " + s.markers + " marker" + (s.markers === 1 ? "" : "s") +
          (s.mattressBags ? ", " + s.mattressBags + " mattress bag" + (s.mattressBags === 1 ? "" : "s") : "") + ".";
      };
      supSel.addEventListener("change", renderSup);
      renderSup();
    }
  }

  function downloadCsv(filename, csv) {
    var blob = new Blob([csv], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function renderMovers() {
    var host = document.getElementById("tab-movers");
    var html = '<form id="moverForm" class="card form-grid">' +
      '<input id="moverName" placeholder="Company name" required maxlength="60">' +
      '<input id="moverQuote" type="number" min="0" step="1" placeholder="Quote ($)">' +
      '<input id="moverRating" type="number" min="0" max="5" step="0.5" placeholder="Rating (0–5)">' +
      '<input id="moverNotes" placeholder="Notes (insurance, dates, red flags…)">' +
      '<button type="submit">Add mover</button></form>';
    var ranked = rankMovers(state.movers);
    if (!ranked.length) { html += '<p class="muted">No movers yet. Add quotes to compare them side by side.</p>'; }
    else {
      html += '<table class="table"><thead><tr><th></th><th>Company</th><th>Quote</th><th>Rating</th><th>Notes</th><th></th></tr></thead><tbody>';
      ranked.forEach(function (m, i) {
        html += '<tr class="mover-row' + (i === 0 ? " winner" : "") + '">' +
          '<td><span class="mover-rank">' + (i + 1) + "</span>" + (i === 0 ? ' <span class="badge best">Best quote</span>' : "") + "</td>" +
          "<td><strong>" + esc(m.name) + "</strong></td>" +
          '<td class="quote">' + (m.quote ? "$" + Number(m.quote).toLocaleString() : "—") + "</td>" +
          "<td>" + (m.rating ? m.rating.toFixed(1) + "★" : "—") + "</td><td>" + esc(m.notes) + "</td>" +
          '<td><button class="danger ghost small" data-delmover="' + m.id + '">Remove</button></td></tr>';
      });
      html += "</tbody></table>" +
        '<div class="row" style="margin-top:.8rem"><button type="button" class="ghost small" id="moverCsv">Export movers CSV</button></div>';
    }
    host.innerHTML = html;
    document.getElementById("moverForm").addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        state.movers = addMover(state.movers, {
          name: document.getElementById("moverName").value,
          quote: document.getElementById("moverQuote").value,
          rating: document.getElementById("moverRating").value,
          notes: document.getElementById("moverNotes").value
        });
        persist(); renderMovers();
      } catch (err) { alert(err.message); }
    });
    host.querySelectorAll("[data-delmover]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delmover");
        state.movers = state.movers.filter(function (m) { return m.id !== id; });
        persist(); renderMovers();
      });
    });
    var mc = document.getElementById("moverCsv");
    if (mc) mc.addEventListener("click", function () {
      downloadCsv("movingcheck-movers.csv", moversToCSV(state.movers));
    });
  }

  function renderTabs() {
    ["plan", "boxes", "movers"].forEach(function (t) {
      document.getElementById("tabbtn-" + t).classList.toggle("active", state.tab === t);
      document.getElementById("tab-" + t).classList.toggle("hidden", state.tab !== t);
    });
  }

  function renderAll() { renderHeader(); renderTabs(); renderPlan(); renderBoxes(); renderMovers(); }

  document.addEventListener("DOMContentLoaded", function () {
    var dateInput = document.getElementById("moveDate");
    if (state.moveDate) dateInput.value = state.moveDate;
    dateInput.addEventListener("change", function () {
      state.moveDate = dateInput.value; persist(); renderAll();
    });
    ["plan", "boxes", "movers"].forEach(function (t) {
      document.getElementById("tabbtn-" + t).addEventListener("click", function () {
        state.tab = t; persist(); renderTabs();
      });
    });
    document.getElementById("resetAll").addEventListener("click", function () {
      if (confirm("Clear all moving data and start over?")) {
        state = { moveDate: "", done: [], boxes: [], movers: [], tab: "plan", customTasks: [], roomFilter: "" };
        persist(); renderAll(); dateInput.value = "";
      }
    });
    renderAll();
  });
})();
