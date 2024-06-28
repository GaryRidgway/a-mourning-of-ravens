// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  addStanzasToStaging(poem_json);

  pairSpaceAndScale();

  mourn.config.docStyle.setProperty('--stanza-width', (mourn.staging.widestStanza * mourn.staging.mainScaling) + 'px');

  setStanzaOffsets();

  const startStanzaIndex = randomStanzaIndex();
  mourn.trackers.startStanza = fetchStagedStanza(startStanzaIndex);
  placeFirstStanza(mourn.trackers.startStanza);

  cascadeRender();

  scrollInit();

  if(mourn.debug.on) {
    placePoemCenter();
  }
});