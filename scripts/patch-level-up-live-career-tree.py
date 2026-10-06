from pathlib import Path

p=Path('public/level-up-live.html')
s=p.read_text(encoding='utf-8')

card_old='''<div class="module next" id="moneyCard"><small>Life skill</small><h3>Money Moves</h3><p>Use practical tools to plan spending, protect priorities, and build financial stability.</p><span class="badge" id="moneyStatus">Available</span><div><button class="btn" id="launchMoney" type="button">Launch Money Moves</button></div></div>
</div></div></section>'''
card_new='''<div class="module next" id="moneyCard"><small>Life skill</small><h3>Money Moves</h3><p>Use practical tools to plan spending, protect priorities, and build financial stability.</p><span class="badge" id="moneyStatus">Available</span><div><button class="btn" id="launchMoney" type="button">Launch Money Moves</button></div></div>
<div class="module next" id="careerTreeCard"><small>Career exploration</small><h3>Career Skill Tree</h3><p>Explore interests, career fit, LMI, and possible career branches together.</p><span class="badge">Optional • Facilitated</span><div><button class="btn purple" id="launchCareerTree" type="button">Launch Career Tree</button></div></div>
</div></div></section>'''
if card_old in s:
    s=s.replace(card_old,card_new,1)
elif 'id="careerTreeCard"' not in s:
    raise SystemExit('Career Tree card insertion point not found')

launch_old="$('launchMoney').onclick=()=>{const u=new URL('facilitator-money.html',location.href);u.searchParams.set('room',room);u.searchParams.set('from','level-up-live');location.href=u.toString()};$('moneyCard').className='module '+(sessionState.completed.includes('money-moves')?'done':'next');$('moneyStatus').textContent=sessionState.completed.includes('money-moves')?'Complete ✓':'Available';$('launchMoney').textContent=sessionState.completed.includes('money-moves')?'Review Money Moves':'Launch Money Moves';"
launch_new=launch_old+"$('launchCareerTree').onclick=()=>{const u=new URL('https://pinalworkforce1-del.github.io/Level_Up_Portal/career-skill-tree/');u.searchParams.set('entry','map');u.searchParams.set('mode','facilitated');u.searchParams.set('from','level-up-live');u.searchParams.set('room',room);u.hash='home';location.href=u.toString()};"
if launch_old in s and "$('launchCareerTree').onclick" not in s:
    s=s.replace(launch_old,launch_new,1)
elif "$('launchCareerTree').onclick" not in s:
    raise SystemExit('Career Tree launch insertion point not found')

p.write_text(s,encoding='utf-8')
print('Level Up Live now launches Career Tree in facilitated mode using the existing classroom room code.')
