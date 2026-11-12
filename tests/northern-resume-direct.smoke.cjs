const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[],requests=[],completedVersions=[];
 page.on('console',msg=>{if(msg.text().startsWith('LEVELUP_SAVED_VERSION:')){try{completedVersions.push(JSON.parse(msg.text().slice('LEVELUP_SAVED_VERSION:'.length)))}catch(e){errors.push(e.message)}}});
 // Do not open the production Level Up UI in the isolated test.
 await page.route('https://pinalworkforce1-del.github.io/Level_Up_Portal/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Level Up return intercepted by smoke test</title>'}));
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('dialog',d=>d.accept());
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'application/javascript',body:
  `window.supabase={createClient:()=>({
    auth:{getSession:async()=>({data:{session:{access_token:'mock-account-token'}},error:null}),
          getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}},error:null})},
    from(table){return {
      select(){return {eq(){return {maybeSingle:async()=>({data:localStorage.getItem('__mock_master')?{master_data:JSON.parse(localStorage.getItem('__mock_master'))}:null,error:null})}}}},
      upsert:async(row)=>{if(table==='resume_profiles')localStorage.setItem('__mock_master',JSON.stringify(row.master_data));return {error:null}},
      insert:row=>({select:()=>({single:async()=>{const a=JSON.parse(localStorage.getItem('__mock_versions')||'[]');a.push(row);localStorage.setItem('__mock_versions',JSON.stringify(a));console.log('LEVELUP_SAVED_VERSION:'+JSON.stringify(row));return {data:{id:'10000000-0000-4000-8000-'+String(a.length).padStart(12,'0')},error:null}}})})
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
 await page.route('https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-nova-staged-resume-ai',async route=>{
  const val=JSON.parse(route.request().postData()||'{}');requests.push(val);
  let data={};
  if(val.mode==='bullet'){
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
  assert.equal(await page.locator('#rbBulletChoices [data-rb-draft]').count(),0,'Choosing theme does not auto-draft a bullet');
  await page.locator('#rbEvidence').fill('I managed stock items and helped customers during special events.');
  await page.locator('#rbBuildBullet').click();
  await page.locator('.rosie-reply-wrap textarea').waitFor({timeout:15000});
  await page.locator('.rosie-reply-wrap textarea').fill('I checked inventory lists and organized items on shelves.');
  await page.locator('.rosie-send-btn').click();
  await page.locator('#rbCommitSelectedBullet').waitFor({timeout:15000});
  assert.equal(await page.locator('#rbCommitSelectedBullet').isDisabled(),true,'No draft automatically selected');
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),0,'Draft not auto-added');
  const buttons=page.locator('#rbBulletChoices [data-rb-draft]');
  await buttons.first().click();
  assert.equal(await buttons.first().getAttribute('aria-pressed'),'true','First draft highlighted');
  assert.equal(await page.locator('#rbCommitSelectedBullet').isEnabled(),true,'Explicit Add enabled');
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),0,'Selecting does not save');
  await page.locator('#rbCommitSelectedBullet').click();
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),1,'Chosen bullet appears');
  await buttons.nth(1).click();
  await page.locator('#rbCommitSelectedBullet').click();
  assert.equal(await page.locator('#rpExperienceList').getByText('Organized stock and supported customer requests',{exact:false}).count(),0,'Prior draft replaced');
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'Only replacement remains');
  await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('__mock_master')||'{}').levelUpNorthernDirectResume,null,{timeout:20000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#northernGate').waitFor({state:'hidden',timeout:20000});
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'Saved bullet survived reload');
  await page.locator('#rbNext').click();
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
  assert.equal(version.bullets.length,1,'One verified version bullet');
  assert.equal(version.bullets[0].bullet.startsWith('Provided customer support'),true);
  // A second, blank résumé must never replace the saved original in the workspace.
  await page.goto('http://127.0.0.1:8765/LU_Discovery/northern-resume-direct/index.html?from=ready-2-work#resume-builder',{waitUntil:'domcontentloaded'});
  await page.locator('#luResumeWorkspace select option').first().waitFor({state:'attached',timeout:20000});
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