
---

Now the JavaScript:

**script.js**

```javascript
/* ============================================================
   SIMPLY BREATHE — script.js
   Clean, modular, no framework dependencies
   GSAP for animation
   ============================================================ */

'use strict';

/* ── Constants ──────────────────────────────────────────────── */
const INHALE_DURATION  = 4;    // seconds
const EXHALE_DURATION  = 7;    // seconds
const TOTAL_CYCLES     = 11;
const COMPLETION_PAUSE = 4000; // ms before feedback appears
const GROUNDING_INTERVAL = 1800; // ms between grounding lines

/* ── State ──────────────────────────────────────────────────── */
const state = {
  lang:         'de',
  mode:         'auto',   // 'auto' | 'hold'
  sound:        false,
  phase:        'intro',  // 'intro'|'contact'|'breathing'|'completion'|'feedback'
  cycle:        0,
  isBreathing:  false,
  holdActive:   false,
  breathTween:  null,
  labelTween:   null,
  groundingIdx: 0,
  groundingTimer: null,
};

/* ── Element References ─────────────────────────────────────── */
const el = {
  html:               document.documentElement,
  body:               document.body,
  appShell:           document.getElementById('app'),

  // Header
  langBtns:           document.querySelectorAll('.lang-btn'),
  burgerBtn:          document.getElementById('burger-btn'),

  // Phases
  phaseIntro:         document.getElementById('phase-intro'),
  phaseContact:       document.getElementById('phase-contact'),
  phaseBreathing:     document.getElementById('phase-breathing'),
  phaseCompletion:    document.getElementById('phase-completion'),
  phaseFeedback:      document.getElementById('phase-feedback'),

  // Hero
  heroCopy:           document.getElementById('hero-copy'),

  // Grounding
  groundingLines:     document.querySelectorAll('.grounding-line'),
  skipIntroBtn:       document.getElementById('skip-intro-btn'),

  // Contact
  skipContactBtn:     document.getElementById('skip-contact-btn'),

  // Breath circle
  breathCircle:       document.getElementById('breath-circle'),

  // Breathing phase
  breathingStageMain: document.getElementById('breathing-stage-main'),
  breathLabelInhale:  document.querySelector('.breath-label-inhale'),
  breathLabelExhale:  document.querySelector('.breath-label-exhale'),
  progressDots:       document.querySelectorAll('.progress-dot'),
  breathProgress:     document.getElementById('breath-progress'),

  // Completion
  completionLines:    document.querySelectorAll('.completion-line'),

  // Feedback
  feedbackYes:        document.getElementById('feedback-yes'),
  feedbackNo:         document.getElementById('feedback-no'),

  // Menu
  menuDrawer:         document.getElementById('menu-drawer'),
  menuOverlay:        document.getElementById('menu-overlay'),
  menuCloseBtn:       document.getElementById('menu-close-btn'),

  // Mode
  modeAutoBtns:       document.getElementById('mode-auto-btn'),
  modeHoldBtns:       document.getElementById('mode-hold-btn'),

  // Sound
  soundOffBtn:        document.getElementById('sound-off-btn'),
  soundOnBtn:         document.getElementById('sound-on-btn'),

  // About / Disclaimer
  aboutOpenBtn:       document.getElementById('about-open-btn'),
  aboutCloseBtn:      document.getElementById('about-close-btn'),
  aboutPanel:         document.getElementById('about-panel'),
  disclaimerOpenBtn:  document.getElementById('disclaimer-open-btn'),
  disclaimerCloseBtn: document.getElementById('disclaimer-close-btn'),
  disclaimerPanel:    document.getElementById('disclaimer-panel'),

  // Audio
  audioInhale:        { de: null, en: null },
  audioExhale:        { de: null, en: null },

  // SR
  srAnnouncer:        document.getElementById('sr-announcer'),
};

/* ── Audio Setup ─────────────────────────────────────────────
   Fail-safe: never assume audio files exist.
   Only wire up if element exists and has a valid non-empty src.
   ──────────────────────────────────────────────────────────── */
function initAudio() {
  const map = [
    { id: 'audio-inhale-de', key: 'inhale', lang: 'de' },
    { id: 'audio-exhale-de', key: 'exhale', lang: 'de' },
    { id: 'audio-inhale-en', key: 'inhale', lang: 'en' },
    { id: 'audio-exhale-en', key: 'exhale', lang: 'en' },
  ];

  map.forEach(({ id, key, lang }) => {
    const node = document.getElementById(id);
    // Only store reference if element exists — do not set src
    if (node) {
      if (key === 'inhale') el.audioInhale[lang] = node;
      else                  el.audioExhale[lang] = node;
    }
  });
}

function hasValidSrc(audioNode) {
  return (
    audioNode instanceof HTMLAudioElement &&
    typeof audioNode.src === 'string' &&
    audioNode.src.trim() !== '' &&
    !audioNode.src.endsWith('/')  // avoid bare origin URLs
  );
}

function playAudio(audioNode) {
  if (!state.sound)            return;
  if (!hasValidSrc(audioNode)) return;
  try {
    const promise = audioNode.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => { /* silent fail */ });
    }
  } catch (_) {
    // silent fail
  }
}

function stopAudio(audioNode) {
  if (!audioNode || !hasValidSrc(audioNode)) return;
  try {
    audioNode.pause();
    audioNode.currentTime = 0;
  } catch (_) { /* silent fail */ }
}

/* ── Language ────────────────────────────────────────────────── */
const i18n = {
  de: {
    'aria-menu-open':    'Menü öffnen',
    'aria-menu-close':   'Menü schließen',
    'aria-circle-idle':  'Atemkreis',
    'aria-circle-auto':  'Atemkreis – läuft automatisch',
    'aria-circle-hold':  'Atemkreis – gedrückt halten zum Einatmen',
    'aria-skip-intro':   'Einführung überspringen',
    'aria-skip-contact': 'Kontaktphase überspringen',
  },
  en: {
    'aria-menu-open':    'Open menu',
    'aria-menu-close':   'Close menu',
    'aria-circle-idle':  'Breathing circle',
    'aria-circle-auto':  'Breathing circle – running automatically',
    'aria-circle-hold':  'Breathing circle – press and hold to inhale',
    'aria-skip-intro':   'Skip introduction',
    'aria-skip-contact': 'Skip contact phase',
  },
};

function setLang(lang) {
  state.lang = lang;
  el.html.setAttribute('lang', lang);
  el.html.setAttribute('data-lang', lang);
  el.body.setAttribute('data-lang', lang);

  // Update data-i18n visibility:
  // Convention: elements with data-i18n ending in "-de" or "-en"
  // are shown/hidden via .is-hidden based on current lang.
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.getAttribute('data-i18n');
    if (key.endsWith('-de')) {
      node.classList.toggle('is-hidden', lang !== 'de');
    } else if (key.endsWith('-en')) {
      node.classList.toggle('is-hidden', lang !== 'en');
    }
  });

  // Update lang button pressed states
  el.langBtns.forEach(btn => {
    const isActive = btn.getAttribute('data-lang-target') === lang;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  // Update burger aria-label
  el.burgerBtn.setAttribute(
    'aria-label',
    el.menuDrawer.getAttribute('aria-hidden') === 'false'
      ? i18n[lang]['aria-menu-close']
      : i18n[lang]['aria-menu-open']
  );

  // Update circle aria-label
  updateCircleAria();

  // Announce to screen readers
  announce(lang === 'de' ? 'Sprache: Deutsch' : 'Language: English');
}

function announce(text) {
  if (!el.srAnnouncer) return;
  el.srAnnouncer.textContent = '';
  requestAnimationFrame(() => {
    el.srAnnouncer.textContent = text;
  });
}

function updateCircleAria() {
  const { lang, mode, phase } = state;
  let label = i18n[lang]['aria-circle-idle'];
  if (phase === 'breathing' || phase === 'contact') {
    label = mode === 'hold'
      ? i18n[lang]['aria-circle-hold']
      : i18n[lang]['aria-circle-auto'];
  }
  el.breathCircle.setAttribute('aria-label', label);
}

/* ── Phase Management ────────────────────────────────────────── */
const phaseMap = {
  intro:      el.phaseIntro,
  contact:    el.phaseContact,
  breathing:  el.phaseBreathing,
  completion: el.phaseCompletion,
  feedback:   el.phaseFeedback,
};

function setPhase(phase) {
  const prev = state.phase;
  state.phase = phase;

  el.body.setAttribute('data-phase', phase);
  el.appShell.setAttribute('data-phase', phase);

  // Hide all phases
  Object.entries(phaseMap).forEach(([key, node]) => {
    if (!node) return;
    node.classList.add('is-hidden');
    node.classList.remove('is-active');
  });

  // Show target phase
  const target = phaseMap[phase];
  if (target) {
    target.classList.remove('is-hidden');
    target.classList.add('is-active');
  }

  // Hero copy: visible only before breathing starts
  if (el.heroCopy) {
    const showHero = (phase === 'intro');
    el.heroCopy.setAttribute('aria-hidden', String(!showHero));
    if (showHero) {
      gsap.to(el.heroCopy, { opacity: 1, duration: 1, ease: 'power2.out' });
    } else {
      gsap.to(el.heroCopy, { opacity: 0, duration: 0.6, ease: 'power2.in' });
    }
  }

  // Phase-specific entry logic
  if (phase === 'intro')      enterIntro();
  if (phase === 'contact')    enterContact();
  if (phase === 'breathing')  enterBreathing();
  if (phase === 'completion') enterCompletion();
  if (phase === 'feedback')   enterFeedback();

  updateCircleAria();
}

/* ── Phase 1: Intro / Grounding ─────────────────────────────── */
function enterIntro() {
  state.groundingIdx = 0;
  clearGrounding();
  runGrounding();
}

function clearGrounding() {
  if (state.groundingTimer) {
    clearTimeout(state.groundingTimer);
    state.groundingTimer = null;
  }
  el.groundingLines.forEach(line => {
    gsap.set(line, { opacity: 0, y: 8 });
  });
}

function runGrounding() {
  const lines = Array.from(el.groundingLines);

  function showNext() {
    if (state.phase !== 'intro') return;
    if (state.groundingIdx >= lines.length) return;

    const line = lines[state.groundingIdx];
    gsap.to(line, {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'power2.out',
    });

    state.groundingIdx++;

    if (state.groundingIdx < lines.length) {
      state.groundingTimer = setTimeout(showNext, GROUNDING_INTERVAL);
    } else {
      // All lines shown — wait, then auto-advance to contact
      state.groundingTimer = setTimeout(() => {
        if (state.phase === 'intro') setPhase('contact');
      }, GROUNDING_INTERVAL * 2);
    }
  }

  state.groundingTimer = setTimeout(showNext, 600);
}

/* ── Phase 2: Contact ────────────────────────────────────────── */
function enterContact() {
  clearGrounding();

  // Move circle into contact phase DOM if not already there
  ensureCircleInStage(el.phaseContact.querySelector('.breathing-stage'));

  gsap.fromTo(
    el.phaseContact.querySelector('.contact-prompt'),
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out', delay: 0.2 }
  );

  // In auto mode, touching/clicking circle starts breathing
  // In hold mode, same
  el.breathCircle.setAttribute('data-state', 'idle');
}

/* ── Phase 3: Breathing ──────────────────────────────────────── */
function enterBreathing() {
  state.cycle   = 0;
  state.isBreathing = true;

  ensureCircleInStage(el.breathingStageMain);
  resetProgress();

  el.breathCircle.setAttribute('data-state', 'idle');

  // Brief settle before first breath
  gsap.delayedCall(0.5, () => {
    if (state.isBreathing) startCycle();
  });
}

function startCycle() {
  if (!state.isBreathing) return;
  if (state.cycle >= TOTAL_CYCLES) {
    finishBreathing();
    return;
  }

  state.cycle++;
  markProgress(state.cycle);

  if (state.mode === 'auto') {
    runAutoInhale();
  } else {
    runHoldWait();
  }
}

/* AUTO MODE ─────────────────────────────────────────────────── */
function runAutoInhale() {
  showLabel('inhale');
  playAudio(el.audioInhale[state.lang]);

  el.breathCircle.setAttribute('data-state', 'inhale');

  state.breathTween = gsap.to(el.breathCircle, {
    scale: 1.22,
    duration: INHALE_DURATION,
    ease: 'sine.inOut',
    onComplete: runAutoExhale,
  });
}

function runAutoExhale() {
  showLabel('exhale');
  stopAudio(el.audioInhale[state.lang]);
  playAudio(el.audioExhale[state.lang]);

  el.breathCircle.setAttribute('data-state', 'exhale');

  state.breathTween = gsap.to(el.breathCircle, {
    scale: 1,
    duration: EXHALE_DURATION,
    ease: 'sine.inOut',
    onComplete: () => {
      stopAudio(el.audioExhale[state.lang]);
      hideLabels();
      gsap.delayedCall(0.3, startCycle);
    },
  });
}

/* HOLD MODE ─────────────────────────────────────────────────── */
function runHoldWait() {
  // In hold mode we wait for user press
  el.breathCircle.setAttribute('data-state', 'idle');
  showLabel('inhale');
}

function holdStart() {
  if (state.mode !== 'hold')     return;
  if (state.phase !== 'breathing') return;
  if (state.holdActive)           return;

  state.holdActive = true;
  playAudio(el.audioInhale[state.lang]);

  el.breathCircle.setAttribute('data-state', 'held');

  state.breathTween = gsap.to(el.breathCircle, {
    scale: 1.22,
    duration: INHALE_DURATION,
    ease: 'sine.inOut',
  });
}

function holdEnd() {
  if (state.mode !== 'hold')      return;
  if (state.phase !== 'breathing') return;
  if (!state.holdActive)           return;

  state.holdActive = false;

  if (state.breathTween) state.breathTween.kill();

  stopAudio(el.audioInhale[state.lang]);
  showLabel('exhale');
  playAudio(el.audioExhale[state.lang]);

  el.breathCircle.setAttribute('data-state', 'exhale');

  state.breathTween = gsap.to(el.breathCircle, {
    scale: 1,
    duration: EXHALE_DURATION,
    ease: 'sine.inOut',
    onComplete: () => {
      stopAudio(el.audioExhale[state.lang]);
      hideLabels();
      gsap.delayedCall(0.3, startCycle);
    },
  });
}

/* ── Labels ──────────────────────────────────────────────────── */
function showLabel(type) {
  const show = type === 'inhale' ? el.breathLabelInhale : el.breathLabelExhale;
  const hide = type === 'inhale' ? el.breathLabelExhale : el.breathLabelInhale;

  if (!show || !hide) return;

  gsap.to(hide, { opacity: 0, duration: 0.4, ease: 'power1.out' });
  hide.classList.add('is-hidden');

  show.classList.remove('is-hidden');
  gsap.fromTo(show, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
}

function hideLabels() {
  [el.breathLabelInhale, el.breathLabelExhale].forEach(lbl => {
    if (!lbl) return;
    gsap.to(lbl, {
      opacity: 0,
      duration: 0.4,
      ease: 'power1.out',
      onComplete: () => lbl.classList.add('is-hidden'),
    });
  });
}

/* ── Progress ────────────────────────────────────────────────── */
function resetProgress() {
  el.progressDots.forEach(dot => {
    dot.classList.remove('is-current', 'is-complete');
  });
  if (el.breathProgress) {
    el.breathProgress.setAttribute('aria-valuenow', '0');
  }
}

function markProgress(cycle) {
  el.progressDots.forEach((dot, i) => {
    const dotCycle = i + 1;
    if (dotCycle < cycle) {
      dot.classList.remove('is-current');
      dot.classList.add('is-complete');
    } else if (dotCycle === cycle) {
      dot.classList.remove('is-complete');
      dot.classList.add('is-current');
    } else {
      dot.classList.remove('is-current', 'is-complete');
    }
  });

  if (el.breathProgress) {
    el.breathProgress.setAttribute('aria-valuenow', String(cycle));
  }
}

/* ── Finish Breathing ────────────────────────────────────────── */
function finishBreathing() {
  state.isBreathing = false;

  // Mark all complete
  el.progressDots.forEach(dot => {
    dot.classList.remove('is-current');
    dot.classList.add('is-complete');
  });

  hideLabels();

  gsap.to(el.breathCircle, {
    scale: 1,
    duration: 1.5,
    ease: 'power2.out',
    onComplete: () => {
      gsap.delayedCall(0.8, () => setPhase('completion'));
    },
  });
}

/* ── Phase 4: Completion ─────────────────────────────────────── */
function enterCompletion() {
  const lines = Array.from(el.completionLines);

  lines.forEach((line, i) => {
    gsap.fromTo(
      line,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 1.4,
        ease: 'power2.out',
        delay: 0.6 + i * 1.2,
      }
    );
  });

  // Auto-advance to feedback after pause
  gsap.delayedCall(
    (COMPLETION_PAUSE / 1000) + lines.length * 1.2,
    () => { if (state.phase === 'completion') setPhase('feedback'); }
  );
}

/* ── Phase 5: Feedback ───────────────────────────────────────── */
function enterFeedback() {
  const section = el.phaseFeedback;
  if (!section) return;

  gsap.fromTo(
    section.querySelector('.feedback-question'),
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out', delay: 0.3 }
  );

  gsap.fromTo(
    section.querySelector('.feedback-actions'),
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 1, ease: 'power2.out', delay: 0.9 }
  );
}

function submitFeedback(value) {
  // Mark button selected
  [el.feedbackYes, el.feedbackNo].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('is-selected', btn.getAttribute('data-feedback') === value);
  });

  // Hook for future Supabase integration
  // supabase.from('feedback').insert({ response: value, lang: state.lang, ts: Date.now() })
  console.log('[SimplyBreathe] Feedback:', value, '| lang:', state.lang);

  // Soft close
  gsap.delayedCall(1.2, () => {
    gsap.to(el.phaseFeedback, {




opacity: 0,
      duration: 1,
      ease: 'power2.in',
      delay: 2.5,
    });
  });
}

/* ── Circle DOM Management ───────────────────────────────────── */
// The breath circle is a single shared DOM node moved between phases
function ensureCircleInStage(stageEl) {
  if (!stageEl || !el.breathCircle) return;
  if (!stageEl.contains(el.breathCircle)) {
    stageEl.appendChild(el.breathCircle);
  }
}

/* ── Mode ────────────────────────────────────────────────────── */
function setMode(mode) {
  state.mode = mode;
  el.body.setAttribute('data-mode', mode);
  el.appShell.setAttribute('data-mode', mode);

  if (el.breathCircle) {
    el.breathCircle.setAttribute('data-mode', mode);
  }

  const isAuto = mode === 'auto';

  if (el.modeAutoBtns) {
    el.modeAutoBtns.classList.toggle('is-active', isAuto);
    el.modeAutoBtns.setAttribute('aria-pressed', String(isAuto));
  }
  if (el.modeHoldBtns) {
    el.modeHoldBtns.classList.toggle('is-active', !isAuto);
    el.modeHoldBtns.setAttribute('aria-pressed', String(!isAuto));
  }

  updateCircleAria();
}

/* ── Sound ───────────────────────────────────────────────────── */
function setSound(enabled) {
  state.sound = enabled;

  if (el.soundOffBtn) {
    el.soundOffBtn.classList.toggle('is-active', !enabled);
    el.soundOffBtn.setAttribute('aria-pressed', String(!enabled));
  }
  if (el.soundOnBtn) {
    el.soundOnBtn.classList.toggle('is-active', enabled);
    el.soundOnBtn.setAttribute('aria-pressed', String(enabled));
  }
}

/* ── Menu Drawer ─────────────────────────────────────────────── */
function openMenu() {
  el.menuDrawer.classList.remove('is-hidden');
  el.menuDrawer.classList.add('is-open');
  el.menuDrawer.setAttribute('aria-hidden', 'false');

  el.menuOverlay.classList.remove('is-hidden');
  // Small rAF delay so CSS transition fires after display change
  requestAnimationFrame(() => {
    el.menuOverlay.classList.add('is-visible');
  });

  el.burgerBtn.setAttribute('aria-expanded', 'true');
  el.burgerBtn.setAttribute('aria-label', i18n[state.lang]['aria-menu-close']);
  el.body.classList.add('menu-is-open');

  // Focus first focusable element in drawer
  const firstFocusable = el.menuDrawer.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (firstFocusable) firstFocusable.focus();
}

function closeMenu() {
  el.menuDrawer.classList.remove('is-open');
  el.menuDrawer.setAttribute('aria-hidden', 'true');

  el.menuOverlay.classList.remove('is-visible');

  el.burgerBtn.setAttribute('aria-expanded', 'false');
  el.burgerBtn.setAttribute('aria-label', i18n[state.lang]['aria-menu-open']);
  el.body.classList.remove('menu-is-open');

  // Close any open subpanels
  closeSubpanel(el.aboutPanel);
  closeSubpanel(el.disclaimerPanel);

  // After transition ends, re-hide drawer
  const onTransitionEnd = () => {
    if (!el.menuDrawer.classList.contains('is-open')) {
      el.menuDrawer.classList.add('is-hidden');
      el.menuOverlay.classList.add('is-hidden');
    }
    el.menuDrawer.removeEventListener('transitionend', onTransitionEnd);
  };
  el.menuDrawer.addEventListener('transitionend', onTransitionEnd);

  el.burgerBtn.focus();
}

/* ── Subpanels ───────────────────────────────────────────────── */
function openSubpanel(panelEl, triggerBtn) {
  if (!panelEl) return;
  panelEl.classList.remove('is-hidden');
  requestAnimationFrame(() => {
    panelEl.classList.add('is-open');
  });
  panelEl.setAttribute('aria-hidden', 'false');
  if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');

  const firstFocusable = panelEl.querySelector(
    'button, [href], input, [tabindex]:not([tabindex="-1"])'
  );
  if (firstFocusable) firstFocusable.focus();
}

function closeSubpanel(panelEl, triggerBtn) {
  if (!panelEl) return;
  panelEl.classList.remove('is-open');
  panelEl.setAttribute('aria-hidden', 'true');
  if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');

  const onTransitionEnd = () => {
    if (!panelEl.classList.contains('is-open')) {
      panelEl.classList.add('is-hidden');
    }
    panelEl.removeEventListener('transitionend', onTransitionEnd);
  };
  panelEl.addEventListener('transitionend', onTransitionEnd);
}

/* ── Contact Phase: circle tap to begin ─────────────────────── */
function handleCircleContactTap() {
  if (state.phase === 'contact') {
    gsap.to(el.phaseContact, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => setPhase('breathing'),
    });
  }
}

/* ── Hold Mode: press / release handlers ─────────────────────── */
function onCirclePointerDown(e) {
  e.preventDefault();
  if (state.phase === 'contact') {
    handleCircleContactTap();
    return;
  }
  if (state.phase === 'breathing' && state.mode === 'hold') {
    holdStart();
  }
}

function onCirclePointerUp(e) {
  e.preventDefault();
  if (state.phase === 'breathing' && state.mode === 'hold') {
    holdEnd();
  }
}

function onCirclePointerLeave() {
  if (state.phase === 'breathing' && state.mode === 'hold' && state.holdActive) {
    holdEnd();
  }
}

/* ── Keyboard trap for menu ──────────────────────────────────── */
function trapFocus(e) {
  if (!el.menuDrawer.classList.contains('is-open')) return;
  if (e.key !== 'Tab') return;

  const focusable = Array.from(
    el.menuDrawer.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.closest('.is-hidden'));

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

/* ── Event Listeners ─────────────────────────────────────────── */
function bindEvents() {

  // Language
  el.langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang-target');
      if (lang && lang !== state.lang) setLang(lang);
    });
  });

  // Burger
  if (el.burgerBtn) {
    el.burgerBtn.addEventListener('click', () => {
      const isOpen = el.menuDrawer.classList.contains('is-open');
      isOpen ? closeMenu() : openMenu();
    });
  }

  // Menu close button
  if (el.menuCloseBtn) {
    el.menuCloseBtn.addEventListener('click', closeMenu);
  }

  // Overlay click to close
  if (el.menuOverlay) {
    el.menuOverlay.addEventListener('click', closeMenu);
  }

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // Close subpanels first, then drawer
      if (el.aboutPanel && el.aboutPanel.classList.contains('is-open')) {
        closeSubpanel(el.aboutPanel, el.aboutOpenBtn);
        return;
      }
      if (el.disclaimerPanel && el.disclaimerPanel.classList.contains('is-open')) {
        closeSubpanel(el.disclaimerPanel, el.disclaimerOpenBtn);
        return;
      }
      if (el.menuDrawer.classList.contains('is-open')) {
        closeMenu();
      }
    }
    trapFocus(e);
  });

  // Mode toggle
  if (el.modeAutoBtns) {
    el.modeAutoBtns.addEventListener('click', () => setMode('auto'));
  }
  if (el.modeHoldBtns) {
    el.modeHoldBtns.addEventListener('click', () => setMode('hold'));
  }

  // Sound toggle
  if (el.soundOffBtn) {
    el.soundOffBtn.addEventListener('click', () => setSound(false));
  }
  if (el.soundOnBtn) {
    el.soundOnBtn.addEventListener('click', () => setSound(true));
  }

  // About panel
  if (el.aboutOpenBtn) {
    el.aboutOpenBtn.addEventListener('click', () => {
      openSubpanel(el.aboutPanel, el.aboutOpenBtn);
    });
  }
  if (el.aboutCloseBtn) {
    el.aboutCloseBtn.addEventListener('click', () => {
      closeSubpanel(el.aboutPanel, el.aboutOpenBtn);
    });
  }

  // Disclaimer panel
  if (el.disclaimerOpenBtn) {
    el.disclaimerOpenBtn.addEventListener('click', () => {
      openSubpanel(el.disclaimerPanel, el.disclaimerOpenBtn);
    });
  }
  if (el.disclaimerCloseBtn) {
    el.disclaimerCloseBtn.addEventListener('click', () => {
      closeSubpanel(el.disclaimerPanel, el.disclaimerOpenBtn);
    });
  }

  // Skip buttons
  if (el.skipIntroBtn) {
    el.skipIntroBtn.addEventListener('click', () => {
      clearGrounding();
      gsap.to(el.phaseIntro, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => setPhase('contact'),
      });
    });
  }

  if (el.skipContactBtn) {
    el.skipContactBtn.addEventListener('click', () => {
      gsap.to(el.phaseContact, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => setPhase('breathing'),
      });
    });
  }

  // Breath circle — pointer events (mouse + touch unified)
  if (el.breathCircle) {
    el.breathCircle.addEventListener('pointerdown', onCirclePointerDown);
    el.breathCircle.addEventListener('pointerup',   onCirclePointerUp);
    el.breathCircle.addEventListener('pointerleave', onCirclePointerLeave);
    el.breathCircle.addEventListener('pointercancel', onCirclePointerLeave);

    // Prevent context menu on long press (mobile)
    el.breathCircle.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Feedback buttons
  if (el.feedbackYes) {
    el.feedbackYes.addEventListener('click', () => submitFeedback('yes'));
  }
  if (el.feedbackNo) {
    el.feedbackNo.addEventListener('click', () => submitFeedback('no'));
  }
}

/* ── Initial GSAP setup ──────────────────────────────────────── */
function initGSAP() {
  // Ensure GSAP is available
  if (typeof gsap === 'undefined') {
    console.warn('[SimplyBreathe] GSAP not loaded.');
    return;
  }
  gsap.defaults({ ease: 'power2.out' });
}

/* ── Initial render ──────────────────────────────────────────── */
function initRender() {
  // Apply default language
  setLang('de');

  // Apply default mode
  setMode('auto');

  // Apply default sound (off)
  setSound(false);

  // Ensure menu drawer starts hidden
  el.menuDrawer.classList.add('is-hidden');
  el.menuDrawer.setAttribute('aria-hidden', 'true');
  el.menuOverlay.classList.add('is-hidden');

  // Ensure subpanels start hidden
  if (el.aboutPanel) {
    el.aboutPanel.classList.add('is-hidden');
    el.aboutPanel.setAttribute('aria-hidden', 'true');
  }
  if (el.disclaimerPanel) {
    el.disclaimerPanel.classList.add('is-hidden');
    el.disclaimerPanel.setAttribute('aria-hidden', 'true');
  }

  // Hide all phases except intro
  Object.entries(phaseMap).forEach(([key, node]) => {
    if (!node) return;
    if (key === 'intro') {
      node.classList.remove('is-hidden');
      node.classList.add('is-active');
    } else {
      node.classList.add('is-hidden');
      node.classList.remove('is-active');
    }
  });

  // Hide breath labels initially
  if (el.breathLabelInhale) el.breathLabelInhale.classList.add('is-hidden');
  if (el.breathLabelExhale) el.breathLabelExhale.classList.add('is-hidden');

  // Place circle in contact stage initially
  const contactStage = el.phaseContact
    ? el.phaseContact.querySelector('.breathing-stage')
    : null;
  if (contactStage) ensureCircleInStage(contactStage);

  // Fade in hero copy
  if (el.heroCopy) {
    gsap.fromTo(
      el.heroCopy,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 1.6, ease: 'power2.out', delay: 0.3 }
    );
  }
}

/* ── Boot ────────────────────────────────────────────────────── */
function init() {
  initGSAP();
  initAudio();
  initRender();
  bindEvents();

  // Kick off grounding phase
  setPhase('intro');
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
