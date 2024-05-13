// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  addStanzasToStaging(poem_json);

  pairSpaceAndScale();

  docStyle.setProperty('--stanza-width', (widestStanza * mainScaling) + 'px');

  setStanzaOffsetTuples();

  const startStanzaIndex = randomStanzaIndex();
  const startStanza = fetchStanza(startStanzaIndex);
  const anchorStanza = placeFirstStanza(startStanza);

  cascadeRender(
    anchorStanza.querySelector('.stanza'),
    startStanzaIndex,
    {
      flow: 0,
      iterationMax: 
      {
        'iteration': 0,
        'max': 2
      },
      estop: false
    }
  );
});