// Static contract checks for the standalone Nova Studio; no participant data or network calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../public/nova-resume-port');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),studio=read('studio.js');
const scripts=['studio.js','source/resume-occupation-titles-v1.js','source/resume-occupation-search-v1.js','source/resume-format-v1.js','source/resume-evidence-review-v1.js'];
for(const script of scripts){new vm.Script(read(script),{filename:script});console.log('PASS JS syntax',script)}
const ids=[...studio.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
for(const id of new Set(ids)){assert(html.includes('id="'+id+'"')||studio.includes('id="'+id+'"'),'Missing DOM element '+id)}
console.log('PASS '+new Set(ids).size+' DOM IDs');
for(const file of ['source/styles.css','source/resume-polish-v1.css','source/resume-strategy-v1.css','source/resume-evidence-review-v1.css','source/resume-format-v1.css','source/resume-occupation-search-v1.css'])assert(fs.existsSync(path.join(root,file)),'Missing CSS '+file);
assert(!html.includes('BOOST_Pathway-Portal/ready-2-work-qa'),'Production BOOST CSS dependency');
const catalog=JSON.parse(read('onet-occupation-catalog-v31.json'));assert(catalog.occupations.length>=1000);assert(catalog.jobTitles.length>=50000);
console.log('PASS O*NET catalog',catalog.occupations.length,catalog.jobTitles.length);
assert(studio.includes("dnijrzotfyvmmnmueknk"),'Missing Level Up project');
assert(!studio.includes('dxcajwarqojvmbteroco'),'Northern backend referenced');
assert(studio.includes('expo_resume_ready'),'Missing Expo handoff');
assert(studio.includes('resume_saved=1'),'Missing Ready 2 Work return');
assert(studio.includes('version_data:finalizedVersion()'),'Canonical finalized version not saved');
console.log('PASS integration contract checks');
