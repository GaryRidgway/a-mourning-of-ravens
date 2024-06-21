// Functions.
function placeFirstStanza(stanza) {

    anchor = document.createElement("div");
    anchorStyle = anchor.style;
    anchor.setAttribute('id', 'anchor');
    startStanza = placeStanza(stanza);
    startStanza.setAttribute('id', 'anchor-stanza');
    poemContainer.append(anchor);

    addNonRenderedConnector(startStanza, -1);
    addNonRenderedConnector(startStanza, 1);

    return startStanza;
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
                anchor.prepend(clonedStanza);
            }
            else {
                anchor.append(clonedStanza);
            }

            clonedStanza.style.setProperty('--left-offset', parseFloat(options.leftOffset));
            clonedStanza.style.setProperty('--top-offset', parseFloat(options.topOffset));
        }
    }
    else {
        anchor.append(clonedStanza);
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
    let passedOptions = defaultRenderOptions;

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

    nonRenderedConnectors[uid] = {
        stanza: stanza,
        direction, direction,
        visible: connectorVisible
    };
}

function cascadeRender(options) {
    if (typeof anchor !== 'undefined') {
        const ObjConnectorKeys = Object.keys(nonRenderedConnectors);
        if (ObjConnectorKeys.length > 0) {

            let connectorKeys = checkForVisibleConnectors();

            if (connectorKeys.length > 0){
                // While loop ( CAUTION!!: spooky ).

                let iterations = 0;

                while(connectorKeys.length > 0 && cascadeContinueIterating(iterations, options)) {
                    connectorKeys.forEach((connectorKey) => {
                        const connectorStanza = nonRenderedConnectors[connectorKey];
                        const connector = fetchConnector(connectorStanza.stanza, connectorStanza.direction);
                        
                        if(!isInViewport(connector)) {
                            connectorStanza.visible = false;
                            console.log('Set connector "' + connectorKey + '" `visible` to `false`.');
                        }
                        else {
                            const newStanza = render(connectorStanza.stanza, connectorStanza.direction);
                            addNonRenderedConnector(newStanza.stanza, connectorStanza.direction);
                            delete nonRenderedConnectors[connectorKey];
                        }
                    });

                    connectorKeys = checkForVisibleConnectors();
                    iterations++;
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
    poemContainer.append(poemContainerCenter);
}