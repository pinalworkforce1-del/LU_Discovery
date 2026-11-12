(() => {
  'use strict';

  const STORAGE_KEY = 'levelup-northern-direct-r2w-v1';
  const PATCH_VERSION = 'R2W45';
  const $ = id => document.getElementById(id);
  const nativeSetItem = Storage.prototype.setItem;

  const canonicalWords = new Map(Object.entries({
    'pos':'POS','cdl':'CDL','hvac':'HVAC','cna':'CNA','rn':'RN','it':'IT','ai':'AI',
    'walmart':'Walmart','linkedin':'LinkedIn','github':'GitHub','microsoft':'Microsoft',
    'excel':'Excel','powerpoint':'PowerPoint','quickbooks':'QuickBooks'
  }));
  const stopWords = new Set(['a','an','and','at','for','in','of','on','or','the','to','with']);
  const typoFixes = [
    [/\bcusomer\b/gi,'customer'],[/\bcostumer service\b/gi,'customer service'],
    [/\bmanagment\b/gi,'management'],[/\bmangement\b/gi,'management'],
    [/\bcommunicaton\b/gi,'communication'],[/\borginization\b/gi,'organization'],
    [/\brecieve\b/gi,'receive'],[/\bexperiance\b/gi,'experience'],[/\bprofesional\b/gi,'professional']
  ];
  const skillPatterns = [
    [/\b(?:pos|point[- ]of[- ]sale)(?:\s*\/\s*)?(?:cash handling)?\b/i,'POS / Cash Handling'],
    [/\bcash handling\b/i,'Cash Handling'],
    [/\bcustomer service\b/i,'Customer Service'],
    [/\btime management\b/i,'Time Management'],
    [/\border fulfillment\b/i,'Order Fulfillment'],
    [/\bpersonal shopping\b/i,'Personal Shopping'],
    [/\binventory(?: management)?\b/i,'Inventory Management'],
    [/\b(?:shelf[- ]?stocking|stocking)\b/i,'Stocking'],
    [/\bbarcode(?: scanning| verification)?\b/i,'Barcode Scanning'],
    [/\breturns? processing\b/i,'Returns Processing'],
    [/\battention to detail\b/i,'Attention to Detail'],
    [/\bproblem solving\b/i,'Problem Solving'],
    [/\bteamwork\b/i,'Teamwork'],
    [/\bcommunication\b/i,'Communication'],
    [/\bdata entry\b/i,'Data Entry'],
    [/\bquality control\b/i,'Quality Control'],
    [/\bforklift\b/i,'Forklift Operation'],
    [/\bmicrosoft office\b/i,'Microsoft Office'],
    [/\bexcel\b/i,'Microsoft Excel'],
    [/\bword\b/i,'Microsoft Word'],
    [/\bpowerpoint\b/i,'Microsoft PowerPoint'],
    [/\bcnc\b/i,'CNC'],
    [/\bweld(?:ing)?\b/i,'Welding']
  ];
  const evidenceSkillPatterns = [
    [/(customer|shopper|guest|client|return)/i,'Customer Service'],
    [/(checkout|cash|payment|register|\bpos\b)/i,'POS / Cash Handling'],
    [/(accurat|barcode|verification|quality)/i,'Attention to Detail'],
    [/(inventory|stock|shelf|shipment|product organization)/i,'Inventory / Stocking'],
    [/(online order|order fulfillment|personal shopping|deliver)/i,'Order Fulfillment'],
    [/(schedule|priorit|time management|deadline)/i,'Time Management'],
    [/(team|coworker|colleague|collaborat)/i,'Teamwork'],
    [/(problem|resolve|solution|issue)/i,'Problem Solving'],
    [/(communicat|explain|answering questions)/i,'Communication']
  ];

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function writeState(data) {
    if(data.resumeBuilder)data.resumeBuilder.lastEditedAt=new Date().toISOString();
    nativeSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('boost-r2w-external-update',{detail:{progress:data}}));
  }
  function resumeState(data = readState()) {
    data.resumeBuilder = data.resumeBuilder || {};
    const rb = data.resumeBuilder;
    rb.contact = rb.contact || {};
    rb.versions = Array.isArray(rb.versions) && rb.versions.length ? rb.versions : [{name:'Résumé 1',target:rb.target || '',jobDescription:'',summary:'',format:'hybrid',visualStyle:'modern'}];
    rb.activeVersion = Number.isInteger(rb.activeVersion) ? Math.max(0, Math.min(rb.versions.length - 1, rb.activeVersion)) : 0;
    return rb;
  }
  function defaultVersionName(v, i) {
    const target = String(v?.target || '').trim();
    return target || `Résumé ${i + 1}`;
  }
  function normalizeVersionNames(data) {
    const rb = resumeState(data);
    rb.versions.forEach((v, i) => { v.name = defaultVersionName(v, i); });
    return data;
  }

  // Keep saved résumé versions identifiable by target occupation even when the base app saves state.
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === STORAGE_KEY) {
      try {
        const parsed = JSON.parse(value);
        value = JSON.stringify(normalizeVersionNames(parsed));
      } catch (_) {}
    }
    return nativeSetItem.call(this, key, value);
  };

  function applyTypoFixes(value) {
    let out = String(value || '');
    typoFixes.forEach(([rx, replacement]) => { out = out.replace(rx, replacement); });
    return out;
  }
  function smartTitle(value) {
    const text = String(value || '').trim();
    if (!text) return text;
    return text.split(/(\s+|[-/])/).map((token, index, all) => {
      if (!token || /^\s+$/.test(token) || token === '-' || token === '/') return token;
      const bare = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.]+$/g, '');
      if (!bare) return token;
      const lower = bare.toLowerCase();
      let replacement = bare;
      if (canonicalWords.has(lower)) replacement = canonicalWords.get(lower);
      else if (/^[a-z]+$/.test(bare)) {
        const wordIndex = all.slice(0, index).filter(x => x && !/^\s+$/.test(x) && x !== '-' && x !== '/').length;
        replacement = (wordIndex > 0 && stopWords.has(lower)) ? lower : bare.charAt(0).toUpperCase() + bare.slice(1);
      }
      return token.replace(bare, replacement);
    }).join('');
  }
  function capitalizeSentence(value) {
    return String(value || '').replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase());
  }
  function hasLowercaseDisplayName(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    return text.split(/\s+/).some((word, i) => {
      const bare = word.replace(/[^A-Za-z]/g, '');
      if (!bare || !/^[a-z]+$/.test(bare)) return false;
      return i === 0 || !stopWords.has(bare);
    });
  }
  function hasKnownTypo(value) {
    return typoFixes.some(([rx]) => { rx.lastIndex = 0; return rx.test(String(value || '')); });
  }

  function canonicalSkillLabel(value) {
    let text = applyTypoFixes(String(value || '').trim()).replace(/^[-•]+\s*/, '');
    if (!text) return '';
    for (const [rx, label] of skillPatterns) if (rx.test(text) && text.replace(rx, '').trim().length < 4) return label;
    return smartTitle(text);
  }
  function parseSkills(raw) {
    const original = String(raw || '').trim();
    if (!original) return [];
    const fixed = applyTypoFixes(original);
    let items = [];
    if (/[\n,;|•]/.test(fixed)) {
      items = fixed.split(/[\n,;|•]+/).map(canonicalSkillLabel).filter(Boolean);
    } else {
      const found = [];
      for (const [rx, label] of skillPatterns) {
        rx.lastIndex = 0;
        if (rx.test(fixed)) found.push(label);
      }
      items = found.length ? found : [canonicalSkillLabel(fixed)];
    }
    items = [...new Map(items.map(x => [x.toLowerCase(), x])).values()];
    if (items.some(x => x === 'POS / Cash Handling')) items = items.filter(x => x !== 'Cash Handling');
    return items;
  }
  function currentEvidenceText() {
    const data = readState();
    const rb = resumeState(data);
    const stored = (rb.experiences || []).flatMap(x => [x.role, x.employer, x.experience, x.evidence, ...(Array.isArray(x.bullets) ? x.bullets : [])]).filter(Boolean).join(' ');
    return `${stored} ${$('rpExperienceList')?.textContent || ''} ${$('rbEvidence')?.value || ''}`;
  }
  function supportedSkillSuggestions() {
    const text = currentEvidenceText();
    const existing = new Set(parseSkills($('rbSkills')?.value || '').map(x => x.toLowerCase()));
    const found = [];
    evidenceSkillPatterns.forEach(([rx, label]) => {
      if (rx.test(text) && !existing.has(label.toLowerCase()) && !found.includes(label)) found.push(label);
    });
    return found.slice(0, 6);
  }

  function dispatchInput(el, value) {
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }

  function renderSkillsPreview() {
    const el = $('rpSkills');
    if (!el) return;
    const items = parseSkills($('rbSkills')?.value || el.textContent || '');
    if (!items.length) {
      el.className = '';
      el.textContent = 'Skills';
      return;
    }
    el.innerHTML = `<ul class="resume-skills-list ${items.length >= 6 ? 'two-column' : ''}">${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  }
  function updateSkillsCoach() {
    const feedback = $('rbSkillsFeedback');
    const suggestionsBox = $('rbSkillSuggestions');
    const organizeBtn = $('rbOrganizeSkills');
    if (!feedback || !suggestionsBox || !organizeBtn) return;
    const raw = $('rbSkills')?.value || '';
    const items = parseSkills(raw);
    const suggestions = supportedSkillSuggestions();
    const typo = hasKnownTypo(raw);
    const unseparated = raw.trim() && !/[\n,;|•]/.test(raw) && items.length > 1;
    let message = 'Add skills you can explain or demonstrate. I’ll help make them easy for an employer to scan.';
    if (items.length) {
      message = `I can organize ${items.length} verified skill${items.length === 1 ? '' : 's'} into a clean résumé list.`;
      if (unseparated) message += ' Right now several skills are running together.';
      if (typo) message += ' I also spotted a likely spelling issue I can clean up.';
      if (suggestions.length) message += ` I found ${suggestions.length} additional skill${suggestions.length === 1 ? '' : 's'} supported by your experience that you may want to add.`;
    }
    feedback.textContent = message;
    organizeBtn.disabled = !raw.trim();
    suggestionsBox.innerHTML = suggestions.length
      ? `<span class="skill-suggestion-label">Supported by your experience:</span>${suggestions.map(x => `<button type="button" class="skill-suggestion-chip" data-skill-add="${escapeAttr(x)}">＋ ${escapeHtml(x)}</button>`).join('')}`
      : '<span class="skill-suggestion-label">No additional skill suggestions yet. Keep building verified experience and Nova will keep checking.</span>';
  }
  function organizeSkills() {
    const el = $('rbSkills');
    if (!el) return;
    const items = parseSkills(el.value);
    if (!items.length) return;
    dispatchInput(el, items.join('\n'));
    setTimeout(() => { renderSkillsPreview(); updateSkillsCoach(); scrollToElement($('rbSkillsCoachCard')); }, 30);
  }
  function addSuggestedSkill(skill) {
    const el = $('rbSkills');
    if (!el) return;
    const items = parseSkills(el.value);
    if (!items.some(x => x.toLowerCase() === skill.toLowerCase())) items.push(skill);
    dispatchInput(el, items.join('\n'));
    setTimeout(() => { renderSkillsPreview(); updateSkillsCoach(); }, 30);
  }

  function collectPolishIssues() {
    const data = readState();
    const rb = resumeState(data);
    const issues = [];
    const capCount = [rb.contact?.name, rb.contact?.location, rb.target, ...(rb.experiences || []).flatMap(x => [x.role, x.employer])].filter(hasLowercaseDisplayName).length;
    if (capCount) issues.push({kind:'fix', text:`Capitalization: ${capCount} name, title, employer, location, or target field${capCount === 1 ? '' : 's'} could use consistent capitalization.`});
    const typoText = [rb.skills, rb.education, rb.summary, ...(rb.experiences || []).flatMap(x => [x.evidence, ...(Array.isArray(x.bullets) ? x.bullets : [])])].filter(Boolean).join(' ');
    if (hasKnownTypo(typoText)) issues.push({kind:'fix', text:'Spelling: I found a likely common typo that can be corrected without changing your meaning.'});
    const skills = parseSkills(rb.skills || '');
    if (String(rb.skills || '').trim() && (!/[\n,;|•]/.test(rb.skills) || skills.length >= 6)) issues.push({kind:'format', text:`Skills: format ${skills.length || 'the'} skill${skills.length === 1 ? '' : 's'} as a scannable bulleted list${skills.length >= 6 ? ' in two columns' : ''}.`});
    const genericNames = (rb.versions || []).filter((v, i) => !String(v.target || '').trim() || /^Résumé\s+\d+$/i.test(String(v.name || `Résumé ${i+1}`))).length;
    if (genericNames) issues.push({kind:'name', text:'Saved versions: use the target position as the default résumé name so each version is easy to identify.'});
    if (!issues.length) issues.push({kind:'ok', text:'No obvious capitalization, spacing, naming, or skills-formatting issues found. Review the content once more for accuracy before printing.'});
    return issues;
  }
  function renderPolishReview() {
    const box = $('rbPolishIssues');
    const btn = $('rbApplyPolish');
    if (!box || !btn) return;
    const issues = collectPolishIssues();
    box.innerHTML = issues.map(x => `<div class="polish-issue ${x.kind === 'ok' ? 'ok' : ''}"><span>${x.kind === 'ok' ? '✓' : '→'}</span><p>${escapeHtml(x.text)}</p></div>`).join('');
    btn.disabled = issues.every(x => x.kind === 'ok');
  }

  function applyPolishToStoredResume() {
    const data = readState();
    const rb = resumeState(data);
    rb.contact.name = smartTitle(applyTypoFixes(rb.contact.name || ''));
    rb.contact.location = smartTitle(applyTypoFixes(rb.contact.location || ''));
    rb.target = smartTitle(applyTypoFixes(rb.target || ''));
    rb.education = String(rb.education || '').split('\n').map(x => capitalizeSentence(applyTypoFixes(x.trim()))).filter(Boolean).join('\n');
    const skills = parseSkills(rb.skills || '');
    if (skills.length) rb.skills = skills.join('\n');
    rb.summary = capitalizeSentence(applyTypoFixes(rb.summary || ''));
    (rb.experiences || []).forEach(x => {
      x.role = smartTitle(applyTypoFixes(x.role || ''));
      x.employer = smartTitle(applyTypoFixes(x.employer || ''));
      x.evidence = capitalizeSentence(applyTypoFixes(x.evidence || ''));
      if (Array.isArray(x.bullets)) x.bullets = x.bullets.map(b => capitalizeSentence(applyTypoFixes(b)));
    });
    (rb.versions || []).forEach((v, i) => {
      v.target = smartTitle(applyTypoFixes(v.target || ''));
      v.summary = capitalizeSentence(applyTypoFixes(v.summary || ''));
      v.name = defaultVersionName(v, i);
    });
    const active = rb.versions[rb.activeVersion];
    if (active) {
      rb.target = active.target || rb.target;
      rb.summary = active.summary || rb.summary;
    }
    rb.step = 3;
    data.resumeBuilder = rb;
    sessionStorage.setItem('r2w45-polish-applied', '1');
    writeState(normalizeVersionNames(data));
    location.hash = '#resume-builder';
    location.reload();
  }

  function versionData() {
    const data = readState();
    const rb = resumeState(data);
    return {data, rb};
  }
  function renderVersionLabels() {
    const box = $('rbVersionSlots');
    if (!box) return;
    const {rb} = versionData();
    box.querySelectorAll('[data-version]').forEach(btn => {
      const i = Number(btn.dataset.version);
      const v = rb.versions[i] || {};
      const label = defaultVersionName(v, i);
      btn.textContent = `${label}${i === rb.activeVersion ? ' • Current' : ''}`;
      btn.title = `Open targeted résumé for ${label}`;
    });
    box.querySelectorAll('[data-version-add]').forEach(btn => {
      const i = Number(btn.dataset.versionAdd);
      btn.textContent = `＋ New targeted résumé ${i + 1}`;
    });
  }
  function normalizeStoredVersionNames() {
    const data = readState();
    if (!data.resumeBuilder) return;
    writeState(normalizeVersionNames(data));
  }

  function scrollToElement(el, focusEl) {
    if (!el) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const top = window.scrollY + el.getBoundingClientRect().top - 92;
      window.scrollTo({top: Math.max(0, top), behavior:'smooth'});
      if (focusEl) setTimeout(() => focusEl.focus({preventScroll:true}), 260);
    }));
  }
  function activeResumeStep() {
    return document.querySelector('.resume-step:not([hidden])');
  }
  function scrollToActiveStep() {
    const step = activeResumeStep();
    scrollToElement(step?.querySelector('h2') || step || $('rosieStepTitle'));
  }

  function injectSkillsCoach() {
    const skills = $('rbSkills');
    if (!skills || $('rbSkillsCoachCard')) return;
    skills.spellcheck = true;
    const label = skills.closest('label');
    const card = document.createElement('div');
    card.id = 'rbSkillsCoachCard';
    card.className = 'skills-coach-card';
    card.innerHTML = `
      <span class="eyebrow">NOVA'S SKILLS REVIEW</span>
      <strong>Make your skills easy to scan.</strong>
      <p id="rbSkillsFeedback">Add skills you can explain or demonstrate. I’ll help organize them for the résumé.</p>
      <div id="rbSkillSuggestions" class="skill-suggestions"></div>
      <button id="rbOrganizeSkills" class="rosie-ai-btn" type="button">✦ Nova: Organize & Format My Skills</button>`;
    // Let Nova surface evidence-backed suggestions before asking participants to enter skills.
    label.insertAdjacentElement('beforebegin', card);
    $('rbOrganizeSkills').addEventListener('click', organizeSkills);
    card.addEventListener('click', e => {
      const b = e.target.closest('[data-skill-add]');
      if (b) addSuggestedSkill(b.dataset.skillAdd);
    });
  }
  function injectPolishPanel() {
    if ($('rbPolishPanel')) return;
    const step = document.querySelector('.resume-step[data-resume-step="3"]');
    const anchor = step?.querySelector('.resume-review-panel');
    if (!anchor) return;
    const panel = document.createElement('div');
    panel.id = 'rbPolishPanel';
    panel.className = 'resume-polish-card';
    panel.innerHTML = `
      <span class="eyebrow">NOVA'S FINAL POLISH CHECK</span>
      <strong>Formatting, capitalization & consistency</strong>
      <p>Before you finish, I’ll flag presentation issues that can make a good résumé look unfinished. These fixes never add experience or qualifications.</p>
      <div id="rbPolishIssues" class="polish-issues"></div>
      <div class="polish-actions">
        <button id="rbApplyPolish" class="rosie-ai-btn" type="button">✦ Apply Recommended Formatting Fixes</button>
        <button id="rbPrintResume" class="primary-btn" type="button">Print / Save PDF</button>
      </div>`;
    anchor.insertAdjacentElement('afterend', panel);
    $('rbApplyPolish').addEventListener('click', applyPolishToStoredResume);
    $('rbPrintResume').addEventListener('click', printResume);
  }
  function injectPreviewPrintButton() {
    const preview = document.querySelector('.resume-preview');
    if (!preview || preview.querySelector('.resume-preview-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'resume-preview-tools';
    tools.innerHTML = '<button id="rbPreviewPrint" class="secondary-btn" type="button">Print / Save PDF</button>';
    preview.prepend(tools);
    $('rbPreviewPrint').addEventListener('click', printResume);
  }

  function printResume() {
    renderSkillsPreview();
    document.body.classList.add('print-resume-mode');
    const cleanup = () => document.body.classList.remove('print-resume-mode');
    window.addEventListener('afterprint', cleanup, {once:true});
    setTimeout(() => window.print(), 40);
    setTimeout(cleanup, 4000);
  }

  function showToast(title, text) {
    const old = document.querySelector('.r2w45-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'save-later-toast r2w45-toast';
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 4200);
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }
  function escapeAttr(v) { return escapeHtml(v).replace(/`/g, '&#096;'); }

  function refreshResumeEnhancements() {
    renderSkillsPreview();
    updateSkillsCoach();
    renderPolishReview();
    renderVersionLabels();
  }

  function bindUX() {
    ['rbNext','rbPrev'].forEach(id => $(id)?.addEventListener('click', () => setTimeout(() => {
      refreshResumeEnhancements();
      scrollToActiveStep();
    }, 35)));

    $('rbAddBullet')?.addEventListener('click', () => setTimeout(() => scrollToElement($('rbEvidenceLabel'), $('rbEvidence')), 30));
    $('rbAddExperience')?.addEventListener('click', () => setTimeout(() => scrollToElement(document.querySelector('.experience-basics'), $('rbEmployer')), 40));
    $('rbBuildBullet')?.addEventListener('click', () => setTimeout(() => scrollToElement($('rbBulletCoach')), 120));
    $('rbDraftSummary')?.addEventListener('click', () => setTimeout(() => scrollToElement($('rbSummaryCoach')), 120));
    $('rbAnalyzeJob')?.addEventListener('click', () => {
      const observer = new MutationObserver(() => {
        if (!$('rbAlignmentPanel')?.hidden) {
          observer.disconnect();
          setTimeout(() => scrollToElement($('rbAlignmentPanel')), 80);
        }
      });
      if ($('rbAlignmentPanel')) observer.observe($('rbAlignmentPanel'), {attributes:true, attributeFilter:['hidden']});
    });

    $('rbSkills')?.addEventListener('input', () => setTimeout(refreshResumeEnhancements, 0));
    $('rbSkills')?.addEventListener('blur', () => setTimeout(refreshResumeEnhancements, 0));
    ['rbContactName','rbLocation','rbTarget','rbEmployer','rbRoleTitle','rbEducation','rbSummary'].forEach(id => {
      $(id)?.addEventListener('input', () => setTimeout(() => { renderPolishReview(); renderVersionLabels(); }, 0));
      $(id)?.addEventListener('change', () => setTimeout(() => { renderPolishReview(); renderVersionLabels(); }, 0));
    });

    document.addEventListener('click', e => {
      const exp = e.target.closest('[data-exp-index]');
      if (exp) setTimeout(() => scrollToElement(document.querySelector('.experience-basics'), $('rbEmployer')), 40);
      const version = e.target.closest('#rbVersionSlots [data-version]');
      if (version) setTimeout(() => { renderVersionLabels(); scrollToElement(document.querySelector('.resume-version-card')); }, 50);
      const add = e.target.closest('#rbVersionSlots [data-version-add]');
      if (add) {
        // Base app creates the new version; reopen directly at Studio Setup so the target cannot be missed.
        setTimeout(() => {
          const data = readState();
          const rb = resumeState(data);
          rb.step = 0;
          data.resumeBuilder = rb;
          writeState(normalizeVersionNames(data));
          sessionStorage.setItem('r2w45-new-version', '1');
          location.hash = '#resume-builder';
          location.reload();
        }, 60);
      }
    }, false);

    const bulletChoices = $('rbBulletChoices');
    if (bulletChoices) new MutationObserver(() => {
      if (bulletChoices.children.length) setTimeout(() => scrollToElement(bulletChoices), 60);
    }).observe(bulletChoices, {childList:true});
  }

  function init() {
    normalizeStoredVersionNames();
    injectSkillsCoach();
    injectPolishPanel();
    injectPreviewPrintButton();
    bindUX();
    refreshResumeEnhancements();

    if (sessionStorage.getItem('r2w45-polish-applied')) {
      sessionStorage.removeItem('r2w45-polish-applied');
      setTimeout(() => { showToast('Formatting fixes applied.', 'Review the résumé preview, then print or save it as a PDF when you are ready.'); scrollToElement($('rbPolishPanel')); }, 180);
    }
    if (sessionStorage.getItem('r2w45-new-version')) {
      sessionStorage.removeItem('r2w45-new-version');
      setTimeout(() => { showToast('New targeted résumé started.', 'Set the position first. This version will save under that target by default.'); scrollToElement($('rbTarget'), $('rbTarget')); }, 180);
    }

    window.addEventListener('hashchange', () => {
      if (location.hash === '#resume-builder') setTimeout(refreshResumeEnhancements, 50);
    });
    console.info(`${PATCH_VERSION} resume polish loaded`);
  }

  init();
})();