#!/usr/bin/env bash
# MovingCheck AI smoke tests — 16 checks. Exit non-zero on first failure.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
check() { # $1 = description, rest = command
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "PASS: $desc"; pass=$((pass+1));
  else echo "FAIL: $desc"; fail=$((fail+1)); fi
}

check "index.html exists" test -f index.html
check "css/style.css exists" test -f css/style.css
check "js/movebank.js exists" test -f js/movebank.js
check "js/logic.js exists" test -f js/logic.js
check "js/app.js exists" test -f js/app.js
check "movebank.js syntax valid" node --check js/movebank.js
check "logic.js syntax valid" node --check js/logic.js
check "app.js syntax valid" node --check js/app.js
check "checklist has 30+ tasks across 9 week buckets" node -e "
  const b=require('./js/movebank.js').CHECKLIST_TEMPLATE;
  const weeks=new Set(b.map(t=>t.week));
  if(b.length<30) throw new Error('only '+b.length+' tasks');
  if(weeks.size<9) throw new Error('only '+weeks.size+' week buckets');"
check "every task has week/cat/task" node -e "
  const b=require('./js/movebank.js').CHECKLIST_TEMPLATE;
  for(const t of b){ if(t.week==null||!t.cat||!t.task) throw new Error('bad task: '+JSON.stringify(t)); }"
check "first-night suggestions list non-empty" node -e "
  const s=require('./js/movebank.js').FIRST_NIGHT_SUGGESTIONS;
  if(!Array.isArray(s)||s.length<8) throw new Error('too few suggestions');"
check "11 rooms defined" node -e "
  const r=require('./js/movebank.js').MOVE_ROOMS;
  if(r.length<8) throw new Error('only '+r.length+' rooms');"
check "custom task helpers exported" node -e "
  const L=require('./js/logic.js');
  ['addCustomTask','removeCustomTask','mergePlan','filterPlan','roomCounts','boxesToCSV','moversToCSV','estimateSupplies'].forEach(f=>{
    if(typeof L[f]!=='function') throw new Error('missing '+f);});
  if(L.TASK_CATS.length<5) throw new Error('too few task categories');"
check "expense helpers exported" node -e "
  const L=require('./js/logic.js');
  ['addExpense','removeExpense','expenseTotals','budgetVsTarget','expensesToCSV','MOVE_EXPENSE_CATS'].forEach(f=>{
    if(L[f]===undefined) throw new Error('missing '+f);});
  if(L.MOVE_EXPENSE_CATS.length<5) throw new Error('too few expense categories');"
check "expenses: validation + totals + vs target" node -e "
  const L=require('./js/logic.js');
  let es=L.addExpense([], {label:'Truck rental', category:'Movers', amount:'350.50', date:'2026-11-01', note:'one-way'});
  if(es.length!==1||es[0].amount!==350.50) throw new Error('add wrong: '+JSON.stringify(es[0]));
  es=L.addExpense(es, {label:'Boxes', category:'Supplies', amount:40});
  const t=L.expenseTotals(es);
  if(t.total!==390.50||t.byCat['Movers']!==350.50||t.byCat['Supplies']!==40||t.count!==2) throw new Error('totals wrong: '+JSON.stringify(t));
  const vs=L.budgetVsTarget(es, 500);
  if(vs.spent!==390.50||vs.budget!==500||vs.remaining!==109.50||vs.pct!==78||vs.over) throw new Error('vs target wrong: '+JSON.stringify(vs));
  const over=L.budgetVsTarget(es, 300);
  if(!over.over||over.remaining!==-90.50) throw new Error('over-budget not flagged');
  es=L.removeExpense(es, es[0].id);
  if(es.length!==1) throw new Error('remove failed');
  const csv=L.expensesToCSV(es).split('\n');
  if(csv[0]!=='Label,Category,Amount (\$),Date,Note') throw new Error('csv header: '+csv[0]);
  for(const bad of [{label:'',amount:10},{label:'x',amount:0},{label:'x',amount:-5},{label:'x',amount:'abc'}]){
    let threw=false; try{ L.addExpense([], bad); }catch(e){ threw=true; }
    if(!threw) throw new Error('should reject '+JSON.stringify(bad)); }"
check "booked mover: exactly one at a time" node -e "
  const L=require('./js/logic.js');
  const ms=[{id:'a',name:'A'},{id:'b',name:'B'}];
  let s=L.setBookedMover(ms,'b');
  if(!s[1].booked||s[0].booked) throw new Error('book failed');
  if(L.bookedMover(s).name!=='B') throw new Error('bookedMover wrong');
  s=L.setBookedMover(s,null);
  if(L.bookedMover(s)!==null) throw new Error('unbook failed');
  s=L.setBookedMover(s,'a');
  if(L.bookedMover(s).name!=='A'||s[1].booked) throw new Error('rebook failed');"
check "planToICS: valid calendar with dated events" node -e "
  const L=require('./js/logic.js');
  const plan=L.buildPlan('2026-12-01','2026-11-01');
  const ics=L.planToICS(plan, 'moving 2026-12-01');
  if(!ics.startsWith('BEGIN:VCALENDAR')) throw new Error('no VCALENDAR');
  if(!ics.endsWith('END:VCALENDAR')) throw new Error('no END:VCALENDAR');
  const events=ics.split('BEGIN:VEVENT').length-1;
  if(events!==plan.length) throw new Error(events+' events, want '+plan.length);
  if(!/DTSTART;VALUE=DATE:20261201/.test(ics)) throw new Error('missing moving-day event');
  if(!/SUMMARY:.+\\[/.test(ics)) throw new Error('no category in summary');
  const ics2=L.planToICS([]);
  if(ics2.split('BEGIN:VEVENT').length!==1) throw new Error('empty plan should have no events');
  const esc=L.icsEscape('a;b,c\\\\d\ne');
  if(esc!=='a\\\\;b\\\\,c\\\\\\\\d\\\\ne') throw new Error('icsEscape wrong: '+esc);"
check "budget tab wired in index.html" bash -c 'grep -q "tabbtn-budget" index.html && grep -q "tab-budget" index.html'
check "ics export button wired in app.js" bash -c 'grep -q "planIcs" js/app.js && grep -q "planToICS" js/app.js'
check "address tab wired in index.html + app.js" bash -c 'grep -q "tabbtn-address" index.html && grep -q "tab-address" index.html && grep -q "renderAddress" js/app.js'
check "box search UI wired" bash -c 'grep -q "boxSearch" js/app.js && grep -q "searchBoxes" js/app.js'
check "moving-day timeline UI wired" bash -c 'grep -q "renderTimeline" js/app.js && grep -q "tlAdd" js/app.js'
check "box search / timeline / address helpers exported" node -e "
  const L=require('./js/logic.js');
  ['searchBoxes','addTimelineEntry','removeTimelineEntry','sortTimeline','validClock','addressProgress'].forEach(f=>{
    if(typeof L[f]!=='function') throw new Error('missing '+f);});
  if(L.ADDRESS_TASKS.length<12) throw new Error('too few address tasks');
  const groups=new Set(L.ADDRESS_TASKS.map(t=>t.group));
  if(groups.size<4) throw new Error('too few address groups');
  const ids=L.ADDRESS_TASKS.map(t=>t.id);
  if(new Set(ids).size!==ids.length) throw new Error('duplicate address task ids');"
check "box search matches label/room/contents" node -e "
  const L=require('./js/logic.js');
  let boxes=L.addBox([],{label:'K-03',room:'Kitchen',contents:'coffee maker, mugs'});
  boxes=L.addBox(boxes,{label:'B-01',room:'Bedroom',contents:'pillows'});
  if(L.searchBoxes(boxes,'coffee').length!==1) throw new Error('contents search');
  if(L.searchBoxes(boxes,'K-03').length!==1) throw new Error('label search');
  if(L.searchBoxes(boxes,'bedroom').length!==1) throw new Error('room search');
  if(L.searchBoxes(boxes,'').length!==2) throw new Error('empty query');
  if(L.searchBoxes(boxes,'zzzz').length!==0) throw new Error('no-match');"
check "timeline add/sort/validate/remove" node -e "
  const L=require('./js/logic.js');
  let tl=L.addTimelineEntry([],{time:'08:00',label:'Movers arrive'});
  tl=L.addTimelineEntry(tl,{time:'07:00',label:'Coffee'});
  if(tl[0].time!=='07:00') throw new Error('not sorted');
  let threw=false; try{ L.addTimelineEntry(tl,{time:'25:00',label:'bad'}); }catch(e){ threw=true; }
  if(!threw) throw new Error('bad time accepted');
  threw=false; try{ L.addTimelineEntry(tl,{time:'09:00',label:''}); }catch(e){ threw=true; }
  if(!threw) throw new Error('empty label accepted');
  const id=tl[0].id;
  tl=L.removeTimelineEntry(tl,id);
  if(tl.length!==1||tl[0].time!=='08:00') throw new Error('remove broken');"
check "address progress math" node -e "
  const L=require('./js/logic.js');
  const ids=L.ADDRESS_TASKS.map(t=>t.id);
  const p=L.addressProgress(ids,[ids[0],ids[1]]);
  if(p.done!==2||p.total!==ids.length) throw new Error('progress counts');
  if(p.pct!==Math.round(2/ids.length*100)) throw new Error('progress pct');"

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
