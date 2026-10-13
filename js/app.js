/* MovingCheck AI — UI glue. localStorage key: movingcheck.v1 */
(function () {
  "use strict";
  var KEY = "movingcheck.v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  var state = Object.assign({ moveDate: "", done: [], boxes: [], movers: [], tab: "plan", customTasks: [], roomFilter: "", expenses: [], moveBudget: "", timeline: [], timelineDone: [], addressDone: [] }, load());
  function persist() { save(state); }
  var planQuery = "";
  var boxQuery = "";

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
    var tminus = days < 0 ? "T+" + Math.abs(days) : "T\u2013" + days;
    var tlabel = days < 0 ? "days since moving day" : days === 1 ? "day to moving day" : "days to moving day";
    var bk = bookedMover(state.movers);
    var spend = expenseTotals(state.expenses).total;
    el.innerHTML =
      '<div class="ring-wrap" role="img" aria-label="' + prog.pct + '% complete"><svg width="128" height="128" viewBox="0 0 128 128">' +
      '<circle class="ring-bg" cx="64" cy="64" r="56" stroke-width="11"/>' +
      '<circle class="ring-fg" cx="64" cy="64" r="56" stroke-width="11" stroke-dasharray="' + C + '" stroke-dashoffset="' + off + '"/></svg>' +
      '<div class="ring-num"><div><b>' + prog.pct + '%</b><span>COMPLETE</span></div></div></div>' +
      '<div class="hero-copy"><div class="tminus"><b>' + tminus + '</b><span>' + tlabel + '</span></div>' +
      '<h2 class="move-date-line">Moving ' + esc(state.moveDate) + '</h2>' +
      (bk ? '<div class="booked-line">Booked: <strong>' + esc(bk.name) + '</strong>' + (bk.quote ? ' · $' + Number(bk.quote).toLocaleString() : '') + '</div>' : '') +
      '</div>' +
      '<div class="hero-stats">' +
      '<div class="stat"><span class="stat-num">' + prog.done + '/' + prog.total + '</span><span class="stat-lbl">tasks done</span></div>' +
      '<div class="stat"><span class="stat-num">' + state.boxes.length + '</span><span class="stat-lbl">boxes packed</span></div>' +
      '<div class="stat"><span class="stat-num">' + state.movers.length + '</span><span class="stat-lbl">mover quotes</span></div>' +
      '<div class="stat"><span class="stat-num">$' + spend.toLocaleString() + '</span><span class="stat-lbl">move spend</span></div>' +
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
      '<button type="button" id="ctAdd">Add task</button></div>' +
      '<div class="row" style="margin-bottom:1.25rem"><button type="button" class="ghost small" id="planIcs">Export plan as calendar (.ics)</button></div>';
    var focus = focusTasks(plan, state.done, todayISO());
    if (focus.total && !q) {
      html += '<div class="card focus"><h3>Up next</h3>';
      if (focus.overdue.length) {
        html += '<p class="focus-lbl overdue-lbl">' + focus.overdue.length + ' overdue \u2014 do these first</p><ul class="tasks">' +
          focus.overdue.map(function (p) { return taskItemHtml(p, doneSet); }).join("") + '</ul>';
      }
      if (focus.thisWeek.length) {
        html += '<p class="focus-lbl">Due in the next 7 days</p><ul class="tasks">' +
          focus.thisWeek.map(function (p) { return taskItemHtml(p, doneSet); }).join("") + '</ul>';
      }
      html += '</div>';
    }
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
    renderTimeline(host);
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
    document.getElementById("planIcs").addEventListener("click", function () {
      var full = mergePlan(buildPlan(state.moveDate, todayISO()), state.customTasks, state.moveDate, todayISO());
      if (!full.length) { alert("Set a moving date first."); return; }
      var blob = new Blob([planToICS(full, "moving " + state.moveDate)], { type: "text/calendar" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "movingcheck-plan.ics";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  }

  /* Moving-day run sheet: hour-by-hour timeline for the big day. */
  function renderTimeline(host) {
    var card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "1.5rem";
    var doneSet = {};
    (state.timelineDone || []).forEach(function (id) { doneSet[id] = true; });
    var entries = sortTimeline(state.timeline || []);
    var html = '<h3>Moving-day run sheet</h3>' +
      '<p class="muted">Hour-by-hour for the big day itself' +
      (state.moveDate ? ' — ' + esc(state.moveDate) : '') +
      '. Times sort themselves; check items off as the day unfolds.</p>' +
      '<div class="row" style="align-items:center">' +
      '<input type="time" id="tlTime" value="08:00" aria-label="Timeline time" style="width:auto">' +
      '<input id="tlLabel" placeholder="What happens (e.g. Movers arrive)" maxlength="120" style="flex:1;min-width:180px">' +
      '<button type="button" id="tlAdd">Add to timeline</button></div>';
    if (!entries.length) {
      html += '<p class="muted">No timeline yet — add the first entry above.</p>';
    } else {
      html += '<ul class="tasks timeline">';
      entries.forEach(function (e) {
        var done = !!doneSet[e.id];
        html += '<li class="' + (done ? "done" : "") + '"><label>' +
          '<input type="checkbox" data-tl="' + esc(e.id) + '"' + (done ? " checked" : "") + "> " +
          '<span class="tl-time">' + esc(e.time) + "</span> " +
          '<span class="task-text">' + esc(e.label) + "</span></label>" +
          ' <button type="button" class="danger ghost small" data-deltl="' + esc(e.id) + '">Remove</button></li>';
      });
      html += "</ul>";
    }
    card.innerHTML = html;
    host.appendChild(card);
    document.getElementById("tlAdd").addEventListener("click", function () {
      try {
        state.timeline = addTimelineEntry(state.timeline || [], {
          time: document.getElementById("tlTime").value,
          label: document.getElementById("tlLabel").value
        });
        persist(); renderPlan();
      } catch (err) { alert(err.message); }
    });
    card.querySelectorAll("[data-deltl]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.timeline = removeTimelineEntry(state.timeline || [], btn.getAttribute("data-deltl"));
        state.timelineDone = (state.timelineDone || []).filter(function (x) { return x !== btn.getAttribute("data-deltl"); });
        persist(); renderPlan();
      });
    });
    card.querySelectorAll("[data-tl]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-tl");
        if (cb.checked) { if ((state.timelineDone || []).indexOf(id) < 0) state.timelineDone.push(id); }
        else { state.timelineDone = (state.timelineDone || []).filter(function (x) { return x !== id; }); }
        persist(); renderPlan();
      });
    });
  }

  function taskItemHtml(p, doneSet) {    var cls = doneSet[p.id] ? "done" : (p.overdue ? "overdue" : "");
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
        '<input id="boxSearch" type="search" placeholder="Where did I pack…? (e.g. coffee maker)" value="' + esc(boxQuery) + '" aria-label="Search boxes" style="flex:1;min-width:180px">' +
        '<label class="small" style="font-weight:700">Filter by room: <select id="roomFilter" style="width:auto;display:inline-block"><option value="">All rooms (' + state.boxes.length + ")</option>" + roomOpts + "</select></label>" +
        '<button type="button" class="ghost small" id="boxCsv">Export boxes CSV</button> ' +
        '<button type="button" class="ghost small" id="boxLabels">Print box labels</button></div>';
      var vis = searchBoxes(state.boxes.filter(function (b) { return !state.roomFilter || (b.room || "Unassigned") === state.roomFilter; }), boxQuery);
      if (boxQuery) html += '<p class="muted small">' + vis.length + ' match' + (vis.length === 1 ? "" : "es") + ' for "' + esc(boxQuery) + '"</p>';
      if (!vis.length) html += '<p class="muted">' + (boxQuery ? 'No boxes match your search.' : 'No boxes in this room yet.') + '</p>';
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
    var bs = document.getElementById("boxSearch");
    if (bs) bs.addEventListener("input", function () {
      boxQuery = bs.value;
      clearTimeout(bs._t);
      bs._t = setTimeout(renderBoxes, 220);
    });
    var bc = document.getElementById("boxCsv");
    if (bc) bc.addEventListener("click", function () {
      downloadCsv("movingcheck-boxes.csv", boxesToCSV(state.boxes));
    });
    var bl = document.getElementById("boxLabels");
    if (bl) bl.addEventListener("click", function () {
      if (!state.boxes.length) { alert("Add a box first."); return; }
      var sheet = document.createElement("div");
      sheet.className = "label-sheet";
      sheet.innerHTML = state.boxes.map(function (b) {
        return '<div class="box-label"><div class="bl-name">' + esc(b.label) + '</div>' +
          (b.room ? '<div class="bl-room">' + esc(b.room) + '</div>' : '') +
          '<div class="bl-flags">' +
          (b.fragile ? '<span>FRAGILE</span>' : '') +
          (b.essentials ? '<span>FIRST-NIGHT</span>' : '') + '</div>' +
          (b.contents ? '<div class="bl-contents">' + esc(b.contents) + '</div>' : '') + '</div>';
      }).join("");
      document.body.appendChild(sheet);
      document.body.classList.add("printing-labels");
      window.print();
      setTimeout(function () { sheet.remove(); document.body.classList.remove("printing-labels"); }, 500);
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
        html += '<tr class="mover-row' + (i === 0 ? " winner" : "") + (m.booked ? " booked" : "") + '">' +
          '<td><span class="mover-rank">' + (i + 1) + "</span>" + (i === 0 ? ' <span class="badge best">Best quote</span>' : "") +
          (m.booked ? ' <span class="badge booked-badge">Booked</span>' : "") + "</td>" +
          "<td><strong>" + esc(m.name) + "</strong></td>" +
          '<td class="quote">' + (m.quote ? "$" + Number(m.quote).toLocaleString() : "—") + "</td>" +
          "<td>" + (m.rating ? m.rating.toFixed(1) + "★" : "—") + "</td><td>" + esc(m.notes) + "</td>" +
          '<td><button class="ghost small" data-bookmover="' + m.id + '">' + (m.booked ? "Unbook" : "Book") + '</button> ' +
          '<button class="danger ghost small" data-delmover="' + m.id + '">Remove</button></td></tr>';
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
    host.querySelectorAll("[data-bookmover]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-bookmover");
        var cur = bookedMover(state.movers);
        state.movers = setBookedMover(state.movers, cur && cur.id === id ? null : id);
        persist(); renderHeader(); renderMovers();
      });
    });
    var mc = document.getElementById("moverCsv");
    if (mc) mc.addEventListener("click", function () {
      downloadCsv("movingcheck-movers.csv", moversToCSV(state.movers));
    });
  }

  function renderTabs() {
    ["plan", "boxes", "movers", "budget", "address"].forEach(function (t) {
      document.getElementById("tabbtn-" + t).classList.toggle("active", state.tab === t);
      document.getElementById("tab-" + t).classList.toggle("hidden", state.tab !== t);
    });
  }

  function moneyFmt(n) { return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }

  function renderBudget() {
    var host = document.getElementById("tab-budget");
    var t = expenseTotals(state.expenses);
    var vs = budgetVsTarget(state.expenses, state.moveBudget);
    var html = '<div class="card"><h3>Move budget</h3>' +
      '<p class="muted">Set a target so you can see at a glance whether the move is staying on budget.</p>' +
      '<div class="row" style="align-items:center"><label class="small" style="font-weight:700">Target budget ($) ' +
      '<input id="budgetTarget" type="number" min="0" step="1" value="' + esc(state.moveBudget) + '" style="width:140px;display:inline-block"></label></div>';
    if (state.moveBudget && Number(state.moveBudget) > 0) {
      var pct = Math.min(100, vs.pct);
      html += '<div class="bar" style="margin-top:.8rem"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<p class="small" style="margin-top:.5rem">Spent <strong>' + moneyFmt(vs.spent) + '</strong> of ' + moneyFmt(vs.budget) +
        ' (' + vs.pct + '%) — ' + (vs.over
          ? '<strong style="color:#a33">over by ' + moneyFmt(vs.spent - vs.budget) + '</strong>'
          : moneyFmt(vs.remaining) + ' remaining') + '</p>';
    } else {
      html += '<p class="small muted" style="margin-top:.6rem">Total spend so far: <strong>' + moneyFmt(t.total) + '</strong></p>';
    }
    html += '</div>';

    html += '<form id="expForm" class="card form-grid" style="margin-top:1.25rem">' +
      '<input id="expLabel" placeholder="Expense (e.g. Truck rental)" required maxlength="80">' +
      '<select id="expCat">' + MOVE_EXPENSE_CATS.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" +
      '<input id="expAmount" type="number" min="0.01" step="0.01" placeholder="Amount ($)" required>' +
      '<input id="expDate" type="date">' +
      '<input id="expNote" placeholder="Note (optional)" maxlength="140">' +
      '<button type="submit">Add expense</button></form>';

    if (state.expenses.length) {
      var cats = MOVE_EXPENSE_CATS.filter(function (c) { return t.byCat[c]; });
      html += '<div class="card" style="margin-top:1.25rem"><h3>Spend by category</h3>' +
        cats.map(function (c) {
          var w = t.total ? Math.round(t.byCat[c] / t.total * 100) : 0;
          return '<div class="kv"><span>' + esc(c) + '</span><span><strong>' + moneyFmt(t.byCat[c]) + '</strong> (' + w + '%)</span></div>' +
            '<div class="bar" style="margin:.2rem 0 .8rem"><div class="bar-fill" style="width:' + w + '%"></div></div>';
        }).join("") +
        '<div class="row" style="margin-top:.8rem"><button type="button" class="ghost small" id="expCsv">Export expenses CSV</button></div></div>';

      html += '<div class="card" style="margin-top:1.25rem"><h3>Expenses (' + t.count + ')</h3><div class="grow">' +
        state.expenses.slice().reverse().map(function (e) {
          return '<div class="grow-item"><div><b>' + esc(e.label) + '</b>' +
            '<div class="muted small">' + esc(e.category) + (e.date ? ' · ' + esc(e.date) : '') + (e.note ? ' · ' + esc(e.note) : '') + '</div></div>' +
            '<div class="muted"><strong>' + moneyFmt(e.amount) + '</strong></div>' +
            '<button class="danger ghost small" data-delexp="' + e.id + '">Remove</button></div>';
        }).join("") + '</div></div>';
    } else {
      html += '<p class="muted">No expenses yet — add the first one above.</p>';
    }
    host.innerHTML = html;

    document.getElementById("expForm").addEventListener("submit", function (e) {
      e.preventDefault();
      try {
        state.expenses = addExpense(state.expenses, {
          label: document.getElementById("expLabel").value,
          category: document.getElementById("expCat").value,
          amount: document.getElementById("expAmount").value,
          date: document.getElementById("expDate").value,
          note: document.getElementById("expNote").value
        });
        persist(); renderHeader(); renderBudget();
      } catch (err) { alert(err.message); }
    });
    document.getElementById("budgetTarget").addEventListener("change", function (e) {
      state.moveBudget = e.target.value;
      persist(); renderHeader(); renderBudget();
    });
    host.querySelectorAll("[data-delexp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.expenses = removeExpense(state.expenses, btn.getAttribute("data-delexp"));
        persist(); renderHeader(); renderBudget();
      });
    });
    var ec = document.getElementById("expCsv");
    if (ec) ec.addEventListener("click", function () {
      downloadCsv("movingcheck-expenses.csv", expensesToCSV(state.expenses));
    });
  }

  function renderAll() { renderHeader(); renderTabs(); renderPlan(); renderBoxes(); renderMovers(); renderBudget(); renderAddress(); }

  /* Address-change checklist: who to notify, grouped, with progress. */
  function renderAddress() {
    var host = document.getElementById("tab-address");
    var doneSet = {};
    (state.addressDone || []).forEach(function (id) { doneSet[id] = true; });
    var prog = addressProgress(ADDRESS_TASKS.map(function (t) { return t.id; }), state.addressDone || []);
    var pct = Math.min(100, prog.pct);
    var groups = [];
    ADDRESS_TASKS.forEach(function (t) {
      if (groups.indexOf(t.group) < 0) groups.push(t.group);
    });
    var html = '<div class="card"><h3>Change of address</h3>' +
      '<p class="muted">The who-to-notify list — utilities, government, money, everyone else. ' +
      prog.done + " of " + prog.total + " done.</p>" +
      '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
    groups.forEach(function (g) {
      html += '<div class="card" style="margin-top:1rem"><h3>' + esc(g) + "</h3>" +
        '<ul class="tasks">' +
        ADDRESS_TASKS.filter(function (t) { return t.group === g; }).map(function (t) {
          var done = !!doneSet[t.id];
          return '<li class="' + (done ? "done" : "") + '"><label>' +
            '<input type="checkbox" data-addr="' + esc(t.id) + '"' + (done ? " checked" : "") + "> " +
            '<span class="task-text">' + esc(t.task) + "</span></label></li>";
        }).join("") + "</ul></div>";
    });
    host.innerHTML = html;
    host.querySelectorAll("[data-addr]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-addr");
        if (cb.checked) { if ((state.addressDone || []).indexOf(id) < 0) state.addressDone.push(id); }
        else { state.addressDone = (state.addressDone || []).filter(function (x) { return x !== id; }); }
        persist(); renderHeader(); renderAddress();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var dateInput = document.getElementById("moveDate");
    if (state.moveDate) dateInput.value = state.moveDate;
    dateInput.addEventListener("change", function () {
      state.moveDate = dateInput.value; persist(); renderAll();
    });
    ["plan", "boxes", "movers", "budget", "address"].forEach(function (t) {
      document.getElementById("tabbtn-" + t).addEventListener("click", function () {
        state.tab = t; persist(); renderTabs();
      });
    });
    document.getElementById("resetAll").addEventListener("click", function () {
      if (confirm("Clear all moving data and start over?")) {
        state = { moveDate: "", done: [], boxes: [], movers: [], tab: "plan", customTasks: [], roomFilter: "", expenses: [], moveBudget: "", timeline: [], timelineDone: [], addressDone: [] };
        persist(); renderAll(); dateInput.value = "";
      }
    });
    renderAll();
  });
})();
