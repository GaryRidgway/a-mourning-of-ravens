// Functions.
function placeFirstStanza(stanza) {

    mourn.trackers.anchor = document.createElement("div");
    mourn.trackers.anchorStyle = mourn.trackers.anchor.style;
    mourn.trackers.anchor.setAttribute('id', 'anchor');
    mourn.trackers.startStanza = placeStanza(stanza);
    mourn.trackers.startStanza.setAttribute('id', 'anchor-stanza');
    mourn.config.poemContainer.append(mourn.trackers.anchor);

    addNonRenderedConnector(mourn.trackers.startStanza, -1);
    addNonRenderedConnector(mourn.trackers.startStanza, 1);

    return mourn.trackers.startStanza;
}

function placeStanza(stanza, options = null) {
    const clonedStanza = stanza.cloneNode(true);
    clonedStanza.setAttribute('uid', UID());

    if (options !== null) {
        if (
            options.leftOffset && 
            options.topOffset
        ) {

            if (
                options.leftOffset < 0 &&
                options.topOffset < 0
            ) {
                mourn.trackers.anchor.prepend(clonedStanza);
            }
            else {
                mourn.trackers.anchor.append(clonedStanza);
            }

            clonedStanza.style.setProperty('--left-offset', parseFloat(options.leftOffset));
            clonedStanza.style.setProperty('--top-offset', parseFloat(options.topOffset));
        }
    }
    else {
        mourn.trackers.anchor.append(clonedStanza);
    }

    return clonedStanza;
}

function render(prevStanza, direction = 1) {
    // console.log('-------START RENDER-------');

    const prevStanzaIndex = parseInt(prevStanza.dataset.stanzaNumber);
    const stanza = fetchStagedStanza(prevStanzaIndex + direction);

    const refStanza = direction < 0 ? stanza : prevStanza;
    const styleStanza = fetchRenderedStanza(prevStanzaIndex, getUID(prevStanza));
    // console.log(styleStanza);

    ////////
    let passedOptions = {
        leftOffset: 0,
        topOffset: 0,
    };

    passedOptions.leftOffset = direction * parseFloat(refStanza.dataset.leftOffset);
    passedOptions.topOffset = direction * parseFloat(refStanza.dataset.topOffset);

    const prevHasLeftOffset = styleStanza.style.getPropertyValue('--left-offset');
    if (prevHasLeftOffset.length > 0) {
        passedOptions.leftOffset = parseFloat(prevHasLeftOffset) + passedOptions.leftOffset;
    }

    const prevHasTopOffset = styleStanza.style.getPropertyValue('--top-offset');
    if (prevHasTopOffset.length > 0) {
        passedOptions.topOffset = parseFloat(prevHasTopOffset) + passedOptions.topOffset;
    }

    // console.log(passedOptions.leftOffset);
    // console.log(passedOptions.topOffset);

    const newStanza = placeStanza(
        stanza,
        passedOptions
    );

    // console.log('******* stanza *******');
    // console.log(newStanza);

    // console.log('--------END RENDER--------');

    return {
        stanza: newStanza,
        options: passedOptions
    };
}

function addNonRenderedConnector(stanza, direction) {
    const uid = getUID(stanza) + '[' + direction + ']';
    const connectorVisible = isInViewport(fetchConnector(stanza, direction));

    mourn.trackers.nonRenderedConnectors[uid] = {
        stanza: stanza,
        direction, direction,
        visible: connectorVisible
    };
}

function cascadeRender(options) {
    if (typeof mourn.trackers.anchor !== 'undefined') {
        const ObjConnectorKeys = Object.keys(mourn.trackers.nonRenderedConnectors);
        if (ObjConnectorKeys.length > 0) {

            let connectorKeys = checkForVisibleConnectors();

            if (connectorKeys.length > 0){
                // While loop ( CAUTION!!: spooky ).

                let iterations = 0;

                while(connectorKeys.length > 0 && cascadeContinueIterating(iterations, options)) {
                    connectorKeys.forEach((connectorKey) => {
                        const connectorStanza = mourn.trackers.nonRenderedConnectors[connectorKey];
                        const connector = fetchConnector(connectorStanza.stanza, connectorStanza.direction);
                        
                        if(!isInViewport(connector)) {
                            connectorStanza.visible = false;
                            console.log('Set connector "' + connectorKey + '" `visible` to `false`.');
                        }
                        else {
                            const newStanza = render(connectorStanza.stanza, connectorStanza.direction);
                            addNonRenderedConnector(newStanza.stanza, connectorStanza.direction);
                            delete mourn.trackers.nonRenderedConnectors[connectorKey];
                        }
                    });

                    connectorKeys = checkForVisibleConnectors();
                    iterations++;

                    // Failcase
                    if (iterations >= 200) {
                        break;
                    }
                }
            }
        }
        else {
            console.error('There are no non-rendered elements.');
        }
    }
    else {
        console.error('There is no anchor stanza to cascade from.');
    }
}

function cascadeContinueIterating(iterations, options = null) {
    if(options !== null) {
        if(Object.hasOwn(options, 'iterationMax')) {
            const iterationMax = options.iterationMax;
            if (iterations < iterationMax) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return true;
        }
    }
    else {
        return true
    }
}

function placePoemCenter() {
    const poemContainerCenter = document.createElement("div");
    poemContainerCenter.classList.add('center-dot');
    mourn.config.poemContainer.append(poemContainerCenter);
}