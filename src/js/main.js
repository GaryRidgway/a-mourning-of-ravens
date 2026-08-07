


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

// Ready code.
window.addEventListener("load", function () {
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
