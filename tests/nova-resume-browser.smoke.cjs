// Browser smoke test: fake auth/AI/API only. Never writes participant or production data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const userId = '00000000-0000-4000-8000-000000000001';
 const jwt = [Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 const page = await browser.newPage({viewport:{width:1450,height:1000}});
 let errors=[], savedProfiles=[], savedVersions=[], readyRows=[], aiCalls=[];
 try {
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => await d.accept());
  await page.addInitScript(({jwt,userId}) => {
   localStorage.setItem('sb-dnijrzotfyvmmnmueknk-auth-token',JSON.stringify({access_token:jwt,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock',user:{id:userId}}));
  },{jwt,userId});
  await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('https://dnijrzotfyvmmnmueknk.supabase.co/**', async route => {
   const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
   let status=200,body={};
   if(path.endsWith('/resume_profiles') && method==='GET') body=[{master_data:{contact:{name:'Existing Legacy Participant'},role:'Original Role',bullets:[],summary:'Original summary',untouchedLegacy:'retain-this'}}];
   else if(path.endsWith('/resume_profiles') && method==='POST'){savedProfiles.push(JSON.parse(req.postData()||'{}'));status=201;}
   else if(path.endsWith('/resume_versions') && method==='POST'){const val=JSON.parse(req.postData()||'{}');savedVersions.push(val);body=[{id:'10000000-0000-4000-8000-'+String(savedVersions.length).padStart(12,'0')}];status=201;}
   else if(path.endsWith('/expo_resume_ready') && method==='POST'){readyRows.push({payload:JSON.parse(req.postData()||'{}'),url:req.url()});status=201;}
   else if(path.endsWith('/resume-ai') && method==='POST'){const val=JSON.parse(req.postData()||'{}');aiCalls.push(val);body=val.mode==='bullet'?(aiCalls.filter(a=>a.mode==='bullet').length===1?{needsClarification:true,question:'What specific tasks did you perform?',clearDirect:'',skillsForward:''}:{clearDirect:'Assisted customers with purchases and organized inventory during scheduled shifts.',skillsForward:'Provided customer service and maintained organized inventory during scheduled shifts.',needsClarification:false,integrityFailed:false}):val.mode==='job_match'?{alreadyShowing:[],mightBeThere:[],notShowingYet:[],notes:[]}:{error:'unsupported_mode'};}
   else if(path.endsWith('/user')) body={id:userId};
   await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  await page.goto('http://127.0.0.1:8765/LU_Discovery/nova-resume-port/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('resumeBuilderStatus')?.textContent.includes('connected'),null,{timeout:15000});
  assert.equal(await page.locator('#rbNext').isVisible(),true,'Next control visible');
  await page.locator('#rbContactName').fill('Studio Test Participant');
  await page.locator('#rbEmail').fill('test@example.invalid');
  await page.locator('#rbTarget').fill('Retail Associate');
  await page.locator('#rbNext').click();
  assert.equal(await page.locator('[data-resume-step="1"]').isVisible(),true,'Experience step visible');
  await page.locator('#rbRoleTitle').fill('Store Assistant');
  await page.locator('#rbEmployer').fill('Neighborhood Store');
  await page.locator('#rbEvidence').fill('I assisted customers with purchases and organized shelves during regular shifts.');
  await page.locator('#rbBuildBullet').click();
  await page.locator('#rbNovaAnswer').waitFor({timeout:12000});
  await page.locator('#rbNovaAnswer').fill('I organized shelves, guided customers to products, and checked inventory lists.');
  await page.locator('#rbNovaContinue').click();
  await page.locator('#rbBulletChoices .rosie-draft').first().waitFor({timeout:12000});
  await page.locator('#rbBulletChoices .rosie-draft').first().click();
  assert.equal(aiCalls.filter(a=>a.mode==='bullet').length,2,'Clarification triggers second AI bullet call');
  assert.equal(aiCalls[1]?.evidence?.story.includes('I organized shelves'),true,'Clarifying answer sent as source evidence');
  assert.equal(aiCalls[0]?.evidence?.story.includes('I assisted customers'),true,'AI evidence mapped');
  await page.locator('#rbNext').click();
  assert.equal(await page.locator('[data-resume-step="2"]').isVisible(),true,'Skills step visible');
  await page.locator('#rbSkills').fill('Customer service, Inventory, Teamwork');
  await page.locator('#rbEducation').fill('High school diploma');
  await page.locator('#rbNext').click();
  assert.equal(await page.locator('[data-resume-step="3"]').isVisible(),true,'Review step visible');
  await page.locator('#rbSummary').fill('Customer-focused professional with retail experience.');
  await page.locator('#rbIntegrity').check();
  await page.locator('#rbReady').check();
  await page.locator('#rbNext').click();
  await page.waitForFunction(() => document.getElementById('resumeBuilderStatus')?.textContent.includes('Résumé version saved'),null,{timeout:15000});
  assert.equal(savedVersions.length,1,'Saved a completed version');
  assert.equal(savedVersions[0].version_data.contact.name,'Studio Test Participant','Canonical name in version');
  assert.equal(savedVersions[0].version_data.untouchedLegacy,'retain-this','Legacy data retained');
  assert(savedProfiles.some(x=>x.master_data?.untouchedLegacy==='retain-this'),'Original profile fields preserved in draft');
  assert.equal(savedVersions[0].version_data.bullets.some(b=>b.bullet?.length>20),true,'Ready 2 Work compatibility bullets');
  await page.locator('#rbFinalizeExpo').click();
  await page.waitForFunction(() => document.getElementById('resumeBuilderStatus')?.textContent.includes('Expo sharing'),null,{timeout:15000});
  assert.equal(savedVersions.length,2,'Separate finalized version saved');
  assert.equal(readyRows.length,1,'Expo ready marker created');
  assert.equal(readyRows[0].payload.resume_version_id,'10000000-0000-4000-8000-000000000002');
  assert(savedProfiles.some(x=>x.master_data?.levelUpNovaStudio),'Nova draft saved in Level Up profile');
  assert.equal(errors.length,0,'No page JavaScript exceptions: '+errors.join('; '));
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/nova-studio.png',fullPage:true});
  console.log('PASS: four steps, Nova evidence request, canonical version, Expo handoff; all requests mocked.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});