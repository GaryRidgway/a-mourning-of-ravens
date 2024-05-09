// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  addStanzasToStaging(poem_json);

  pairSpaceAndScale();
  setStanzaOffsetTuples();

  docStyle.setProperty('--stanza-width', (widestStanza * mainScaling) + 'px');

  const startStanzaIndex = randomStanzaIndex();
  const startStanza = fetchStanza(startStanzaIndex);
  const anchorStanza = placeFirstStanza(startStanza);
  cascadeRender(anchorStanza.querySelector('.stanza'), startStanzaIndex);
});