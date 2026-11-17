/* Shared participant / authorized coach PDF report renderer.
   Sensitive interview evidence stays in memory and is never uploaded to a third-party PDF service.
   The caller must provide data from an authenticated Level Up endpoint. */
(function(global){
  'use strict';
  const objects=new WeakMap();
  const pdfName=(name)=>String(name||'Participant').replace(/[^a-z0-9 _-]/gi,'').trim().replace(/\s+/g,'-').slice(0,45)||'Participant';
  const clean=(value)=>String(value??'').trim();
  const safePdf=(value)=>clean(value).replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
    .replace(/[\u2013\u2014]/g,'-').replace(/[\u2022]/g,'-').replace(/\u00a0/g,' ');
  const intScore=(value)=>Number.isInteger(value)&&value>=1&&value<=5?value:null;
  function normalize(feedback,evidence,participantName){
    const f=feedback&&typeof feedback==='object'?feedback:{};
    const e=evidence&&typeof evidence==='object'?evidence:{};
    const prompts=Array.isArray(e.required_questions)?e.required_questions:[];
    const answers=Array.isArray(e.answer_evidence)?e.answer_evidence:[];
    const questions=(Array.isArray(f.questions)?f.questions:[]).map((row,position)=>{
      const index=Number.isInteger(row?.index)?row.index:position;
      return {
        index,question:clean(prompts[index]?.text||prompts[index]?.question||row?.question||'Interview question'),
        answer:clean(row?.primary_response||answers[index]?.response||answers[index]?.answer),
        score:intScore(row?.score),strength:clean(row?.strength),growth:clean(row?.growth),
        practice:clean(row?.stronger_approach),
        followups:(Array.isArray(row?.followup_feedback)?row.followup_feedback:[]).map(x=>({
          question:clean(x?.question_text),response:clean(x?.response_text),score:intScore(x?.score),
          strength:clean(x?.strength),growth:clean(x?.growth)
        }))
      };
    }).filter(x=>x.index>=0);
    const b=e.conversation_balance||null;
    const participantPct=b&&Number.isFinite(Number(b.participant_percent))?Number(b.participant_percent):null;
    const interviewerPct=b&&Number.isFinite(Number(b.interviewer_percent))?Number(b.interviewer_percent):null;
    return {
      name:clean(participantName)||'Participant',
      date:clean(e.completed_at||e.ended_at||f.completed_at),
      occupation:clean(e.occupation||e.interview_role||''),
      overview:clean(f.overview),questions,
      goals:(Array.isArray(f.next_steps)?f.next_steps:[]).map(clean).filter(Boolean),
      balance:participantPct===null||interviewerPct===null?null:{participant:participantPct,interviewer:interviewerPct}
    };
  }
  function makeDocument(doc,model){
    const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=46,R=W-M,limit=H-59,content=W-M*2;
    const colors={navy:[18,43,67],teal:[21,107,136],light:[226,235,241],muted:[89,107,121],ink:[33,51,67]};
    let y=53;
    const color=(rgb)=>doc.setTextColor(...rgb);
    const reset=()=>{doc.setFont('helvetica','normal');doc.setFontSize(10.5);color(colors.ink)};
    const page=()=>{doc.addPage();y=55};
    function space(height){if(y+height>limit)page()}
    function paragraph(text,options={}){
      const size=options.size||10.5,spacing=options.spacing??7,lh=options.lineHeight||size*1.45;
      doc.setFont('helvetica',options.bold?'bold':'normal');doc.setFontSize(size);color(options.muted?colors.muted:colors.ink);
      const lines=doc.splitTextToSize(safePdf(text)||'Not provided.',content-(options.indent||0));
      if(lines.length*lh+spacing<=limit-55&&y+lines.length*lh+spacing>limit)page();
      for(const line of lines){space(lh);doc.text(line,M+(options.indent||0),y);y+=lh}
      y+=spacing;reset();
    }
    function heading(text){
      space(40);y+=12;doc.setFont('helvetica','bold');doc.setFontSize(13);color(colors.teal);
      doc.text(safePdf(text),M,y);y+=8;doc.setDrawColor(...colors.light);doc.line(M,y,R,y);y+=15;reset();
    }
    function field(label,value){
      if(!clean(value))return;
      space(45);
      paragraph(label,{bold:true,spacing:1,size:9.5});
      paragraph(value,{spacing:10});
    }
    // Page header
    doc.setFillColor(...colors.navy);doc.rect(0,0,W,97,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(151,225,243);
    doc.text('LEVEL UP  /  INTERVIEW INTELLIGENCE',M,33);
    doc.setFontSize(19);doc.setTextColor(255,255,255);doc.text("Nova's Interview Reflection",M,64);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Developmental practice feedback  |  Not a hiring assessment',M,83);
    y=115;reset();
    paragraph('Participant: '+model.name,{bold:true,size:11,spacing:3});
    if(model.occupation)paragraph('Career focus: '+model.occupation,{size:9.5,spacing:2});
    if(model.date){const d=new Date(model.date);paragraph('Completed: '+(Number.isNaN(d.getTime())?model.date:d.toLocaleDateString('en-US')),{size:9.5,spacing:5})}
    heading('Conversation balance');
    if(model.balance){
      paragraph('Your words: '+model.balance.participant+'%   |   Jacqueline: '+model.balance.interviewer+'%',{bold:true,spacing:4});
      paragraph('The 80/20 participant/interviewer ratio is a practice guideline, not a score. These percentages estimate transcript word counts, not measured speaking time.',{muted:true,size:9,spacing:8});
    }else paragraph('Conversation balance was not available for this session.',{muted:true,size:9});
    heading("Nova's interview overview");
    paragraph(model.overview||'No overview is available.');
    heading('Your questions and growth opportunities');
    for(const q of model.questions){
      space(105);
      paragraph('QUESTION '+(q.index+1)+': '+q.question,{bold:true,size:11,spacing:3});
      if(q.score!==null)paragraph('Answer quality: '+q.score+' / 5 (developmental indicator)',{size:9,muted:true,spacing:5});
      field('Your response',q.answer||'Response text not available in this report.');
      field('Strength demonstrated',q.strength);
      field('Growth opportunity',q.growth);
      field('Practice suggestion',q.practice);
      if(q.followups.length){
        paragraph('Follow-up conversation',{bold:true,size:10,spacing:3});
        for(const follow of q.followups){
          field('Jacqueline asked',follow.question);
          if(follow.response)field('Your follow-up response',follow.response);
          if(follow.score!==null)paragraph('Follow-up answer quality: '+follow.score+' / 5',{muted:true,size:9,spacing:3});
          field('What you demonstrated',follow.strength);
          field('Next improvement',follow.growth);
        }
      }
      space(12);y+=5;doc.setDrawColor(...colors.light);doc.line(M,y,R,y);y+=12;
    }
    heading("Nova's suggested practice goals");
    if(model.goals.length){model.goals.forEach((goal,i)=>paragraph((i+1)+'. '+goal,{spacing:6}))}
    else paragraph('No additional goals were included in this report.');
    const pages=doc.internal.getNumberOfPages();
    for(let n=1;n<=pages;n++){
      doc.setPage(n);doc.setDrawColor(...colors.light);doc.line(M,H-43,R,H-43);
      doc.setFont('helvetica','normal');doc.setFontSize(8);color(colors.muted);
      doc.text('LEVEL UP  /  Confidential participant coaching reflection',M,H-28);
      doc.text('Page '+n+' of '+pages,R,H-28,{align:'right'});
    }
    reset();
  }
  async function createPdf(model){
    const {jsPDF}=await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm');
    const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter',compress:true});
    makeDocument(doc,model);
    return doc.output('blob');
  }
  function clear(container){
    const prior=objects.get(container);
    if(prior?.url)URL.revokeObjectURL(prior.url);
    objects.delete(container);
    const frame=container.querySelector('iframe[data-interview-pdf]');
    if(frame)frame.removeAttribute('src');
  }
  async function render(options){
    const {container,downloadButton,feedback,evidence,participantName}=options||{};
    if(!container)throw Error('A report container is required.');
    clear(container);
    const model=normalize(feedback,evidence,participantName);
    if(!model.questions.length||!model.overview)throw Error('The saved feedback report is incomplete. Please try again.');
    const blob=await createPdf(model);
    const url=URL.createObjectURL(blob);
    objects.set(container,{url,blob});
    const iframe=container.querySelector('iframe[data-interview-pdf]');
    if(!iframe){URL.revokeObjectURL(url);objects.delete(container);throw Error('The PDF preview area was not found.')}
    iframe.src=url+'#toolbar=1&navpanes=0';
    iframe.title="Nova's interview feedback report";
    container.hidden=false;
    if(downloadButton){
      downloadButton.hidden=false;
      downloadButton.disabled=false;
      downloadButton.onclick=()=>{
        const link=document.createElement('a');
        link.href=url;link.download='Level-Up-Interview-Feedback-'+pdfName(model.name)+'.pdf';
        document.body.append(link);link.click();link.remove();
      };
    }
    return model;
  }
  global.LevelUpInterviewReport={render,clear,normalize};
})(window);
