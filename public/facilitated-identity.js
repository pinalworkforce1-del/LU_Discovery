const ENDPOINT='https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-facilitated';
const TOKEN_KEY='levelup-facilitated-access-v1';
const PROFILE_KEY='levelup-facilitated-profile-v1';
const RECOVERY_KEY='levelup-facilitated-recovery-v1';

async function call(body){
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok){const err=new Error(data?.message||data?.error||'Facilitated Level Up service unavailable.');err.status=res.status;err.data=data;throw err}
  return data;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function saveIdentity(data){
  if(data?.token)localStorage.setItem(TOKEN_KEY,data.token);
  if(data?.participant)localStorage.setItem(PROFILE_KEY,JSON.stringify(data.participant));
  if(data?.recovery_code)localStorage.setItem(RECOVERY_KEY,data.recovery_code);
}
function styles(){
  if(document.getElementById('levelupIdentityStyles'))return;
  const s=document.createElement('style');s.id='levelupIdentityStyles';
  s.textContent='.luid-backdrop{position:fixed;inset:0;z-index:99999;background:#030814e8;display:grid;place-items:center;padding:18px;font-family:Inter,Segoe UI,Arial,sans-serif}.luid-card{width:min(520px,100%);max-height:92vh;overflow:auto;background:linear-gradient(160deg,#f9fcfd,#eef6f7);color:#19313d;border:1px solid #81cdd5;border-radius:22px;box-shadow:0 35px 120px #000b;padding:24px}.luid-kicker{font-size:10px;letter-spacing:.12em;font-weight:950;color:#237283;text-transform:uppercase}.luid-card h2{margin:5px 0 8px;color:#102d49}.luid-card p{line-height:1.5;color:#566b76}.luid-fields{display:grid;gap:11px;margin-top:16px}.luid-fields label{display:grid;gap:5px;font-size:11px;font-weight:900;color:#536876}.luid-fields input,.luid-fields select{width:100%;padding:12px;border-radius:11px;border:1px solid #b9ccd5;background:#fff;color:#17303c;font:inherit}.luid-btn{width:100%;margin-top:14px;border:0;border-radius:999px;padding:12px 15px;background:#123e61;color:#fff;font-weight:950;cursor:pointer}.luid-btn.gold{background:#e4a72b;color:#172d39}.luid-btn.alt{background:#e7eef2;color:#183b50;border:1px solid #c5d4dd}.luid-error{display:none;margin-top:10px;padding:10px;border-radius:10px;background:#fcebed;color:#873844;font-size:12px}.luid-error.show{display:block}.luid-code{font-size:28px;letter-spacing:.12em;text-align:center;font-weight:1000;color:#102d49;background:#fff7db;border:1px solid #e5c25f;border-radius:14px;padding:14px;margin:14px 0}.luid-note{font-size:11px;color:#677b86;line-height:1.45}.luid-saved{background:#eaf6ef;border-left:5px solid #2f7d4c;border-radius:10px;padding:11px;margin-top:12px;font-size:12px}';
  document.head.appendChild(s);
}
function shell(){
  styles();const root=document.createElement('div');root.className='luid-backdrop';root.innerHTML='<div class="luid-card" id="luidCard"></div>';document.body.appendChild(root);return root
}
async function joinFlow(room){
  const root=shell(),card=root.querySelector('#luidCard'),prior=readJson(PROFILE_KEY)||{};
  return await new Promise(resolve=>{
    function joinForm(message=''){
      card.innerHTML='<div class="luid-kicker">Level Up Live</div><h2>Join this facilitated session</h2><p>Enter your name and email so your Level Up progress can continue across sessions. No password or email link is required.</p><div class="luid-fields"><label>First and last name<input id="luidName" autocomplete="name" value="'+esc(prior.display_name||'')+'"></label><label>Email address<input id="luidEmail" type="email" autocomplete="email" value="'+esc(prior.email||'')+'"></label><label>County<select id="luidCounty"><option value="">Choose county</option><option value="Pinal" '+(prior.county==='Pinal'?'selected':'')+'>Pinal</option><option value="Northern" '+(prior.county==='Northern'?'selected':'')+'>Northern</option><option value="UFO - Eastern New Mexico" '+(prior.county==='UFO - Eastern New Mexico'?'selected':'')+'>UFO - Eastern New Mexico</option></select></label></div><button class="luid-btn" id="luidJoin">Join Level Up</button><div class="luid-error '+(message?'show':'')+'" id="luidError">'+esc(message)+'</div><div class="luid-note" style="margin-top:12px">Your email identifies your facilitated Level Up record. Personal module reflections remain private unless you explicitly choose to share them later.</div>';
      card.querySelector('#luidJoin').onclick=async()=>{
        const display_name=card.querySelector('#luidName').value.trim(),email=card.querySelector('#luidEmail').value.trim(),county=card.querySelector('#luidCounty').value;
        const btn=card.querySelector('#luidJoin');btn.disabled=true;btn.textContent='Joining…';
        try{
          const data=await call({action:'join',room,display_name,email,county});saveIdentity(data);
          card.innerHTML='<div class="luid-kicker">Save this code</div><h2>You’re connected</h2><p>This device will reconnect automatically. Keep this recovery code in case you use a different device or clear your browser.</p><div class="luid-code">'+esc(data.recovery_code)+'</div><div class="luid-saved"><b>Progress is now durable.</b><br>Your facilitated module completion can continue across multiple days.</div><button class="luid-btn gold" id="luidContinue">Continue to Level Up</button><div class="luid-note">This code is not a password for your email account. It only reconnects this facilitated Level Up record.</div>';
          card.querySelector('#luidContinue').onclick=()=>{root.remove();resolve(data)}
        }catch(err){
          if(err.status===409&&err.data?.recovery_required){recoveryForm(email);return}
          joinForm(err.message)
        }
      }
    }
    function recoveryForm(email=''){
      const savedCode=localStorage.getItem(RECOVERY_KEY)||'';
      card.innerHTML='<div class="luid-kicker">Reconnect Level Up</div><h2>We found prior facilitated progress</h2><p>Enter the recovery code from your first facilitated session. This avoids waiting for an email sign-in link.</p><div class="luid-fields"><label>Email address<input id="luidEmail" type="email" value="'+esc(email||prior.email||'')+'"></label><label>Recovery code<input id="luidRecovery" autocapitalize="characters" autocomplete="off" placeholder="ABCD-EFGH" value="'+esc(savedCode)+'"></label></div><button class="luid-btn" id="luidRecover">Reconnect My Progress</button><button class="luid-btn alt" id="luidBack">← Use a different email</button><div class="luid-error" id="luidError"></div>';
      card.querySelector('#luidBack').onclick=()=>joinForm();
      card.querySelector('#luidRecover').onclick=async()=>{
        const btn=card.querySelector('#luidRecover');btn.disabled=true;btn.textContent='Reconnecting…';
        try{
          const data=await call({action:'recover',room,email:card.querySelector('#luidEmail').value.trim(),recovery_code:card.querySelector('#luidRecovery').value.trim()});saveIdentity(data);root.remove();resolve(data)
        }catch(err){card.querySelector('#luidError').textContent=err.message;card.querySelector('#luidError').classList.add('show');btn.disabled=false;btn.textContent='Reconnect My Progress'}
      }
    }
    joinForm();
  })
}
export async function initFacilitatedIdentity({room}){
  const clean=String(room||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
  let token=localStorage.getItem(TOKEN_KEY)||'';
  if(token){
    try{
      const data=await call({action:'resume',room:clean,token});saveIdentity(data);
      return api(clean,data)
    }catch(err){
      if(err.status===401)localStorage.removeItem(TOKEN_KEY)
    }
  }
  const data=await joinFlow(clean);
  return api(clean,data)
}
function api(room,data){
  const token=localStorage.getItem(TOKEN_KEY)||data?.token||'';
  return {
    room,
    participant:data?.participant||readJson(PROFILE_KEY),
    recoveryCode:localStorage.getItem(RECOVERY_KEY)||'',
    progress:Array.isArray(data?.progress)?data.progress:[],
    async refresh(){const next=await call({action:'resume',room,token});saveIdentity(next);this.participant=next.participant;this.progress=next.progress||[];return next},
    async saveProgress(module_id,{journey_state={},xp=0,is_complete=false}={}){return call({action:'save_progress',room,token,module_id,journey_state,xp,is_complete})},
    async saveInsight(module_id,insight_key,insight_value,{insight_type='participant_priority',share_scope='participant'}={}){return call({action:'save_insight',room,token,module_id,insight_key,insight_value,insight_type,share_scope})}
  }
}
