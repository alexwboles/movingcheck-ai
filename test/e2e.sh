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

echo "--- e2e: $pass passed, $fail failed ---"
exit $((fail>0))
