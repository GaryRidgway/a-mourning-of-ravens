// Runtime hardening for the unattended show build. Loaded synchronously at the
// very top of show/index.html, ahead of the inline font-size script and every
// deferred app script, because two of the things it does — discarding the query
// string and neutering localStorage — only work if nothing has read them yet.
//
// This file never changes what the piece looks like. It removes the ways the
// look can be changed out from under it: URL params, stored panel state, stray
// input. The show build and the build you tune against run identical rendering
// code, which is the whole point of hardening rather than stripping.
(function () {
  'use strict';

  const S = typeof SHOW_CONFIG === 'object' && SHOW_CONFIG ? SHOW_CONFIG : {};
  const log = (...a) => console.info('[show]', ...a);
  // `S.x || fallback` would quietly turn a deliberate 0 into the fallback, which
  // is worst exactly where it matters: setting watchdogGraceMs to 0 to make the
  // watchdog eager would instead give it a 30-second head start.
  const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

  // --------------------------------------------------------------- the URL
  // applyConfigFromUrlParams() runs at flowField.js load time and scroll.js
  // reads its own params at module scope, so the query string has to be gone
  // before any deferred script executes. replaceState does that without a
  // navigation. Also drops '?debug', which is what keeps setupDuneControls from
  // running at all — the panel markup is absent from this page, but the guard
  // is worth having twice.
  //
  // One value is rescued before the wipe rather than after it: ?src=, the label
  // that says where a reader came from. This file is the only code that runs
  // early enough to see it, and a beacon that cannot tell a QR code on a wall
  // from a link sent by text is most of the reason for counting at all. Rescued
  // as a value, not as a param — it is copied into a variable and the query
  // string still goes, so nothing downstream can read it as configuration. It
  // is matched against a strict shape here rather than trusted, because it ends
  // up in a path reported to a third party.
  const srcRaw = new URLSearchParams(window.location.search).get('src') || '';
  window.__mournVisitSrc = /^[A-Za-z0-9_-]{1,32}$/.test(srcRaw) ? srcRaw : '';

  if (window.location.search || window.location.hash) {
    try {
      window.history.replaceState({}, '', window.location.pathname);
      log('discarded URL params' + (window.__mournVisitSrc ? ` (kept src=${window.__mournVisitSrc})` : ''));
    } catch (e) {
      log('could not discard URL params', e);
    }
  }

  // ------------------------------------------------------------- storage
  // ~20 read/write sites back the panel's own state — vignette, font size, text
  // texture, panel width, open/closed sections. None of it should survive from
  // whatever tuning session last touched this machine. An in-memory stub is
  // total, and keeps every one of those try/catch blocks on its happy path
  // rather than exercising error handling nobody tests.
  try {
    const mem = new Map();
    const stub = {
      getItem: (k) => (mem.has(String(k)) ? mem.get(String(k)) : null),
      setItem: (k, v) => { mem.set(String(k), String(v)); },
      removeItem: (k) => { mem.delete(String(k)); },
      clear: () => { mem.clear(); },
      key: (i) => Array.from(mem.keys())[i] ?? null,
    };
    Object.defineProperty(stub, 'length', { get: () => mem.size });
    Object.defineProperty(window, 'localStorage', {
      value: stub, configurable: true, writable: false,
    });
    log('localStorage isolated');
  } catch (e) {
    log('could not isolate localStorage', e);
  }

  // -------------------------------------------------------------- cursor
  // Registered before the input swallowers below, and on the same node and
  // phase, because listener order within a phase is registration order. Capture
  // on window is the first thing any event reaches, so the swallower's
  // stopPropagation would otherwise mean the cursor never reappears once input
  // is locked — which is the exact case an operator needs it in.
  const CAPTURE = { capture: true };
  if (S.hideCursorAfterMs > 0) {
    const style = document.createElement('style');
    style.textContent = '.show-cursor-hidden, .show-cursor-hidden * { cursor: none !important; }';
    document.head.appendChild(style);
    let cursorTimer = null;
    const armCursorHide = () => {
      document.documentElement.classList.remove('show-cursor-hidden');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(
        () => document.documentElement.classList.add('show-cursor-hidden'),
        S.hideCursorAfterMs
      );
    };
    window.addEventListener('mousemove', armCursorHide, CAPTURE);
    window.addEventListener('pointermove', armCursorHide, CAPTURE);
    armCursorHide();
  }

  // --------------------------------------------------------------- input
  // Two separate locks, because the two kinds of input carry very different
  // risk. Dragging a collider is permanent until a reload; scrolling is
  // something the piece is built to absorb and recover from on its own. Locking
  // both by default would be protecting the piece from being looked at.
  let dragLocked = S.lockColliderDrag !== false;
  let scrollLocked = S.lockScroll === true;
  const chord = S.unlockChord || { ctrl: true, shift: true, alt: false, code: 'KeyU' };
  const matchesChord = (e) =>
    e.code === chord.code && e.ctrlKey === !!chord.ctrl &&
    e.shiftKey === !!chord.shift && e.altKey === !!chord.alt;

  const kill = (e) => {
    // Capture phase on window runs before the canvas and before p5's own
    // window-level listeners, which were registered later than this one.
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
  };
  const killDrag = (e) => { if (dragLocked) kill(e); };
  const killScroll = (e) => { if (scrollLocked) kill(e); };

  const onKey = (e) => {
    if (matchesChord(e)) {
      dragLocked = !dragLocked;
      scrollLocked = S.lockScroll === true ? !scrollLocked : false;
      document.documentElement.classList.toggle('show-input-locked', dragLocked);
      log(dragLocked ? 'collider drag locked' : 'input UNLOCKED');
      kill(e);
      return;
    }
    // Arrow keys are the poem's own scroll shortcut, so they belong to the
    // scroll lock. Nothing else on the page is bound to a key.
    killScroll(e);
  };

  // wheel and touchmove must be non-passive or preventDefault is ignored and
  // the page scrolls anyway.
  const PASSIVE_FALSE = { capture: true, passive: false };
  for (const type of ['wheel', 'touchstart', 'touchmove', 'touchend', 'gesturestart',
    'gesturechange', 'gestureend']) {
    window.addEventListener(type, killScroll, PASSIVE_FALSE);
  }
  // Only the press, plus the interactions that ride on it. mousedown is what
  // sets draggedBoxIndex; without it mouseDragged returns immediately, so the
  // drag is dead at the source and mousemove can still reach the sketch — which
  // is what keeps the wake swirl following the cursor.
  //
  // Note what is absent: 'scroll'. That is the consequence, fired by the poem's
  // own auto-scroll, and swallowing it would break the piece rather than protect
  // it the day anything starts listening for it.
  for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'auxclick',
    'contextmenu', 'dragstart', 'selectstart']) {
    window.addEventListener(type, killDrag, CAPTURE);
  }
  window.addEventListener('keydown', onKey, CAPTURE);
  window.addEventListener('keyup', killScroll, CAPTURE);
  if (dragLocked) document.documentElement.classList.add('show-input-locked');

  // ---------------------------------------------------------- screen wake
  if (S.keepScreenAwake) {
    let sentinel = null;
    const acquire = () => {
      if (!('wakeLock' in navigator) || document.hidden) return;
      navigator.wakeLock.request('screen')
        .then((lock) => { sentinel = lock; })
        .catch(() => { /* insecure context or denied; screensaver is the operator's job */ });
    };
    // The lock is dropped automatically whenever the page is hidden, so it has
    // to be taken again every time the page comes back.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && (!sentinel || sentinel.released)) acquire();
    });
    acquire();
  }

  // ------------------------------------------------------------- freezing
  // Locked only once the sketch is actually running. Everything that legitimately
  // writes CONFIG does so during setup — the non-debug HUD disable, the refresh
  // rate clamp — and every other writer lives in the control panel, which is not
  // on this page. Frozen afterwards, a stray write is a silent no-op instead of
  // a drift that only shows up an hour into the run.
  const freezeWhenReady = () => {
    if (typeof frameCount !== 'number' || frameCount < 2) return false;
    try {
      if (typeof CONFIG === 'object') Object.freeze(CONFIG);
      if (typeof RENDER_COLORS === 'object') {
        for (const k in RENDER_COLORS) Object.freeze(RENDER_COLORS[k]);
        Object.freeze(RENDER_COLORS);
      }
      log('config frozen');
    } catch (e) {
      log('could not freeze config', e);
    }
    return true;
  };

  // ------------------------------------------------------------- watchdog
  // sessionStorage, not localStorage: the reload counter has to survive a reload
  // but must not survive the tab closing, or yesterday's crashes would count
  // against today's. It is also the one storage the app itself never touches.
  const readAttempts = () => {
    try {
      const raw = JSON.parse(sessionStorage.getItem('show:reloads') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  };
  const recordAttempt = (now) => {
    try {
      const kept = readAttempts()
        .filter((t) => now - t < num(S.watchdogReloadWindowMs, 120000));
      kept.push(now);
      sessionStorage.setItem('show:reloads', JSON.stringify(kept));
      return kept.length;
    } catch (e) { return 1; }
  };

  const startedAt = Date.now();
  let lastFrameCount = -1;
  let lastProgressAt = startedAt;
  let frozen = false;

  const tick = () => {
    const now = Date.now();
    if (!frozen) frozen = freezeWhenReady();

    const fc = typeof frameCount === 'number' ? frameCount : -1;
    if (fc !== lastFrameCount) {
      lastFrameCount = fc;
      lastProgressAt = now;
    }

    if (S.scheduledReloadMinutes > 0 &&
        now - startedAt >= S.scheduledReloadMinutes * 60000) {
      log('scheduled reload');
      window.location.reload();
      return;
    }

    if (!S.watchdog) return;
    // The sketch calls noLoop() when hidden and when paused; neither is a stall.
    if (document.hidden) { lastProgressAt = now; return; }
    if (typeof CONFIG === 'object' && CONFIG && CONFIG.pauseSimulation) {
      lastProgressAt = now; return;
    }
    if (now - startedAt < num(S.watchdogGraceMs, 30000)) return;
    if (now - lastProgressAt < num(S.watchdogStallMs, 15000)) return;

    const attempts = recordAttempt(now);
    if (attempts > num(S.watchdogMaxReloads, 3)) {
      log(`stalled, but ${attempts - 1} reloads already failed — leaving it alone`);
      return;
    }
    log(`stalled ${Math.round((now - lastProgressAt) / 1000)}s at frame ${fc}; reload ${attempts}`);
    window.location.reload();
  };

  setInterval(tick, Math.max(250, num(S.watchdogCheckEveryMs, 5000)));

  // Surfaced for the soak and smoke tests, and for an operator with a console.
  window.__mournShow = {
    config: S,
    isDragLocked: () => dragLocked,
    isScrollLocked: () => scrollLocked,
    setDragLocked: (v) => { dragLocked = !!v; },
    setScrollLocked: (v) => { scrollLocked = !!v; },
    stalledForMs: () => Date.now() - lastProgressAt,
    reloadAttempts: () => readAttempts().length,
    isFrozen: () => frozen,
  };
  log('hardening active');
})();
