from pathlib import Path
import re

career = Path('public/coach-career-tree.html')
s = career.read_text(encoding='utf-8')
# Normalize the optional navigation shortcut before the canonical toolbar rewrite.
# Re-added after rendering below; otherwise the toolbar signature mismatches.
s = re.sub(r'<a id="viewTalentSync"[^>]*>View TalentSync</a>', '', s, count=1)

# Use the same roster/assignment service as the normal Coach View.
s = s.replace(
    "const LOGIN_ENDPOINT=BASE+'levelup-facilitated',ROSTER_ENDPOINT=BASE+'career-tree-coach-roster',DETAIL_ENDPOINT=BASE+'career-tree-coach-detail';",
    "const LOGIN_ENDPOINT=BASE+'levelup-facilitated',ROSTER_ENDPOINT=LOGIN_ENDPOINT,DETAIL_ENDPOINT=BASE+'career-tree-coach-detail';",
)
s = s.replace("let rows=[],coach=null;", "let rows=[],coach=null,assignableStaff=[];")

old_toolbar = '<section id="app" class="hidden"><div class="toolbar"><input id="search" placeholder="Search participant name or email"><span class="coachMeta" id="coachMeta"></span><button class="btn alt" id="refresh">Refresh</button></div><div class="grid" id="grid"></div></section>'
new_toolbar = '<section id="app" class="hidden"><div class="toolbar"><input id="search" placeholder="Search participant name or email"><select id="countyFilter"><option value="">All locations</option><option value="Pinal">Pinal</option><option value="Northern">Northern</option><option value="UFO - Eastern New Mexico">UFO - Eastern New Mexico</option><option value="Unassigned">Unassigned</option></select><select id="coachFilter"><option value="">All coaches</option><option value="__mine">My participants</option><option value="__unassigned">Unassigned</option></select><label class="toggle"><input type="checkbox" id="showStaff"> Include staff/test accounts</label><button class="btn alt" id="refresh">Refresh</button></div><div class="coachMeta" id="coachMeta" style="margin:0 0 12px"></div><div class="grid" id="grid"></div></section>'
if old_toolbar not in s:
    raise SystemExit('Career Tree toolbar signature not found')
s = s.replace(old_toolbar, new_toolbar, 1)

# Bring Career Tree toolbar styling in line with the core Coach View.
s = s.replace(
    ".toolbar{display:flex;gap:10px;align-items:center;margin:12px 0 16px}.toolbar input{flex:1;min-width:220px;padding:11px;border:1px solid #c5d4dc;border-radius:12px;font:inherit;background:#fff}",
    ".toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto auto auto;gap:10px;align-items:center;margin:12px 0 10px}.toolbar input,.toolbar select{width:100%;padding:11px;border:1px solid #c5d4dc;border-radius:12px;font:inherit;background:#fff}.toggle{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:850;color:#4e6470;white-space:nowrap}.toggle input{width:auto}.assignment{margin-top:8px;max-width:220px;padding:8px;border:1px solid #c5d4dc;border-radius:10px;background:#fff;font:inherit}",
)
s = s.replace(
    "@media(max-width:760px){.cards,.miniGrid{grid-template-columns:1fr}.personTop,.toolbar{display:block}.toolbar .btn{margin-top:8px}.top{flex-wrap:wrap}}",
    "@media(max-width:900px){.toolbar{grid-template-columns:1fr 1fr}.cards,.miniGrid{grid-template-columns:1fr}.top{flex-wrap:wrap}}@media(max-width:620px){.personTop,.toolbar{display:block}.toolbar>*{margin-top:8px}}",
)

old_load = "async function loadRoster(){const h=headers();if(!h)return null;const res=await fetch(ROSTER_ENDPOINT,{method:'POST',headers:h,body:'{}'}),data=await res.json();if(!res.ok){if(res.status===401||res.status===403)localStorage.removeItem(STAFF_TOKEN_KEY);throw new Error(data?.error||'Career Tree roster unavailable.')}return data}"
new_load = "async function loadRoster(){const h=headers();if(!h)return null;const res=await fetch(ROSTER_ENDPOINT,{method:'POST',headers:h,body:JSON.stringify({action:'coach_roster'})}),data=await res.json();if(!res.ok){if(res.status===401||res.status===403)localStorage.removeItem(STAFF_TOKEN_KEY);throw new Error(data?.error||'Career Tree roster unavailable.')}return data}"
if old_load not in s:
    raise SystemExit('Career Tree loadRoster signature not found')
s = s.replace(old_load, new_load, 1)

render_block = r'''function careerModule(p,id){
 const row=(p.progress||[]).find(r=>r.module_id===id);
 return row?{status:row.is_complete?'complete':'in_progress',is_complete:!!row.is_complete,updated_at:row.completed_at||row.updated_at||null}:{status:'not_started',is_complete:false,updated_at:null};
}
function renderCoachFilter(){
 const el=$('coachFilter'),current=el.value;
 el.innerHTML='<option value="">All coaches</option><option value="__mine">My participants</option><option value="__unassigned">Unassigned</option>'+assignableStaff.map(st=>'<option value="'+esc(st.email)+'">'+esc(st.display_name||st.email)+'</option>').join('');
 if([...el.options].some(o=>o.value===current))el.value=current;
}
async function assignParticipant(person_key,staff_email,select){
 const original=select.dataset.original??'';select.disabled=true;
 try{
   const h=headers();if(!h)throw new Error('Staff session expired.');
   const res=await fetch(LOGIN_ENDPOINT,{method:'POST',headers:h,body:JSON.stringify({action:'assign_participant',person_key,staff_email:staff_email||null})});
   const data=await res.json();if(!res.ok)throw new Error(data?.error||'Assignment could not be saved.');
   const person=rows.find(x=>x.person_key===person_key);if(person)person.primary_staff_email=staff_email||null;
   select.dataset.original=staff_email||'';render();
 }catch(err){select.value=original;alert('Could not update coach assignment: '+err.message)}finally{select.disabled=false}
}
function render(){
 const q=$('search').value.trim().toLowerCase(),county=$('countyFilter').value,coachFilter=$('coachFilter').value,showStaff=$('showStaff').checked;
 const filtered=rows.filter(p=>{
   const matchesSearch=!q||String(p.display_name||'').toLowerCase().includes(q)||String(p.email||'').toLowerCase().includes(q);
   const matchesCounty=!county||(county==='Unassigned'?!p.county:p.county===county);
   const matchesRole=showStaff||!['coach','admin'].includes(p.role);
   const assigned=String(p.primary_staff_email||'').toLowerCase();
   const matchesCoach=!coachFilter||(coachFilter==='__mine'?assigned===String(coach?.email||'').toLowerCase():coachFilter==='__unassigned'?!assigned:assigned===coachFilter.toLowerCase());
   return matchesSearch&&matchesCounty&&matchesRole&&matchesCoach;
 });
 $('grid').innerHTML=filtered.length?filtered.map(p=>{
   const mods=[['Discover Me','discover_me',careerModule(p,'discover-me')],['Explore Careers','explore_careers',careerModule(p,'explore-careers')],['Work + Life Plan','work_life_plan',careerModule(p,'work-life-plan')]],done=mods.filter(x=>x[2]?.is_complete).length;
   return '<article class="person"><div class="personTop"><div><h2>'+esc(p.display_name||'Participant')+'</h2><div class="meta">'+esc(p.email||'No email')+' • '+esc(p.county||'Unassigned')+'</div></div><div style="text-align:right"><span class="status '+(done===3?'done':done?'started':'')+'">'+done+' / 3 complete</span><br><select class="assignment" data-assign="'+esc(p.person_key)+'" data-original="'+esc(p.primary_staff_email||'')+'"><option value="">Unassigned</option>'+assignableStaff.map(st=>'<option value="'+esc(st.email)+'" '+(String(p.primary_staff_email||'').toLowerCase()===String(st.email||'').toLowerCase()?'selected':'')+'>'+esc(st.display_name||st.email)+'</option>').join('')+'</select></div></div><div class="ctHead"><b>Career Tree</b><span>Career Quest will be added after its progress contract is finalized.</span></div><div class="cards">'+mods.map(([label,key,m])=>'<button class="ctCard '+statusClass(m?.status)+'" data-person="'+esc(p.person_key)+'" data-module="'+key+'"><b>'+esc(label)+(m?.is_complete?' ✓':'')+'</b><span>'+statusText(m?.status)+'</span><em>'+(m?.updated_at?fmt(m.updated_at):'No activity recorded')+'</em></button>').join('')+'</div><div class="ctHead"><b>READY 2 WORK</b><span>View available cloud evidence and coaching insights</span></div><div class="cards">'+[['Soft Skills Synergy','soft_skills'],['Resume Rise','resume'],['Interview Intelligence','interview']].map(([label,key])=>{const moduleId=key==='soft_skills'?'ready2work-soft-skills':key==='resume'?'ready2work-resume-scenarios':null;const m=moduleId?careerModule(p,moduleId):null;const live=p.interview_summary||{},sc=careerModule(p,'ready2work-interview-scenarios');const complete=key==='interview'?Boolean(live.verified):Boolean(m?.is_complete);const status=key==='resume'?(complete?'5 / 5 scenarios complete':m?.status==='in_progress'?'Scenarios in progress':'No cloud scenario evidence'):key==='soft_skills'?statusText(m?.status):complete?'Verified complete • 5 scenarios + live interview':sc.is_complete?'5 / 5 scenarios complete • live interview pending':sc.status==='in_progress'?'Interview scenarios in progress':'No verified interview evidence';const date=key==='interview'?(complete?live.last_at:sc.updated_at):m?.completed_at||m?.updated_at;const cardStatus=key==='interview'?(complete?'complete':sc.is_complete||sc.status==='in_progress'?'in_progress':'not_started'):m?.status;return '<button class="ctCard '+statusClass(cardStatus)+'" data-person="'+esc(p.person_key)+'" data-module="'+key+'"><b>'+label+(complete?' ✓':'')+'</b><span>'+status+'</span><em>'+(date?fmt(date):'Open module report')+'</em></button>'}).join('')+'</div></article>'
 }).join(''):'<section class="empty"><h2>No Career Tree participants match these filters.</h2></section>';
 document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.person,b.dataset.module||'all'));
 document.querySelectorAll('[data-assign]').forEach(sel=>sel.onchange=()=>assignParticipant(sel.dataset.assign,sel.value,sel));
}
'''

pattern = re.compile(r"function render\(\)\{.*?\}\nasync function detail", re.S)
if not pattern.search(s):
    raise SystemExit('Career Tree render block not found')
s = pattern.sub(render_block + "async function detail", s, count=1)

old_app_load = "async function load(){try{const data=await loadRoster();if(!data)return showLogin();coach=data.coach;rows=data.participants||[];$('coachMeta').textContent=(coach?.display_name||coach?.email||'Coach')+' • '+coach?.role;$('signin').classList.add('hidden');$('app').classList.remove('hidden');$('signOut').classList.remove('hidden');render()}catch(err){showLogin(err.message)}}"
new_app_load = "async function load(){try{const data=await loadRoster();if(!data)return showLogin();coach=data.coach;rows=data.participants||[];assignableStaff=data.assignable_staff||[];try{const extra=await fetch(BASE+'career-tree-coach-roster',{method:'POST',headers:headers(),body:'{}'});if(extra.ok){const supplemental=await extra.json();const map=new Map((supplemental.participants||[]).map(p=>[p.person_key,p]));for(const p of rows){const found=map.get(p.person_key);if(found){p.interview_summary=found.ready_2_work?.interview_live||null;const sc=found.ready_2_work?.interview_scenarios;if(sc){p.progress=p.progress||[];if(!p.progress.some(m=>m.module_id==='ready2work-interview-scenarios'))p.progress.push({...sc,module_id:'ready2work-interview-scenarios'});}}}}}catch(e){console.warn('Interview roster summary unavailable',e)}renderCoachFilter();$('coachMeta').textContent=(coach?.display_name||coach?.email||'Coach')+' • '+coach?.role+' • Career Tree uses the same participant roster and coach assignments as Core Coach View';$('signin').classList.add('hidden');$('app').classList.remove('hidden');$('signOut').classList.remove('hidden');render()}catch(err){showLogin(err.message)}}"
if old_app_load not in s:
    raise SystemExit('Career Tree app load signature not found')
s = s.replace(old_app_load, new_app_load, 1)

old_events = "$('staffCode').onkeydown=e=>{if(e.key==='Enter')$('login').click()};$('search').oninput=render;$('refresh').onclick=load;"
new_events = "$('staffCode').onkeydown=e=>{if(e.key==='Enter')$('login').click()};$('search').oninput=render;$('countyFilter').onchange=render;$('coachFilter').onchange=render;$('showStaff').onchange=render;$('refresh').onclick=load;"
if old_events not in s:
    raise SystemExit('Career Tree event binding signature not found')
s = s.replace(old_events, new_events, 1)

talentsync_runtime = "\n// Pinal TalentSync intake handoff; server validates coach access, assignment and county.\nconst TALENTSYNC_INTAKE_URL='https://dxcajwarqojvmbteroco.supabase.co/functions/v1/talentsync-levelup-intake';\nconst talentSyncStates=new Map();\nasync function talentSyncRequest(key,action){\n const h=headers();if(!h)throw Error('Staff session expired');\n const response=await fetch(TALENTSYNC_INTAKE_URL,{method:'POST',headers:h,body:JSON.stringify({action,person_key:key})});\n const data=await response.json().catch(()=>({}));\n if(!response.ok)throw Error(data.error||'TalentSync unavailable');\n return data;\n}\nfunction talentSyncOpen(){alert('Participant is linked. Open TalentSync using your existing authorized staff link.');}\nasync function talentSyncSend(key,btn){\n if(!confirm('Create a Pinal TalentSync intake with available Level Up evidence? This does not approve WIOA enrollment.'))return;\n btn.disabled=true;btn.textContent='Sending…';\n try{const state=await talentSyncRequest(key,'send');if(!state.linked)throw Error('Transfer not confirmed');\n talentSyncStates.set(key,state);btn.textContent='Open in TalentSync';btn.onclick=talentSyncOpen;\n alert('Intake linked successfully; WIOA enrollment remains unapproved.');}\n catch(e){btn.textContent='Send to TalentSync';alert('Transfer not completed: '+e.message);}\n finally{btn.disabled=false;}\n}\nfunction renderTalentSyncActions(){\n document.querySelectorAll('#grid .person').forEach(card=>{\n  const key=card.querySelector('[data-person]')?.getAttribute('data-person');\n  const person=rows.find(p=>p.person_key===key);\n  if(!person||person.county!=='Pinal'||!/^auth:[a-f\\d-]{36}$/i.test(key||''))return;\n  const button=document.createElement('button');button.className='btn alt';button.type='button';button.disabled=true;button.textContent='Checking TalentSync…';\n  const holder=document.createElement('div');holder.style.cssText='display:flex;justify-content:flex-end;margin-top:12px';holder.appendChild(button);card.appendChild(holder);\n  const apply=state=>{button.disabled=false;if(state.linked){button.textContent='Open in TalentSync';button.onclick=talentSyncOpen}\n   else{button.textContent='Send to TalentSync';button.onclick=()=>talentSyncSend(key,button)}};\n  if(talentSyncStates.has(key)){apply(talentSyncStates.get(key));return}\n  talentSyncRequest(key,'status').then(state=>{talentSyncStates.set(key,state);apply(state)}).catch(e=>{button.textContent='TalentSync unavailable';button.title=e.message});\n });\n}\nconst originalCareerTreeRender=render;\nrender=function(){originalCareerTreeRender();renderTalentSyncActions();};\n"
if 'const TALENTSYNC_INTAKE_URL=' not in s:
    s = s.replace("$('login').onclick=async()=>", talentsync_runtime + "\n$('login').onclick=async()=>", 1)


# Keep the program-level TalentSync shortcut separate from participant-level transfer.
talentsync_nav = '<a id="viewTalentSync" class="btn alt hidden" href="https://pinalworkforce1-del.github.io/BOOST_Pathway-Portal/talentsync.html" target="_blank" rel="noopener noreferrer">View TalentSync</a>'
if 'id="viewTalentSync"' not in s:
    s = s.replace('<div class="grid" id="grid"></div></section>', talentsync_nav + '<div class="grid" id="grid"></div></section>', 1)
if "function updateTalentSyncNav()" not in s:
    s = s.replace("$('login').onclick=async()=>", """function updateTalentSyncNav(){const link=$('viewTalentSync');if(link)link.classList.toggle('hidden',!rows.some(p=>p.county==='Pinal'));} 
const priorTalentSyncRender=render;
render=function(){priorTalentSyncRender();updateTalentSyncNav();};
$('login').onclick=async()=>""", 1)

career.write_text(s, encoding='utf-8')

# Add the reverse navigation link to the normal Coach View.
core = Path('public/coach-level-up.html')
c = core.read_text(encoding='utf-8')
# Insert only the missing Career Tree shortcut; retain newer staff-admin controls.
if 'href="coach-career-tree.html"' not in c:
    anchor = '<span class="pill" id="coachBadge">Staff access</span>'
    if anchor not in c:
        raise SystemExit('Core Coach View staff badge not found')
    c = c.replace(anchor, '<a class="btn alt" href="coach-career-tree.html" style="text-decoration:none">Career Tree</a>'+anchor, 1)
core.write_text(c, encoding='utf-8')

print('Patched Career Tree Coach View with shared roster filters, coach assignment, and two-way navigation. TalentSync handoff pending.')


# Attach Pinal's optional My Path Forward mind map inside Discover Me, not as a fourth core card.
# Run after the baseline coach dashboard patch so the build cannot overwrite this integration.
s = career.read_text(encoding='utf-8')
old_card = "<span>'+statusText(m?.status)+'</span><em>"
new_card = "<span>'+statusText(m?.status)+(key==='discover_me'&&String(p.county||'').toLowerCase()==='pinal'?(careerModule(p,'my-path-forward').is_complete?' · Mind Map complete':careerModule(p,'my-path-forward').status==='in_progress'?' · Mind Map in progress':' · Mind Map not started'):'')+'</span><em>"
if old_card not in s:
    raise SystemExit('Discover Me card status anchor missing')
s = s.replace(old_card, new_card, 1)
if 'function pinalMindMapHtml(' in s:
    raise SystemExit('Duplicate mind-map attachment')

mindmap_js = r'''function pinalMindMapHtml(d){
 if(!d)return '<section class="section"><h3>My Path Forward · Pinal Mind Map</h3><div class="notice">Optional reflection not yet saved. Discover Me O*NET completion remains intact.</div></section>';
 const self=d.self_reported_readiness,score=d.plan_readiness,fields=d.fields||{};
 const dimensions=Array.isArray(d.scored_dimensions)?d.scored_dimensions:[];
 const supports={career_info:'Learn more about career options',action_plan:'Make a clearer action plan',training:'Explore training or work experience',coach:'Talk with Career Coach',ready:'Ready to take action'};
 const options={diploma:'GED or diploma',wex:'Job or work experience',training:'Training or credential',apprenticeship:'Apprenticeship',college:'College',business:'Starting a business'};
 const fieldLabels=[['nextChapter','My next chapter'],['myStory','My story'],['whereNow','Where I am now'],['strengths','What I bring'],['motivations','What motivates me'],['resources','People and resources'],['futureVision','My future vision'],['goal','One goal I choose now'],['nextStep','My first next step'],['support','Who will support me'],['target','Target date']];
 const mini=(label,value)=>'<div class="mini"><small>'+esc(label)+'</small><strong>'+esc(value===null||value===undefined?'—':value)+'</strong></div>';
 const badge='<span class="status '+(d.is_complete?'done':'started')+'">'+(d.is_complete?'Complete':'Draft')+'</span>';
 const fieldsHtml=fieldLabels.map(([key,label])=>'<div class="mindField"><b>'+esc(label)+'</b><p>'+esc(fields[key]||'Not recorded')+'</p></div>').join('');
 const optionsHtml=Array.isArray(d.options)?d.options.map(key=>options[key]).filter(Boolean).map(v=>'<span class="chip">'+esc(v)+'</span>').join(''):'';
 const dimensionsHtml=dimensions.map(x=>'<div class="row"><b>'+esc(x.label)+'</b><span>'+esc(x.value===null?'Not answered':x.value+' / 2')+'</span></div>').join('');
 const historyHtml=Array.isArray(d.history)&&d.history.length>1?'<details class="mindHistory"><summary>Readiness history ('+d.history.length+' snapshots)</summary>'+d.history.slice(-10).reverse().map(h=>'<div class="row"><b>'+esc(fmt(h.at))+'</b><span>Self '+esc(h.self_reported_readiness===null?'—':h.self_reported_readiness)+'/10 · Plan '+esc(h.plan_readiness===null?'—':h.plan_readiness)+'/10</span></div>').join('')+'</details>':'';
 const notes=String(fields.nextStep||'').trim();
 const vague=notes&&((notes.split(/\s+/).length<4)||/^(complete (this|it)|do (this|it)|get started|start|finish|done|help|work on this)[.! ]*$/i.test(notes));
 const coachQuestions=Array.isArray(d.coach_talking_points)?d.coach_talking_points:[];
 const refine=vague?'<div class="coachPrompt"><b>Action specificity opportunity</b><br>The first step is not yet specific. Ask: “What is one concrete action you could take, who might you contact, and when?” This does not alter the participant’s Plan Readiness score.</div>':'';
 const privateFlag=d.private_conversation_requested?'<div class="coachPrompt"><b>Private conversation requested</b><br>The participant has asked to talk privately with a Career Coach. No reason or sensitive information was collected.</div>':'';
 const supportHtml=(d.requested_support||[]).map(k=>supports[k]).filter(Boolean).map(v=>'<span class="chip">'+esc(v)+'</span>').join('');
 return '<section class="section mindMap"><h3>My Path Forward · Pinal Mind Map '+badge+'</h3>'+
 '<p class="notice">Optional post-O*NET reflection. The two ratings are coaching indicators, not eligibility or employability decisions.</p>'+
 '<div class="miniGrid mindScores">'+mini('Participant readiness',self===null?'Not selected':self+' / 10')+mini('Plan Readiness',score===null?'Insufficient information':score+' / 10')+mini('Coaching stage',d.category||'Insufficient information')+'</div>'+
 '<div class="coachPrompt"><b>Readiness interpretation</b><br>'+esc(d.interpretation||'No interpretation available yet.')+'</div>'+
 refine+privateFlag+
 '<h4>Readiness dimensions</h4>'+dimensionsHtml+
 '<h4>Coach conversation starters</h4><ul class="mindPrompts">'+(coachQuestions.length?coachQuestions.map(q=>'<li>'+esc(q)+'</li>').join(''):'<li>What would be a useful first step for you?</li>')+'</ul>'+
 '<h4>What would help the participant move forward?</h4><div class="chips">'+(supportHtml||'<span class="notice">No support choices saved.</span>')+'</div>'+
 '<h4>Participant mind map</h4><div class="mindFields">'+fieldsHtml+'</div>'+
 '<h4>Options to explore</h4><div class="chips">'+(optionsHtml||'<span class="notice">No options selected.</span>')+'</div>'+
 historyHtml+'</section>';
}
'''
anchor = 'function answerLabel(k,v)'
if anchor not in s:
    raise SystemExit('Coach report renderer insertion anchor missing')
s = s.replace(anchor, mindmap_js + anchor, 1)
find_discover = "module==='discover_me'?discoverHtml(ct.discover_me)"
if find_discover not in s:
    raise SystemExit('Discover Me detail routing anchor missing')
s = s.replace(find_discover, "module==='discover_me'?discoverHtml(ct.discover_me)+pinalMindMapHtml(p?.county==='Pinal'?ct.my_path_forward:null)", 1)
find_all = "discoverHtml(ct.discover_me)+exploreHtml(ct.explore_careers)"
if find_all not in s:
    raise SystemExit('All-modules detail routing anchor missing')
s = s.replace(find_all, "discoverHtml(ct.discover_me)+(p?.county==='Pinal'?pinalMindMapHtml(ct.my_path_forward):'')+exploreHtml(ct.explore_careers)", 1)
mind_css = """
<style>
.mindMap{border-top:3px solid #4e9c8a;padding-top:16px}
.mindMap h4{color:#254e64;margin:16px 0 8px}
.mindFields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.mindField{border:1px solid #d3e1e6;border-radius:10px;padding:12px;background:#f6f9fa;min-width:0}
.mindField b{font-size:11px;color:#284a5e}
.mindField p{font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0 0}
.mindScores .mini strong{font-size:16px;overflow-wrap:anywhere}
.mindPrompts li{margin:7px 0;font-size:12px;line-height:1.5}
.mindHistory{margin-top:14px;border:1px solid #cfdee4;padding:12px;border-radius:10px}
.mindHistory summary{cursor:pointer;font-weight:800}
@media(max-width:680px){.mindFields{grid-template-columns:1fr}}
</style>
"""
if '</head>' not in s:
    raise SystemExit('Coach CSS insertion anchor missing')
s=s.replace('</head>',mind_css+'</head>',1)
career.write_text(s,encoding='utf-8')
print('Integrated optional Pinal My Path Forward inside Discover Me coach detail; core 3-module progress unchanged.')
