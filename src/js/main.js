// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  addStanzasToStaging(poem_json);

  pairSpaceAndScale();

  docStyle.setProperty('--stanza-width', (widestStanza * mainScaling) + 'px');

  setStanzaOffsetTuples();

  const startStanzaIndex = randomStanzaIndex();
  const startStanza = fetchStagedStanza(startStanzaIndex);
  placeFirstStanza(startStanza);

  cascadeRender();

  
});