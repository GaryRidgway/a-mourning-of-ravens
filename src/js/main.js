


// Ready code.
window.addEventListener("load", function () {
  document.fonts.ready.then(()=>{
    document.fonts.load("16px Cinzel").then(()=>{
      window.requestAnimationFrame(()=>{
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
        cascadeRender();
      window.requestAnimationFrame(()=>{
        scrollInit();
      window.requestAnimationFrame(()=>{
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
});