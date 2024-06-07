function calcStartScrollPos() {
    if(debugV) {
        dbp('calcStartScrollPos()') 
    }

    const startData = startStanza.dataset;
    const startTerminatorWidth = parseFloat(startData.terminatorWidth);
    const startFullWidth = startTerminatorWidth + parseFloat(startData.scrollWidth);
    startScrollPos = startFullWidth/2;
    
    // calcAnchorOffset();
}

function calcAnchorOffset() {
    if(debugV) {
        dbp('calcAnchorOffset()') 
    }

    const currentStanza = currentScrollStanzaData.target;
    const startStanzaLastLineChildNodes = currentStanza.childNodes[currentStanza.childNodes.length-1].childNodes;
    const startStanzaTerminator = startStanzaLastLineChildNodes[startStanzaLastLineChildNodes.length-1];
    const startStanzaTerminatorHeight = startStanzaTerminator.getBoundingClientRect().height;
    const startStanzaMid = currentStanza.getBoundingClientRect().height/2;

    // y = mx+b;
    const y = parseFloat(currentStanza.dataset.slope)*startScrollPos + startStanzaTerminatorHeight;
    // anchorStyle.setProperty('--static-offset', 'calc(' + (startStanzaMid + startStanzaTerminatorHeight - y) + ')');
    // anchorStyle.setProperty('--static-offset', 0);
}