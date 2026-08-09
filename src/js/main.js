


// Android Chrome will grant fullscreen from a user gesture, which is the only
// way to lose the URL bar there short of installing the page. iOS has no
// Fullscreen API outside video, so the promise rejects and we let it — there is
// nothing to fall back to, and an iPhone reader who wants the bar gone has to
// Add to Home Screen.
//
// Touch-primary only. A gallery projector or a desktop throwing itself
// fullscreen on the first click would be a surprise, and once is enough either
// way: { once: true } means a reader who leaves fullscreen is not dragged back.
function armFullscreenOnFirstTap() {
  if (!CONFIG.fullscreenOnFirstTap) return;
  if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;

  document.addEventListener('pointerdown', () => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return;
    try {
      const result = request.call(el, { navigationUI: 'hide' });
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {}
  }, { once: true, passive: true });
}

// Fire the visitor-count beacon. See CONFIG.enableVisitorCount for why the
// counting has to happen from the page at all.
//
// Called from the load handler rather than at script-eval, so a reader who
// backs out before the piece has drawn anything is not counted as having seen
// it. That also puts it after applyConfigFromUrlParams(), which runs when
// flowField.js evaluates, so CONFIG is settled by the time this reads it.
function sendVisitorCount() {
  // A projector is not a visitor, and the show build's watchdog can reload the
  // page by itself — counting there would pad the number with visits nobody
  // made. SHOW_CONFIG exists only on that page.
  if (typeof SHOW_CONFIG === 'object' && SHOW_CONFIG && !SHOW_CONFIG.countVisits) return;
  if (!CONFIG.enableVisitorCount) return;

  // Composed here, never taken whole, and confined to a goatcounter.com
  // subdomain: this value can come from the query string, and an endpoint
  // copied verbatim out of a URL would let a crafted link point the beacon at
  // anywhere at all. Anything that is not a plausible site code is treated as
  // "not configured" and silently does nothing, which is also the state the
  // repo ships in.
  const code = String(CONFIG.visitorCountSiteCode || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(code)) return;

  // Report a deliberate path rather than whatever happens to be in the address
  // bar. syncUrlParamsFromConfig() writes every config value into the query
  // string, so a tuning session would otherwise arrive as a few hundred
  // distinct thousand-character "pages" and split the count across all of them.
  //
  // One parameter survives, and only in the shape it is expected in: ?src=,
  // which is what lets a QR code on a wall be told apart from a link sent to
  // someone directly. That distinction is the difference between "83 people
  // opened this" and "83 people opened this, 61 of them standing in the shop".
  //
  // The show build has no query string left to read by the time this runs — its
  // hardening discards the whole thing before any deferred script executes — so
  // it hands the label over in a global instead, already validated. Falling
  // back to it rather than preferring it keeps this page the normal case.
  const src = new URLSearchParams(window.location.search).get('src')
    || window.__mournVisitSrc || '';
  const label = /^[A-Za-z0-9_-]{1,32}$/.test(src) ? '?src=' + src : '';
  window.goatcounter = { path: window.location.pathname + label };

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://gc.zgo.at/count.js';
  tag.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
  document.head.appendChild(tag);
}

// Ready code.
window.addEventListener("load", function () {
  sendVisitorCount();
  document.fonts.ready.then(()=>{
    document.fonts.load("16px Cinzel").then(()=>{
      window.requestAnimationFrame(()=>{
        // Before staging, not after: every measurement below reads the type
        // size, so changing it later would leave the ring and the collider
        // boxes describing words that are no longer that size.
        applyPoemFontScale();
        armFullscreenOnFirstTap();
        addStanzasToStaging(poem_json);
      window.requestAnimationFrame(()=>{
        pairSpaceAndScale();
      window.requestAnimationFrame(()=>{
        mourn.config.docStyle.setProperty('--stanza-width', (mourn.staging.widestStanza * mourn.staging.mainScaling) + 'px');
      window.requestAnimationFrame(()=>{
        setStanzaOffsets();
      window.requestAnimationFrame(()=>{
        const startStanzaIndex = randomStanzaIndex();
        mourn.trackers.startStanza = fetchStagedStanza(startStanzaIndex);
      window.requestAnimationFrame(()=>{
        placeFirstStanza(mourn.trackers.startStanza);
      window.requestAnimationFrame(()=>{
        scrollInit();
      window.requestAnimationFrame(()=>{
        const autoScrollSpeed = getAutoScrollSpeedFromURL();
        if (autoScrollSpeed !== null) {
          startAutoScroll(autoScrollSpeed);
        }

        if(mourn.debug.on) {
          placePoemCenter();
        }
      });
      });
      });
      });
      });
      });
      });
      });
    });
  });
});
