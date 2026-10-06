from pathlib import Path

path = Path('public/coach-level-up.html')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "const sequence=['discovery','resume-district','confidence-checkpoint','interview-arena','first-day-challenge','shadow-passage','money-moves'];\n",
        "const sequence=['discovery','resume-district','confidence-checkpoint','interview-arena','first-day-challenge','shadow-passage','money-moves'];\n"
        "const xpMax={'discovery':500,'resume-district':1275,'confidence-checkpoint':435,'interview-arena':730,'first-day-challenge':565,'shadow-passage':300,'money-moves':1100};\n"
        "const TOTAL_XP_MAX=sequence.reduce((sum,id)=>sum+(xpMax[id]||0),0);\n"
        "const formatXp=n=>Number(n||0).toLocaleString('en-US');\n"
        "const moduleXp=m=>Math.max(0,...(m?.rows||[]).map(r=>Number(r.xp)||0));\n"
        "const UFO_COUNTY='UFO - Eastern New Mexico';\n"
        "const UFO_COACH_EMAILS=new Set(['ckoone@eckerd.org','rfresquez@eckerd.org','lkerby@eckerd.org','smoffitt@eckerd.org','eportio@eckerd.org']);\n"
        "const isUfoCoach=()=>UFO_COACH_EMAILS.has(String(coach?.email||'').toLowerCase());\n"
        "const isSample=p=>String(p?.email||'').toLowerCase().endsWith('@levelup.local');\n"
        "const participantContact=p=>isSample(p)?'Sample participant':(p?.email||'No email');\n"
    ),
    (
        "   const mods=mergedModules(p),complete=mods.filter(m=>m.rows.some(r=>r.is_complete)).length;\n",
        "   const mods=mergedModules(p),complete=mods.filter(m=>m.rows.some(r=>r.is_complete)).length,earned=mods.reduce((sum,m)=>sum+moduleXp(m),0);\n"
    ),
    (
        "<div class=\"series\">'+complete+' / 7 core modules complete</div>",
        "<div class=\"series\">'+complete+' / 7 core modules complete<br>'+formatXp(earned)+' / '+formatXp(TOTAL_XP_MAX)+' XP earned</div>"
    ),
    (
        "const xp=Math.max(0,...m.rows.map(r=>Number(r.xp)||0));const updated=",
        "const xp=moduleXp(m),max=xpMax[m.module_id]||0;const updated="
    ),
    (
        "<em>'+(xp?xp+' XP • ':'')+(updated?fmt(updated):'')+'</em>",
        "<em>'+formatXp(xp)+' / '+formatXp(max)+' XP'+(updated?' • '+fmt(updated):'')+'</em>"
    ),
    (
        "<div class=\"meta\">'+esc(p.email||'No email')+' • '+esc(p.county||'Unassigned')+' • Last activity ",
        "<div class=\"meta\">'+esc(participantContact(p))+' • '+esc(p.county||'Unassigned')+' • Last activity "
    ),
    (
        "(p.modalities||[]).map(m=>'<span class=\"tag '+(m==='facilitated'?'fac':'self')+'\">'+(m==='facilitated'?'Facilitated':'Self-paced')+'</span>').join('')+(['coach','admin'].includes(p.role)?'<span class=\"tag unlinked\">'+esc(p.role)+' test/staff</span>':'')",
        "(isSample(p)?'<span class=\"tag unlinked\">Sample participant</span>':'')+(p.modalities||[]).map(m=>'<span class=\"tag '+(m==='facilitated'?'fac':'self')+'\">'+(m==='facilitated'?'Facilitated':'Self-paced')+'</span>').join('')+(['coach','admin'].includes(p.role)?'<span class=\"tag unlinked\">'+esc(p.role)+' test/staff</span>':'')"
    ),
    (
        " const recorded=mergedModules(person).filter(m=>m.rows.length);\n",
        " const allMods=mergedModules(person),overallXp=allMods.reduce((sum,m)=>sum+moduleXp(m),0),recorded=allMods.filter(m=>m.rows.length);\n"
    ),
    (
        "+d.self_paced.xp+' XP • '+htmlEsc(fmt(d.self_paced.completed_at||d.self_paced.updated_at))",
        "+formatXp(d.self_paced.xp)+' / '+formatXp(xpMax[module_id]||0)+' XP • '+htmlEsc(fmt(d.self_paced.completed_at||d.self_paced.updated_at))"
    ),
    (
        "+d.facilitated.xp+' XP • '+htmlEsc(fmt(d.facilitated.completed_at||d.facilitated.updated_at))",
        "+formatXp(d.facilitated.xp)+' / '+formatXp(xpMax[module_id]||0)+' XP • '+htmlEsc(fmt(d.facilitated.completed_at||d.facilitated.updated_at))"
    ),
    (
        "+' • '+htmlEsc(person.county||'Unassigned')+'</div><div class=\"tags\">'",
        "+' • '+htmlEsc(person.county||'Unassigned')+'</div><div class=\"meta\"><b>'+formatXp(overallXp)+' / '+formatXp(TOTAL_XP_MAX)+' XP earned</b></div><div class=\"tags\">'"
    ),
    (
        "+esc(f.xp||0)+' XP • '+esc(f.completed_count||0)+' activities completed",
        "+formatXp(f.xp||0)+' / '+formatXp(xpMax['first-day-challenge'])+' XP • '+esc(f.completed_count||0)+' activities completed"
    ),
    (
        "+d.self_paced.xp+' XP • '+fmt(d.self_paced.completed_at||d.self_paced.updated_at)",
        "+formatXp(d.self_paced.xp)+' / '+formatXp(xpMax[moduleId]||0)+' XP • '+fmt(d.self_paced.completed_at||d.self_paced.updated_at)"
    ),
    (
        "+d.facilitated.xp+' XP • '+fmt(d.facilitated.completed_at||d.facilitated.updated_at)",
        "+formatXp(d.facilitated.xp)+' / '+formatXp(xpMax[moduleId]||0)+' XP • '+fmt(d.facilitated.completed_at||d.facilitated.updated_at)"
    ),
    (
        "$('drawerMeta').textContent=(person?.county||'Unassigned')+' • '+(person?.email||'');",
        "$('drawerMeta').textContent=(person?.county||'Unassigned')+' • '+participantContact(person);"
    ),
    (
        "+htmlEsc(person.email||'')+' • '+htmlEsc(person.county||'Unassigned')+",
        "+htmlEsc(participantContact(person))+' • '+htmlEsc(person.county||'Unassigned')+"
    ),
    (
        "coach=data.coach;rows=data.participants||[];assignableStaff=data.assignable_staff||[];renderCoachFilter();$('coachBadge').textContent=(coach.display_name||coach.email||'Coach')+' • '+coach.role;",
        "coach=data.coach;rows=data.participants||[];assignableStaff=data.assignable_staff||[];"
        "if(isUfoCoach()){rows=rows.filter(p=>p.county===UFO_COUNTY);assignableStaff=assignableStaff.filter(s=>UFO_COACH_EMAILS.has(String(s.email||'').toLowerCase()));$('countyFilter').innerHTML='<option value=\"'+UFO_COUNTY+'\">UFO • Eastern New Mexico</option>';$('countyFilter').value=UFO_COUNTY;$('countyFilter').disabled=true;$('showStaff').checked=false;$('showStaff').closest('label')?.classList.add('hidden');$('coachBadge').textContent=(coach.display_name||coach.email||'Coach')+' • UFO';}renderCoachFilter();if(!isUfoCoach())$('coachBadge').textContent=(coach.display_name||coach.email||'Coach')+' • '+coach.role;"
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Coach XP/scope patch signature not found: {old[:100]!r}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print(f'Patched Level Up Coach View with audited XP maximums and UFO regional scope; series max = {500+1275+435+730+565+300+1100:,} XP.')
