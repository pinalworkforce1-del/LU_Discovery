from pathlib import Path

path = Path('public/coach-level-up.html')
text = path.read_text(encoding='utf-8')

# Add UFO scope helpers after the sequence constants. This script runs after the XP audit patch.
needle = "const TOTAL_XP_MAX=sequence.reduce((sum,id)=>sum+(xpMax[id]||0),0);\n"
insert = needle + "const UFO_COUNTY='UFO - Eastern New Mexico';\nconst UFO_COACH_EMAILS=new Set(['ckoone@eckerd.org','rfresquez@eckerd.org','lkerby@eckerd.org','smoffitt@eckerd.org','eportio@eckerd.org']);\nconst isUfoCoach=()=>UFO_COACH_EMAILS.has(String(coach?.email||'').toLowerCase());\nconst isSample=p=>String(p?.email||'').toLowerCase().endsWith('@levelup.local');\nconst participantContact=p=>isSample(p)?'Sample participant':(p?.email||'No email');\n"
if needle not in text:
    raise SystemExit('UFO scope constant insertion point not found')
text = text.replace(needle, insert, 1)

# Hide synthetic sample email addresses and visibly mark sample records.
old = "<div class=\"meta\">'+esc(p.email||'No email')+' • '+esc(p.county||'Unassigned')+' • Last activity '"
new = "<div class=\"meta\">'+esc(participantContact(p))+' • '+esc(p.county||'Unassigned')+' • Last activity '"
if old not in text:
    raise SystemExit('Participant contact render signature not found')
text = text.replace(old, new, 1)

old = "(p.modalities||[]).map(m=>'<span class=\"tag '+(m==='facilitated'?'fac':'self')+'\">'+(m==='facilitated'?'Facilitated':'Self-paced')+'</span>').join('')+(['coach','admin'].includes(p.role)?'<span class=\"tag unlinked\">'+esc(p.role)+' test/staff</span>':'')"
new = "(isSample(p)?'<span class=\"tag unlinked\">Sample participant</span>':'')+(p.modalities||[]).map(m=>'<span class=\"tag '+(m==='facilitated'?'fac':'self')+'\">'+(m==='facilitated'?'Facilitated':'Self-paced')+'</span>').join('')+(['coach','admin'].includes(p.role)?'<span class=\"tag unlinked\">'+esc(p.role)+' test/staff</span>':'')"
if old not in text:
    raise SystemExit('Participant tag signature not found')
text = text.replace(old, new, 1)

# Hide synthetic email from the detail drawer.
old = "$('drawerMeta').textContent=(person?.county||'Unassigned')+' • '+(person?.email||'');"
new = "$('drawerMeta').textContent=(person?.county||'Unassigned')+' • '+participantContact(person);"
if old not in text:
    raise SystemExit('Drawer meta signature not found')
text = text.replace(old, new, 1)

# Hide synthetic email from downloaded coach summary.
old = "+htmlEsc(person.email||'')+' • '+htmlEsc(person.county||'Unassigned')+"
new = "+htmlEsc(participantContact(person))+' • '+htmlEsc(person.county||'Unassigned')+"
if old not in text:
    raise SystemExit('Download summary contact signature not found')
text = text.replace(old, new, 1)

# Scope the roster immediately after authentication. Admins and all non-UFO coaches retain current behavior.
old = "coach=data.coach;rows=data.participants||[];assignableStaff=data.assignable_staff||[];renderCoachFilter();$('coachBadge').textContent=(coach.display_name||coach.email||'Coach')+' • '+coach.role;"
new = "coach=data.coach;rows=data.participants||[];assignableStaff=data.assignable_staff||[];\n   if(isUfoCoach()){\n     rows=rows.filter(p=>p.county===UFO_COUNTY);\n     assignableStaff=assignableStaff.filter(s=>UFO_COACH_EMAILS.has(String(s.email||'').toLowerCase()));\n     $('countyFilter').innerHTML='<option value=\"'+UFO_COUNTY+'\">UFO • Eastern New Mexico</option>';\n     $('countyFilter').value=UFO_COUNTY;$('countyFilter').disabled=true;\n     $('showStaff').checked=false;$('showStaff').closest('label')?.classList.add('hidden');\n     $('coachBadge').textContent=(coach.display_name||coach.email||'Coach')+' • UFO';\n   }\n   renderCoachFilter();if(!isUfoCoach())$('coachBadge').textContent=(coach.display_name||coach.email||'Coach')+' • '+coach.role;"
if old not in text:
    raise SystemExit('Coach load signature not found')
text = text.replace(old, new, 1)

# Prevent sample participants from appearing as assignable caseload records.
old = "<select data-assign=\"'+esc(p.person_key)+'\" style=\"margin-top:8px;max-width:220px;padding:8px;border:1px solid #c5d4dc;border-radius:10px;background:#fff;font:inherit\"><option value=\"\">Unassigned</option>'+assignableStaff.map"
new = "'+(isSample(p)?'<div class=\"tag unlinked\" style=\"margin-top:8px;display:inline-block\">Training sample • not assignable</div>':'<select data-assign=\"'+esc(p.person_key)+'\" style=\"margin-top:8px;max-width:220px;padding:8px;border:1px solid #c5d4dc;border-radius:10px;background:#fff;font:inherit\"><option value=\"\">Unassigned</option>'+assignableStaff.map"
if old not in text:
    raise SystemExit('Assignment select opening signature not found')
text = text.replace(old, new, 1)

old = "</option>').join('')+'</select><button class=\"btn alt\" type=\"button\" data-download=\"'+esc(p.person_key)+'\" style=\"margin-top:8px\">Download Summary</button>"
new = "</option>').join('')+'</select>')+'<button class=\"btn alt\" type=\"button\" data-download=\"'+esc(p.person_key)+'\" style=\"margin-top:8px\">Download Summary</button>"
if old not in text:
    raise SystemExit('Assignment select closing signature not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Patched Coach View: UFO coaches are scoped to Eastern New Mexico participants plus dedicated sample records.')
