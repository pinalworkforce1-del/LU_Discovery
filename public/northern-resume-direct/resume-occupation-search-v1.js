/* Northern BOOST — searchable O*NET occupations and alternate job titles.
 * The participant's exact résumé title is independent of their optional O*NET classification.
 * O*NET 31.0 data: U.S. Department of Labor, CC BY 4.0.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
const fullUrl='onet-occupation-catalog-v31.json';
let dataPromise=null,records=[],catalogReady=false,controller=null,version=null;
function load(){
 if(dataPromise)return dataPromise;
 dataPromise=(async()=>{
  const response=await fetch(fullUrl,{cache:'force-cache'});
  if(!response.ok)throw new Error('O*NET occupation catalog not yet published.');
  const data=await response.json();
  if(data.version!=='31.0'||!Array.isArray(data.occupations)||data.occupations.length<950||!Array.isArray(data.jobTitles)||data.jobTitles.length<20000)throw new Error('O*NET occupation catalog incomplete.');
  const byCode=new Map(data.occupations.map(row=>[row[0],{code:row[0],onetTitle:row[1],description:row[2]||''}]));
  const index=new Map();
  for(const row of data.occupations){
   const occ=byCode.get(row[0]);if(!occ)continue;
   const title=window.R2WOccupationTitles?.resolve(occ.onetTitle).title||occ.onetTitle;
   const key=normalize(title)+'|'+occ.code;
   index.set(key,{...occ,title,kind:'occupation'});
  }
  for(const [title,code] of data.jobTitles){
   const occ=byCode.get(code);if(!occ)continue;
   const label=String(title||'').trim();if(!label||label.length>125)continue;
   const key=normalize(label)+'|'+code;
   if(!index.has(key))index.set(key,{...occ,title:label,kind:'alternate'});
  }
  records=[...index.values()].map(row=>({...row,normalized:normalize(row.title),occupationNormalized:normalize(row.onetTitle)}));
  catalogReady=true;
  return records;
 })();
 return dataPromise.catch(e=>{dataPromise=null;throw e});
}
function fallback(){
 return (window.R2WOccupationTitles?.entries||[]).map(x=>({
  code:'',title:x.title,onetTitle:x.onetTitle,description:'',kind:'occupation',
  normalized:normalize(x.title),occupationNormalized:normalize(x.onetTitle),aliasNormalized:(x.aliases||[]).map(normalize)
 }));
}
function search(query,limit=9){
 const q=normalize(query);if(q.length<2)return [];
 const words=q.split(' ').filter(Boolean);
 const scored=[];
 for(const record of (catalogReady?records:fallback())){
  const title=record.normalized,occupation=record.occupationNormalized;
  let score=0;
  if(title===q)score=1000;
  else if(title.startsWith(q))score=850;
  else if(title.split(' ').some(w=>w.startsWith(q)))score=650;
  else if(title.includes(q))score=550;
  else if(words.every(w=>title.includes(w)))score=450;
  else if(occupation.startsWith(q))score=350;
  else if(words.every(w=>occupation.includes(w)))score=250;
  else if((record.aliasNormalized||[]).some(alias=>alias===q||alias.startsWith(q)))score=500;
  if(!score)continue;
  if(record.kind==='occupation')score+=8;
  if(title.length>65)score-=10;
  scored.push({...record,score});
 }
 scored.sort((a,b)=>b.score-a.score||a.title.length-b.title.length||a.title.localeCompare(b.title));
 const used=new Set(),results=[];
 for(const row of scored){
  const key=normalize(row.title)+'|'+row.code;
  if(used.has(key))continue;
  used.add(key);results.push(row);
  if(results.length>=limit)break;
 }
 return results;
}
function init(options){
 if(controller)return controller;
 const input=$('rbTarget'),box=$('rbOccupationResults'),status=$('rbOccupationStatus');
 if(!input||!box)return null;
 let current=[],activeIndex=-1,dirty=false;
 const get=options.get;
 const save=options.save;
 function setStatus(message){if(status)status.textContent=message||'';}
 function close(){box.hidden=true;box.innerHTML='';current=[];activeIndex=-1;input.setAttribute('aria-expanded','false');}
 function currentVersion(){return get()?.version||null;}
 function metadata(){
  const v=currentVersion();if(!v)return;
  const title=input.value.trim();
  if(v.target!==title){v.target=title;}
  const resolved=window.R2WOccupationTitles?.resolve(title);
  // Exact known labels can be classified safely; all other edited titles become unclassified.
  if(resolved?.matched){
   v.onetOccupationTitle=resolved.onetTitle;
   v.onetOccupationCode='';
   v.onetOccupationConfirmed=true;
  }else{
   v.onetOccupationTitle='';
   v.onetOccupationCode='';
   v.onetOccupationConfirmed=false;
  }
 }
 function choose(record){
  const v=currentVersion();if(!v)return;
  input.value=record.title;v.target=record.title;
  v.onetOccupationTitle=record.onetTitle;
  v.onetOccupationCode=record.code||'';
  v.onetOccupationConfirmed=true;
  const d=get()?.data;if(d)d.target=record.title;
  save();close();
  setStatus('Selected '+record.title+'. O*NET occupation: '+record.onetTitle+(record.code?' ('+record.code+')':'')+'.');
  options.preview?.();input.focus();
 }
 function custom(){
  const title=input.value.trim();if(!title){input.focus();return;}
  const v=currentVersion();if(!v)return;
  v.target=title;v.onetOccupationTitle='';v.onetOccupationCode='';v.onetOccupationConfirmed=false;
  const d=get()?.data;if(d)d.target=title;
  save();close();setStatus('Using your exact job title. No O*NET occupation has been assigned. Nova will use the job description you provide.');
  options.preview?.();input.focus();
 }
 function render(){
  const query=input.value.trim();
  if(query.length<2){close();setStatus('Type at least two letters to search occupations or enter your exact job title.');return;}
  current=search(query);
  activeIndex=-1;
  const v=currentVersion();
  const confirmed=v?.onetOccupationConfirmed&&v?.target===query;
  const source=catalogReady?'O*NET 31.0 occupations and alternate job titles':'Suggested titles (full O*NET catalog loading)';
  box.innerHTML='<div class="occupation-search-heading">'+esc(source)+'</div>'+
   current.map((row,i)=>'<button type="button" class="occupation-result" role="option" aria-selected="false" data-index="'+i+'"><strong>'+esc(row.title)+'</strong><small>'+esc(row.onetTitle)+(row.code?' · '+esc(row.code):'')+'</small></button>').join('')+
   '<button type="button" class="occupation-custom" data-custom="true">Use my exact job title: <strong>'+esc(query)+'</strong><small>No occupation classification is required.</small></button>';
  box.hidden=false;input.setAttribute('aria-expanded','true');
  box.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>choose(current[Number(button.dataset.index)]));
  box.querySelector('[data-custom]').onclick=custom;
  setStatus(confirmed?'O*NET classification selected. You can change your target or use an exact job title.':'Choose an occupation match, or keep your exact job title.');
 }
 function refresh(){
  const v=currentVersion();
  if(!v){close();return;}
  if(v.onetOccupationConfirmed&&v.onetOccupationTitle&&v.target===input.value){
   setStatus('O*NET occupation: '+v.onetOccupationTitle+(v.onetOccupationCode?' ('+v.onetOccupationCode+')':'')+'.');
  }else if(v.target){
   setStatus('Exact job title saved. O*NET occupation not assigned; Nova can still use your job description.');
  }else{
   setStatus('Search occupations, or type the exact title from a job posting.');
  }
  close();
 }
 function onInput(){
  metadata();save();options.preview?.();render();
 }
 input.removeAttribute('list');
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
 input.setAttribute('aria-controls','rbOccupationResults');input.setAttribute('aria-expanded','false');
 input.addEventListener('input',onInput);
 input.addEventListener('focus',()=>{if(input.value.trim().length>=2)render();});
 input.addEventListener('keydown',event=>{
  if(box.hidden)return;
  const choices=[...box.querySelectorAll('button')];
  if(event.key==='Escape'){close();return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();activeIndex=(activeIndex+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;
   choices.forEach((x,i)=>{x.classList.toggle('active',i===activeIndex);x.setAttribute('aria-selected',String(i===activeIndex));});
  }
  if(event.key==='Enter'&&activeIndex>=0){event.preventDefault();choices[activeIndex].click();}
 });
 document.addEventListener('click',event=>{if(event.target!==input&&!box.contains(event.target))close();});
 controller={refresh,search,load};
 load().then(()=>{if(document.activeElement===input&&input.value.trim().length>=2)render();else refresh();}).catch(()=>setStatus('Full occupation catalog is temporarily unavailable. Suggested titles and custom job titles still work.'));
 refresh();
 return controller;
}
window.R2WOccupationSearch={init,search,load};
})();