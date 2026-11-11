const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('dialog',d=>d.accept());
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'application/javascript',body:
  `window.supabase={createClient:()=>({
    auth:{getSession:async()=>({data:{session:{access_token:'mock-account-token'}},error:null}),
          getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}},error:null})},
    from(table){return {
      select(){return {eq(){return {maybeSingle:async()=>({data:localStorage.getItem('__mock_master')?{master_data:JSON.parse(localStorage.getItem('__mock_master'))}:null,error:null})}}}},
      upsert:async(row)=>{if(table==='resume_profiles')localStorage.setItem('__mock_master',JSON.stringify(row.master_data));return {error:null}},
      insert:row=>({select:()=>({single:async()=>{const a=JSON.parse(localStorage.getItem('__mock_versions')||'[]');a.push(row);localStorage.setItem('__mock_versions',JSON.stringify(a));return {data:{id:'10000000-0000-4000-8000-'+String(a.length).padStart(12,'0')},error:null}}})})
    }}
  })};`
 }));
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
  await page.goto('http://127.0.0.1:8765/LU_Discovery/northern-resume-direct/index.html#resume-builder',{waitUntil:'domcontentloaded'});
  await page.locator('#northernGate[hidden]').waitFor({timeout:20000});
  assert.equal(await page.locator('#viewResumeBuilder').isVisible(),true,'Original résumé builder opened');
  await page.locator('#rbContactName').fill('Test Participant');
  await page.locator('#rbEmail').fill('test@example.invalid');
  await page.locator('#rbTarget').fill('Cashier');
  await page.locator('#rbNext').click();
  assert.equal(await page.locator('[data-resume-step="1"]').isVisible(),true,'Original experience step visible');
  await page.locator('#rbEmployer').fill('Volunteer Team');
  await page.locator('#rbRoleTitle').fill('Volunteer Coordinator');
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
  await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('__mock_master')||'{}').levelUpNorthernDirectResume,{timeout:20000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#northernGate[hidden]').waitFor({timeout:20000});
  assert.equal(await page.locator('#rpExperienceList').getByText('Provided customer support while maintaining organized inventory',{exact:false}).count(),1,'Saved bullet survived reload');
  await page.locator('#rbNext').click();
  await page.locator('#rbSkills').fill('Customer service, Inventory management');
  await page.locator('#rbNext').click();
  await page.locator('#rbSummary').fill('Customer-focused volunteer with inventory and event support experience.');
  await page.locator('#rbIntegrity').check();
  await page.locator('#rbReady').check();
  await page.locator('#rbNext').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('__mock_versions')||'[]').length===1,null,{timeout:20000});
  const versions=await page.evaluate(()=>JSON.parse(localStorage.getItem('__mock_versions')||'[]'));
  assert.equal(versions[0].version_data.contact.name,'Test Participant','Canonical participant name');
  assert.equal(versions[0].version_data.bullets.length,1,'One verified version bullet');
  assert.equal(versions[0].version_data.bullets[0].bullet.startsWith('Provided customer support'),true);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS direct Northern port: identity, stages, Nova clarification, select/highlight, explicit Add, replace, reload, save Level Up version');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});