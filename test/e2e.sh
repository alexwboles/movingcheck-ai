#!/usr/bin/env bash
# MovingCheck AI e2e tests — 7 flows exercising real logic in Node. Exit non-zero on failure.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
flow() { # $1 = description, $2 = node script
  if node -e "$2" >/dev/null 2>&1; then echo "PASS: $1"; pass=$((pass+1));
  else echo "FAIL: $1"; fail=$((fail+1)); fi
}

flow "daysUntil counts down correctly" "
  const L=require('./js/logic.js');
  if(L.daysUntil('2026-11-28','2026-09-28')!==61) throw new Error('expected 61');
  if(L.daysUntil('2026-09-28','2026-09-28')!==0) throw new Error('expected 0');
  if(L.daysUntil('2026-09-01','2026-09-28')!==27*-1) throw new Error('expected -27');"

flow "buildPlan dates tasks relative to move day" "
  const L=require('./js/logic.js');
  const plan=L.buildPlan('2026-11-28','2026-09-28');
  const w8=plan.filter(p=>p.week===8);
  if(!w8.length) throw new Error('no week-8 tasks');
  if(w8[0].due!=='2026-10-03') throw new Error('week-8 due wrong: '+w8[0].due);
  const w0=plan.filter(p=>p.week===0);
  if(w0[0].due!=='2026-11-28') throw new Error('moving-day due wrong: '+w0[0].due);"

flow "overdue flags past-due incomplete tasks" "
  const L=require('./js/logic.js');
  const plan=L.buildPlan('2026-10-05','2026-09-28'); // 7 days out: week-8..2 overdue
  const od=plan.filter(p=>p.overdue);
  if(!od.length) throw new Error('nothing flagged overdue');
  if(plan.some(p=>p.week===0&&p.overdue)) throw new Error('moving-day task flagged overdue');"

flow "planProgress computes pct" "
  const L=require('./js/logic.js');
  const plan=L.buildPlan('2026-11-28','2026-09-28');
  const pr=L.planProgress(plan,[plan[0].id,plan[1].id]);
  if(pr.done!==2||pr.total!==plan.length) throw new Error('counts wrong');
  if(pr.pct!==Math.round(2/plan.length*100)) throw new Error('pct wrong: '+pr.pct);"

flow "box inventory add/remove/essentials" "
  const L=require('./js/logic.js');
  let boxes=L.addBox([],{label:'K-01',room:'Kitchen',contents:'pots'});
  boxes=L.addBox(boxes,{label:'B-01',room:'Bedroom',contents:'sheets',essentials:true});
  if(boxes.length!==2) throw new Error('add failed');
  if(L.essentialsBoxes(boxes).length!==1) throw new Error('essentials filter failed');
  boxes=L.toggleEssential(boxes,boxes[0].id);
  if(L.essentialsBoxes(boxes).length!==2) throw new Error('toggle failed');
  boxes=L.removeBox(boxes,boxes[0].id);
  if(boxes.length!==1) throw new Error('remove failed');
  try{ L.addBox([],'  '); throw new Error('blank label accepted'); }catch(e){ if(!/label/i.test(e.message)) throw e; }"

flow "mover ranking cheapest-first, rating tiebreak" "
  const L=require('./js/logic.js');
  let m=L.addMover([ ],{name:'A',quote:'1200',rating:'4'});
  m=L.addMover(m,{name:'B',quote:'900',rating:'3'});
  m=L.addMover(m,{name:'C',quote:'900',rating:'4.5'});
  const r=L.rankMovers(m);
  if(r[0].name!=='C'||r[1].name!=='B'||r[2].name!=='A') throw new Error('ranking wrong: '+r.map(x=>x.name).join(','));
  try{ L.addMover([ ],{name:'  '}); throw new Error('blank name accepted'); }catch(e){ if(!/name/i.test(e.message)) throw e; }"

flow "custom tasks: add, validate, remove, merge into dated plan" "
  const L=require('./js/logic.js');
  let t=L.addCustomTask([ ],{title:'Cancel gym membership',week:4,cat:'Admin'});
  if(t.length!==1||!t[0].id||t[0].week!==4) throw new Error('add failed');
  if(t[0].custom!==true) throw new Error('custom flag missing');
  try{ L.addCustomTask([ ],{title:'   '}); throw new Error('blank title accepted'); }catch(e){ if(!/title/i.test(e.message)) throw e; }
  try{ L.addCustomTask([ ],{title:'x',week:9}); throw new Error('bad week accepted'); }catch(e){ if(!/Week/i.test(e.message)) throw e; }
  t=L.addCustomTask(t,{title:'Unknown cat task',cat:'Nope'});
  if(t[1].cat!=='Plan') throw new Error('unknown cat should default to Plan');
  const plan=L.buildPlan('2026-11-28','2026-09-28');
  const merged=L.mergePlan(plan,t,'2026-11-28','2026-09-28');
  if(merged.length!==plan.length+2) throw new Error('merge length wrong');
  const mine=merged.filter(p=>p.custom);
  if(mine.length!==2) throw new Error('custom tasks lost in merge');
  if(mine[0].due!=='2026-10-31') throw new Error('custom due date wrong: '+mine[0].due);
  const pr=L.planProgress(merged,[mine[0].id]);
  if(pr.done!==1) throw new Error('string ids must count in progress');
  t=L.removeCustomTask(t,t[0].id);
  if(t.length!==1) throw new Error('remove failed');"

flow "filterPlan searches task text and category" "
  const L=require('./js/logic.js');
  const plan=L.buildPlan('2026-11-28','2026-09-28');
  const hits=L.filterPlan(plan,'insurance');
  if(!hits.length) throw new Error('no insurance hits');
  if(hits.some(h=>(h.task+' '+h.cat).toLowerCase().indexOf('insurance')<0)) throw new Error('non-matching hit');
  if(L.filterPlan(plan,'').length!==plan.length) throw new Error('empty query should return all');"

flow "CSV export has headers and quoted rows" "
  const L=require('./js/logic.js');
  let boxes=L.addBox([ ],{label:'K-01',room:'Kitchen',contents:'pots, pans',fragile:true,essentials:true});
  const bcsv=L.boxesToCSV(boxes).split('\n');
  if(bcsv[0]!=='Label,Room,Contents,Fragile,First-night essentials') throw new Error('box header: '+bcsv[0]);
  if(bcsv[1].indexOf('\"pots, pans\"')<0) throw new Error('comma in contents must be quoted: '+bcsv[1]);
  let movers=L.addMover([ ],{name:'Fast \"Movers\" Co.',quote:'1200',rating:'4.5',notes:'great'});
  const mcsv=L.moversToCSV(movers).split('\n');
  if(mcsv[0]!=='Company,Quote,Rating,Notes') throw new Error('mover header: '+mcsv[0]);
  if(mcsv[1].indexOf('\"Fast \"\"Movers\"\" Co.\"')<0) throw new Error('quotes must be escaped: '+mcsv[1]);"

flow "roomCounts groups boxes by room" "
  const L=require('./js/logic.js');
  let boxes=L.addBox([ ],{label:'A',room:'Kitchen'});
  boxes=L.addBox(boxes,{label:'B',room:'Kitchen'});
  boxes=L.addBox(boxes,{label:'C',room:'Garage'});
  boxes=L.addBox(boxes,{label:'D'});
  const c=L.roomCounts(boxes);
  if(c.Kitchen!==2||c.Garage!==1||c.Unassigned!==1) throw new Error('counts wrong: '+JSON.stringify(c));"

flow "estimateSupplies scales with bedrooms" "
  const L=require('./js/logic.js');
  const s0=L.estimateSupplies({bedrooms:0});
  const s3=L.estimateSupplies({bedrooms:3});
  if(!(s3.boxes>s0.boxes)) throw new Error('more bedrooms should need more boxes');
  if(s3.boxes!==55) throw new Error('3br should estimate 55 boxes, got '+s3.boxes);
  if(!(s3.tapeRolls>0&&s3.markers>0)) throw new Error('supplies incomplete');"

echo "--- e2e: $pass passed, $fail failed ---"
exit $((fail>0))
