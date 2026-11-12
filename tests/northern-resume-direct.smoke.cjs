const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[],requests=[],completedVersions=[],completedProgress=[];
 page.on('console',msg=>{if(msg.text().startsWith('LEVELUP_SAVED_VERSION:')){try{completedVersions.push(JSON.parse(msg.text().slice('LEVELUP_SAVED_VERSION:'.length)))}catch(e){errors.push(e.message)}}});
 page.on('console',msg=>{if(msg.text().startsWith('LEVELUP_SAVED_PROGRESS:')){try{completedProgress.push(JSON.parse(msg.text().slice('LEVELUP_SAVED_PROGRESS:'.length)))}catch(e){errors.push(e.message)}}});
 // Do not open the production Level Up UI in the isolated test.
 await page.route('https://pinalworkforce1-del.github.io/Level_Up_Portal/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Level Up return intercepted by smoke test</title>'}));
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('dialog',d=>d.accept());
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'application/javascript',body:
  `window.supabase={createClient:()=>({
    auth:{getSession:async()=>({data:{session:{access_token:'mock-account-token'}},error:null}),
          getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}},error:null})},
    from(table){return {
      select(){const filters={};const selection={eq(k,v){filters[k]=v;return selection;},maybeSingle:async()=>{
        if(table==='resume_versions'){
          const versions=JSON.parse(localStorage.getItem('__mock_versions')||'[]');
          const item=versions.find(x=>x.id===filters.id&&x.user_id===filters.user_id);
          return {data:item||null,error:null};
        }
        return {data:localStorage.getItem('__mock_master')?{master_data:JSON.parse(localStorage.getItem('__mock_master'))}:null,error:null};
      }};return selection;},
      upsert:async(row)=>{if(table==='resume_profiles')localStorage.setItem('__mock_master',JSON.stringify(row.master_data));if(table==='module_progress'){const a=JSON.parse(localStorage.getItem('__mock_progress')||'[]');const idx=a.findIndex(x=>x.user_id===row.user_id&&x.module_id===row.module_id);if(idx>=0)a[idx]=row;else a.push(row);localStorage.setItem('__mock_progress',JSON.stringify(a));console.log('LEVELUP_SAVED_PROGRESS:'+JSON.stringify(row));}return {error:null}},
      insert:row=>({select:()=>({single:async()=>{const a=JSON.parse(localStorage.getItem('__mock_versions')||'[]');const id='10000000-0000-4000-8000-'+String(a.length+1).padStart(12,'0');a.push({...row,id});localStorage.setItem('__mock_versions',JSON.stringify(a));console.log('LEVELUP_SAVED_VERSION:'+JSON.stringify(row));return {data:{id},error:null}}})})
    }}
  })};`
 }));
 await page.route('https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-nova-resume-discovery-staging',async route=>{
  const val=JSON.parse(route.request().postData()||'{}');
  assert.ok(val.narrative.includes('Honor Society'),'Discovery reads raw narrative');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   intro:'I found three accomplishments.',
   items:[
    {title:'School achievement',source:'Maintained a 4.0 GPA and joined the Honor Society.',category:'education'},
    {title:'Team leadership',source:'Served as football team captain.',category:'leadership'},
    {title:'Event coordination',source:'Coordinated volunteers and schedules for a school dance.',category:'experience'}
   ]
  })});
 });
 await page.route('https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-nova-resume-ai-staging',async route=>{
  const val=JSON.parse(route.request().postData()||'{}');requests.push(val);
  let data={};
  if(val.mode==='bullet' && String(val.evidence?.currentEvidence||'').includes('football team captain')){
   data={needsClarification:false,clearDirect:'Served as football team captain, coordinating teammates during team activities.',skillsForward:'Demonstrated team leadership as football captain while supporting team coordination.'};
  }else if(val.mode==='bullet'){
   data=requests.filter(x=>x.mode==='bullet').length===1?
    {needsClarification:true,question:'Which tasks did you personally complete?',clearDirect:'',skillsForward:''}:
    {needsClarification:false,clearDirect:'Organized stock and supported customer requests during assigned shifts.',skillsForward:'Provided customer support while maintaining organized inventory during assigned shifts.'};
  }else if(val.mode==='summary')data={summary:'Customer service and inventory experience.',needsClarification:false,question:''};
  else if(val.mode==='alignment')data={strongMatch:[],emphasizeMore:[],gaps:[],coachNote:''};
  else if(val.mode==='format_recommendation')data={recommendedFormat:'hybrid',formatLabel:'Hybrid',confidence:'medium',reason:'Verified skills',signals:[],targetingAdvice:'',gapGuidance:'',coachNote:''};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 try{
  await page.goto('http://127.0.0.1:8765/LU_Discovery/northern-resume-direct/index.html?from=ready-2-work#resume-builder',{waitUntil:'domcontentloaded'});
  await page.locator('#northernGate').waitFor({state:'hidden',timeout:20000});
  assert.equal(await page.locator('#viewResumeBuilder').isVisible(),true,'Original résumé builder opened');
  assert.equal(await page.locator('#luResumeWorkspace').count(),1,'Workspace mounted after cloud connection');
  assert.equal(await page.locator('.resume-builder-head').evaluate(el=>el.nextElementSibling?.id),'luResumeWorkspace','Workspace sits below the résumé heading');
  assert.equal(await page.locator('#rbTarget').locator('xpath=..').textContent().then(s=>s.includes('BOOST/TalentSync')),false,'No backend branding in participant target help');
  assert.ok((await page.locator('#rbEmployer').locator('xpath=..').textContent()).includes('work, school, or volunteer'),'School and volunteer roles are welcomed');
  assert.equal(await page.locator('[data-resume-section="experience"] h3').textContent(),'Relevant Experience','First-job-friendly experience heading');
  assert.equal(await page.locator('#rbSkillsCoachCard').evaluate(el=>el.nextElementSibling?.querySelector('#rbSkills')!==null),true,'Skills review comes before the participant skills field');

  await page.locator('#rbContactName').fill('Test Participant');
  await page.locator('#rbEmail').fill('test@example.invalid');
  await page.locator('#rbTarget').fill('Cashier');
  await page.locator('#rbNext').click();
  assert.equal(await page.locator('[data-resume-step="1"]').isVisible(),true,'Original experience step visible');
  await page.locator('#rbEmployer').fill('Volunteer Team');
  await page.locator('#rbRoleTitle').fill('Volunteer Coordinator');
  await page.locator('#rbEvidence').fill('Maintained a 4.0 GPA and joined the Honor Society. Served as football team captain. Coordinated volunteers and schedules for a school dance.');
  await page.locator('#luFindAccomplishments').click();
  await page.locator('#luDiscoveryResults button').first().waitFor({timeout:15000});
  assert.equal(await page.locator('#luDiscoveryResults button').count(),3,'Nova separates three accomplishments');
  assert.equal(await page.locator('#rpExperienceList').getByText('Maintained a 4.0 GPA',{exact:false}).count(),0,'Discovery does not auto-add any accomplishment');
  await page.locator('#luDiscoveryResults button').nth(2).click();
  assert.equal(await page.locator('#rbEvidence').inputValue(),'Coordinated volunteers and schedules for a school dance.','Participant chooses a distinct theme');
  assert.ok((await page.locator('#luDiscoveryOriginal').textContent()).includes('Served as football team captain'),'Full original story remains in saved discovery panel');
  assert.equal(await page.locator('#luDiscoveryResults button').count(),3,'All three accomplishments stay available after selection');
  const initialDiscovery=await page.evaluate(()=>JSON.parse(localStorage.getItem('levelup-northern-direct-r2w-v1')).resumeBuilder.novaDiscoveryCollections[0]);
  assert.equal(initialDiscovery.items.length,3,'Discovery backlog stored inside résumé progress');
  assert.ok(initialDiscovery.original.includes('Maintained a 4.0 GPA'),'Raw story saved in résumé progress');

  // Choosing an accomplishment should start Nova coaching without a second button click.
  await page.locator('.rosie-reply-wrap textarea').waitFor({timeout:15000});
  assert.equal(await page.locator('#rbBuildBullet').isHidden(),true,'Redundant purple coaching action hidden in discovery flow');
  await page.locator('.rosie-reply-wrap textarea').fill('I checked inventory lists and organized items on shelves.');
  await page.locator('.rosie-send-btn').click();
  await page.locator('#rbCommitSelectedBullet').waitFor({timeout:15000});
  const history=requests.filter(x=>x.mode==='bullet');
  assert.equal(history[0].evidence.followUpCount,0,'First Nova question starts at zero');
  assert.equal(history[1].evidence.followUpCount,1,'Second Nova request knows a clarification was already given');
  assert.equal((await page.locator('#rbEvidence').inputValue()).includes('\\n'),false,'No literal escaped newline characters in evidence');
  assert.ok((await page.locator('#rbEvidence').inputValue()).includes('\n'),'Follow-up answer separated by a real newline');

  assert.equal(await page.locator('#rbCommitSelectedBullet').isDisabled(),true,'No draft automatically selected');
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),0,'Draft not auto-added');
  const buttons=page.locator('#rbBulletChoices [data-rb-draft]');
  await buttons.first().click();
  assert.equal(await buttons.first().getAttribute('aria-pressed'),'true','First draft highlighted');
  assert.equal(await page.locator('#rbCommitSelectedBullet').isEnabled(),true,'Explicit Add enabled');
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),0,'Selecting does not save');
  await page.locator('#rbCommitSelectedBullet').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('levelup-northern-direct-r2w-v1')).resumeBuilder.novaDiscoveryCollections[0].items[2].status==='complete',null,{timeout:20000});
  await page.locator('#luDiscoveryNextActions').waitFor({state:'visible',timeout:15000});
  assert.equal(await page.locator('#luDiscoveryNext').isVisible(),true,'Next accomplishment is offered adjacent to saved bullet');
  assert.equal(await page.locator('#luDiscoveryAnother').isVisible(),true,'Another bullet option clearly available');
  assert.equal(await page.locator('#luDiscoveryFinish').isVisible(),true,'Finish experience option clearly available');
  assert.equal(await page.locator('#rbExperienceActions').isHidden(),true,'Legacy competing actions hidden during discovered experience');

  assert.equal(await page.locator('#luDiscoveryResults button').count(),3,'Other themes remain available after saving first bullet');
  assert.ok((await page.locator('#luDiscoveryOriginal').textContent()).includes('Served as football team captain'),'Original story remains accessible after adding bullet');
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('levelup-northern-direct-r2w-v1')).resumeBuilder.novaDiscoveryCollections[0])).items.filter(x=>x.status==='pending').length,2,'Other two themes remain pending');
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),1,'Chosen bullet appears');
  await buttons.nth(1).click();
  await page.locator('#rbCommitSelectedBullet').click();
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),0,'Prior draft replaced');
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'Only replacement remains');
  await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('__mock_master')||'{}').levelUpNorthernDirectResume,null,{timeout:20000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#northernGate').waitFor({state:'hidden',timeout:20000});
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'Saved bullet survived reload');
  assert.equal(await page.locator('#luDiscoveryResults button').count(),3,'All discovered themes survive reload');
  assert.ok((await page.locator('#luDiscoveryOriginal').textContent()).includes('Served as football team captain'),'Unchanged original story survives reload');
  assert.ok((await page.locator('#luDiscoveryResults').textContent()).includes('✓ Added'),'Approved theme is marked complete after reload');
  await page.locator('#luDiscoveryNextActions').waitFor({state:'visible',timeout:15000});
  await page.locator('#luDiscoveryNext').click();
  assert.equal(await page.locator('#rbBuildBullet').isHidden(),true,'One-click Nova coaching does not show duplicate action');

  assert.equal(await page.locator('#rbEvidence').inputValue(),'Maintained a 4.0 GPA and joined the Honor Society.','Guided next action picks the first pending discovery');
  // Select another pending accomplishment to verify multi-bullet preserving behavior.
  await page.locator('#luDiscoveryResults button').nth(1).click();
  assert.equal(await page.locator('#rbEvidence').inputValue(),'Served as football team captain.','Second accomplishment restores its own source');
  await page.locator('#rbCommitSelectedBullet').waitFor({timeout:15000});
  await page.locator('#rbBulletChoices [data-rb-draft]').first().click();
  await page.locator('#rbCommitSelectedBullet').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('levelup-northern-direct-r2w-v1')).resumeBuilder.novaDiscoveryCollections[0].items[1].status==='complete',null,{timeout:15000});
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'First accomplishment remains after second is approved');
  assert.equal(await page.locator('#rpExperienceList').getByText('Served as football team captain',{exact:false}).count(),1,'Second accomplishment becomes its own bullet');
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('levelup-northern-direct-r2w-v1')).resumeBuilder.novaDiscoveryCollections[0])).items.filter(x=>x.status==='pending').length,1,'Third accomplishment is still available');
  assert.equal(await page.locator('#luDiscoveryNextActions').isVisible(),true,'Guided next action returned after the second approved bullet');
  await page.locator('#luDiscoveryFinish').click();
  assert.equal(await page.locator('[data-resume-step="2"]').isVisible(),true,'Finish choice moves to Skills and Education');



  await page.locator('#rbSkills').fill('Customer service, Inventory management');
  await page.locator('#rbNext').click();
  await page.locator('#rbSummary').fill('Customer-focused volunteer with inventory and event support experience.');
  await page.locator('#rbIntegrity').check();
  await page.locator('#rbReady').check();
  await page.locator('#rbNext').click();
  await page.waitForURL('https://pinalworkforce1-del.github.io/Level_Up_Portal/career-tree-next/ready-2-work/#map',{timeout:20000});
  assert.equal(completedVersions.length,1,'A single completed Level Up résumé version was inserted before redirect');
  const version=completedVersions[0].version_data;
  assert.equal(version.contact.name,'Test Participant','Canonical participant name');
  assert.equal(version.levelUpEntryPoint,'ready-2-work','Completed version records originating module');
  assert.equal(version.levelUpResumeCompletionSource,'resume-rise','Ready 2 Work completion provenance is explicit');
  const progress=completedProgress;
  assert.equal(progress.length,1,'Exactly one source-specific module progression record written');
  assert.equal(progress[0].module_id,'ready2work-resume-rise','Ready 2 Work writes only Resume Rise completion');
  assert.equal(progress[0].is_complete,true,'Resume Rise completion confirmed');
  assert.equal(progress.some(x=>x.module_id==='resume-district'),false,'Resume District journey never auto-completed by résumé creation');

  assert.equal(version.bullets.length,2,'Separate approved accomplishments appear as distinct résumé bullets');
  assert.equal(version.bullets[0].bullet.startsWith('Provided customer support'),true);
  // A second, blank résumé must never replace the saved original in the workspace.
  await page.goto('http://127.0.0.1:8765/LU_Discovery/northern-resume-direct/index.html?from=ready-2-work#resume-builder',{waitUntil:'domcontentloaded'});
  await page.locator('#luResumeWorkspace select option').first().waitFor({state:'attached',timeout:20000});
  // Snapshot identity must be stable on repeat finish; changed verified content must create a new immutable version.
  const initialVersionCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_versions')||'[]').length);
  const repeatId=await page.evaluate(()=>window.LEVELUP_NOVA_R2W.complete());
  const duplicateCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_versions')||'[]').length);
  assert.equal(duplicateCount,initialVersionCount,'Completing an unchanged résumé does not insert a duplicate version');
  assert.ok(repeatId,'Existing completed version ID is retained');
  await page.locator('#rbSummary').fill('Updated summary demonstrating a new verified résumé snapshot.');
  await page.evaluate(()=>window.LEVELUP_NOVA_R2W.flush());
  const updatedId=await page.evaluate(()=>window.LEVELUP_NOVA_R2W.complete());
  const changedVersions=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_versions')||'[]'));
  assert.equal(changedVersions.length,initialVersionCount+1,'Edited résumé creates a new saved version');
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_progress')||'[]'))).length,1,'Retargeting/updating does not duplicate progression records');

  assert.notEqual(updatedId,repeatId,'Changed content gets a distinct completed-version ID');
  assert.equal(changedVersions[0].version_data.summary,'Customer-focused volunteer with inventory and event support experience.','Historical version content remains intact');
  assert.equal(await page.locator('#luResumeWorkspace select option').count(),1,'Original résumé becomes the first workspace item');
  await page.locator('#luResumeWorkspace button').click();
  await page.waitForURL(url=>url.href.includes('/northern-resume-direct/index.html'),{timeout:20000});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('__mock_master')||'{}').levelUpNorthernResumeWorkspace?.items?.length===2,null,{timeout:20000});
  await page.locator('#luResumeWorkspace select option').nth(1).waitFor({state:'attached',timeout:20000});
  assert.equal(await page.locator('#rbTarget').inputValue(),'','New résumé begins without target');
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),0,'New résumé excludes the old experience bullets');
  const savedWorkspace=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_master')).levelUpNorthernResumeWorkspace);
  assert.equal(savedWorkspace.items[0].resume.experiences[0].bullets[0].startsWith('Provided customer support'),true,'Original résumé preserved in the cloud workspace');
  await page.locator('#luResumeWorkspace select').selectOption(savedWorkspace.items[0].id);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('__mock_master')||'{}').levelUpNorthernResumeWorkspace?.activeId===JSON.parse(localStorage.getItem('__mock_master')||'{}').levelUpNorthernResumeWorkspace?.items?.[0]?.id,null,{timeout:20000});
  await page.locator('#luResumeWorkspace select option').first().waitFor({state:'attached',timeout:20000});
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'Switching back restores original résumé');
  // Selecting a historical saved-version card must open THAT version, without
  // replacing the current working draft or mutating the completed snapshot.
  const historicalId='20000000-0000-4000-8000-000000000001';
  await page.evaluate(id=>{
    const a=JSON.parse(localStorage.getItem('__mock_versions')||'[]');
    a.push({id,user_id:'00000000-0000-4000-8000-000000000001',
      version_name:'Historical event coordinator',target_role:'Event Coordinator',
      occupation_code:'',version_data:{
        contact:{name:'Historical Participant',email:'historical@example.invalid'},
        role:'Event Coordinator',summary:'Previously saved historical summary.',
        education:'High School Diploma',roleSkills:['Scheduling','Communication'],
        bullets:[{bullet:'Coordinated student events, schedules, and tournament activities.'}]
      }});
    localStorage.setItem('__mock_versions',JSON.stringify(a));
  },historicalId);
  const preservedBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_versions')).find(x=>x.id==='20000000-0000-4000-8000-000000000001'));
  await page.goto('http://127.0.0.1:8765/LU_Discovery/northern-resume-direct/index.html?from=resume-district&version='+historicalId+'#resume-builder',{waitUntil:'domcontentloaded'});
  await page.locator('#northernGate').waitFor({state:'hidden',timeout:20000});
  await page.locator('#luResumeWorkspace select option').last().waitFor({state:'attached',timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#rbTarget')?.value==='Event Coordinator',null,{timeout:15000});
  assert.equal(await page.locator('#rbTarget').inputValue(),'Event Coordinator','Selected historical version opens its own target');
  assert.equal(await page.locator('#rbSummary').inputValue(),'Previously saved historical summary.','Selected version restores its own content');
  assert.equal((await page.locator('#rpExperienceList').textContent()).includes('Coordinated student events'),true,'Selected version retains historical bullets');
  const newlyOpened=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_master')).levelUpNorthernResumeWorkspace);
  assert.equal(newlyOpened.items.filter(x=>x.sourceVersionId==='20000000-0000-4000-8000-000000000001').length,1,'One linked editable copy of selected version');
  assert.equal(newlyOpened.items.some(x=>x.resume.experiences?.some(y=>y.bullets?.some(b=>b.startsWith('Provided customer support while maintaining organized inventory')))),true,'Original separate working résumé preserved: '+JSON.stringify(newlyOpened.items.map(x=>({title:x.title,sourceVersionId:x.sourceVersionId,bullets:x.resume.experiences?.map(y=>y.bullets)}))));
  const preservedAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_versions')).find(x=>x.id==='20000000-0000-4000-8000-000000000001'));
  assert.deepEqual(preservedAfter,preservedBefore,'Opening historical version does not alter immutable saved snapshot');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#northernGate').waitFor({state:'hidden',timeout:20000});
  assert.equal(await page.locator('#rbTarget').inputValue(),'Event Coordinator','Selected historical version persists after reload');
  const workspaceAfterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_master')).levelUpNorthernResumeWorkspace);
  assert.equal(workspaceAfterReload.items.filter(x=>x.sourceVersionId===historicalId).length,1,'Reload does not create duplicate workspace copies');

  // A fresh launch from Resume District preserves that entry context on exit.
  await page.route('https://pinalworkforce1-del.github.io/Resume_District/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Resume District return intercepted</title>'}));
  await page.goto('http://127.0.0.1:8765/LU_Discovery/northern-resume-direct/index.html?from=resume-district#resume-builder',{waitUntil:'domcontentloaded'});
  await page.locator('#northernGate').waitFor({state:'hidden',timeout:20000});
  assert.equal(await page.evaluate(()=>window.LEVELUP_NOVA_R2W.origin),'resume-district','Origin persists from Resume District entry');
  const beforeDistrict=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_progress')||'[]'));
  await page.evaluate(()=>window.LEVELUP_NOVA_R2W.complete());
  const afterDistrict=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_progress')||'[]'));
  assert.equal(afterDistrict.length,beforeDistrict.length,'Resume District entry never writes Resume Rise progression');
  assert.equal(afterDistrict.some(x=>x.module_id==='resume-district'),false,'Resume District journey completion remains independent');

  await page.evaluate(()=>window.LEVELUP_NOVA_R2W.navigateBack());
  await page.waitForURL('https://pinalworkforce1-del.github.io/Resume_District/',{timeout:20000});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS direct Northern port: identity, stages, Nova clarification, select/highlight, explicit Add, replace, reload, save Level Up version');
 }catch(e){
  console.error('Direct-port browser diagnostic:',JSON.stringify({
   gateText:await page.locator('#northernGateText').textContent().catch(()=>null),
   visibleView:await page.locator('#viewResumeBuilder').isVisible().catch(()=>null),
   pageErrors:errors,
   url:page.url()
  },null,2));
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});