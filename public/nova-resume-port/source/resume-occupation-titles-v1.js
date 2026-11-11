/* Northern BOOST résumé target titles.
 * Participant-facing labels are job titles, not plural O*NET occupational groups.
 * Retain standardized O*NET category labels separately for matching and context.
 * Never guess at custom titles or replace participant-entered job titles.
 */
(()=>{
  'use strict';
  const entries=[
    {title:'Cashier',onet:'Cashiers',aliases:['cashier','cashiers','checkout cashier','retail cashier']},
    {title:'Retail Sales Associate',onet:'Retail Salespersons',aliases:['retail sales associate','retail salesperson','sales associate']},
    {title:'Stocker',onet:'Stockers and Order Fillers',aliases:['stock associate','stock clerk','inventory stocker']},
    {title:'Tractor-Trailer Truck Driver',onet:'Heavy and Tractor-Trailer Truck Drivers',aliases:['cdl','truck','truck driver','tractor trailer','tractor-trailer','tractor trailer driver','tractor-trailer driver','cdl driver','heavy equipment tractor trailer drivers']},
    {title:'IT Support Specialist',onet:'Computer User Support Specialists',aliases:['it','it support','help desk','tech support','computer support specialist']},
    {title:'Network Support Specialist',onet:'Computer Network Support Specialists',aliases:['network','network support','network technician']},
    {title:'Medical Assistant',onet:'Medical Assistants',aliases:['ma']},
    {title:'Nursing Assistant',onet:'Nursing Assistants',aliases:['cna','nurse aide']},
    {title:'Registered Nurse',onet:'Registered Nurses',aliases:['rn']},
    {title:'Machinist',onet:'Machinists',aliases:[]},
    {title:'CNC Machine Operator',onet:'Computer Numerically Controlled Tool Operators',aliases:['cnc','cnc operator','cnc machinist','cnc machine operator']},
    {title:'Welder',onet:'Welders, Cutters, Solderers, and Brazers',aliases:['weld','welding','welder','welder / fabricator']},
    {title:'Electrician',onet:'Electricians',aliases:['electrical']},
    {title:'Construction Laborer',onet:'Construction Laborers',aliases:['construction worker','construction laborer']},
    {title:'HVAC Technician',onet:'Heating, Air Conditioning, and Refrigeration Mechanics and Installers',aliases:['hvac','heating and cooling','air conditioning','hvac technician']},
    {title:'Customer Service Representative',onet:'Customer Service Representatives',aliases:['customer service','csr','customer support representative']}
  ];
  const key=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
  const index=new Map();
  for(const entry of entries){
    for(const label of [entry.title,entry.onet,...entry.aliases]){
      index.set(key(label),entry);
    }
  }
  function resolve(value){
    const raw=String(value||'').trim().replace(/\s+/g,' ');
    const entry=index.get(key(raw));
    return entry?{title:entry.title,onetTitle:entry.onet,matched:true}:{title:raw,onetTitle:'',matched:false};
  }
  function migrate(data){
    if(!data||typeof data!=='object')return false;
    let changed=false;
    const versions=Array.isArray(data.versions)?data.versions:[];
    for(const version of versions){
      if(!version||typeof version!=='object'||!version.target)continue;
      const result=resolve(version.target);
      if(result.matched){
        if(version.target!==result.title){version.target=result.title;changed=true;}
        if(version.onetOccupationTitle!==result.onetTitle){version.onetOccupationTitle=result.onetTitle;changed=true;}
      }else if(version.onetOccupationTitle&&!version.onetOccupationConfirmed){
        // A custom job title must not carry a stale occupational reference.
        version.onetOccupationTitle='';changed=true;
      }
    }
    // Legacy résumé imports often carried only a target label, not a version target.
    // Initialize the active version while preserving any participant-entered job title.
    const current=versions[data.activeVersion||0];
    if(current&&!String(current.target||'').trim()&&String(data.target||'').trim()){
      const result=resolve(data.target);
      current.target=result.title;
      if(result.matched){current.onetOccupationTitle=result.onetTitle;current.onetOccupationConfirmed=true;}
      changed=true;
    }
    const active=versions[data.activeVersion||0];
    if(active?.target){
      if(data.target!==active.target){data.target=active.target;changed=true;}
    }else if(data.target){
      const result=resolve(data.target);
      if(result.matched&&result.title!==data.target){data.target=result.title;changed=true;}
    }
    if(data.careerTarget){
      const result=resolve(data.careerTarget);
      if(result.matched&&result.title!==data.careerTarget){data.careerTarget=result.title;changed=true;}
    }
    return changed;
  }
  window.R2WOccupationTitles={resolve,migrate,entries:entries.map(({title,onet,aliases})=>({title,onetTitle:onet,aliases:aliases.slice()}))};
})();