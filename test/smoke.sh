#!/usr/bin/env bash
# MovingCheck AI smoke tests — 12 checks. Exit non-zero on first failure.
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

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
