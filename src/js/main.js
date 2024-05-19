// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  addStanzasToStaging(poem_json);

  pairSpaceAndScale();

  docStyle.setProperty('--stanza-width', (widestStanza * mainScaling) + 'px');

  setStanzaOffsets();

  const startStanzaIndex = randomStanzaIndex();
  startStanza = fetchStagedStanza(startStanzaIndex);
  placeFirstStanza(startStanza);

  cascadeRender();

  scrollInit();

  if(debug) {
    placePoemCenter();
  }
});