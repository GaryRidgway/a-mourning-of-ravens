// Functions.
function pairSpaceAndScale() {
    const allLines = poemStaging.querySelectorAll('.stanza .line');
    const numAllLines = allLines.length;
    allLines.forEach((line, index) => {
        const hasInitiator = line.querySelectorAll('.initiator').length > 0;
        const hasTerminator = line.querySelectorAll('.terminator').length > 0;
        let charCount = parseInt(line.getAttribute('data-char-count'));

        let pairIndex = null;
        if (hasInitiator) {
            pairIndex = (index - 1 + numAllLines) % numAllLines;
        }
        else if (hasTerminator) {
            pairIndex = (index + 1 + numAllLines) % numAllLines;
        }

        if (pairIndex !== null) {
            let pairCharCount = parseInt(allLines[pairIndex].getAttribute('data-char-count'));
            const avgCharCount = (charCount + pairCharCount) / 2;
            charCount = avgCharCount;
        }

        const spacing = invLogScale(scale(
            charCount,
            leastChars,
            mostChars,
            1,
            10
        ));
        line.style.setProperty('--char-spacing', spacing + 'px')


        const scaling = invLogScale(scale(
            charCount,
            leastChars,
            mostChars,
            1,
            10
        ));
        line.style.setProperty('--char-scaling', scaling + 'px')
    });
}

function addStanzasToStaging(jsonData) {
    jsonData.forEach((stanza, index) => {
        const stanzaNode = addStanzaToStaging(index);
        const stanzaWidth = stanzaNode.getBoundingClientRect().width;
        if (stanzaWidth > widestStanza) {
            widestStanza = Math.ceil(stanzaWidth);
        }
        stanzaCountLineChars(stanzaNode);
    });
}

function addStanzaToStaging(stanzaNumber) {
    const stanza = document.createElement("div");
    stanza.classList.add('stanza');
    stanza.setAttribute('data-stanza-number', stanzaNumber);
    const lines = stanzaContents(stanzaNumber);
    lines.forEach((line) => {
        stanza.append(line);
    })
    poemStaging.append(stanza);
    return stanza;
}

function stanzaContents(stanzaNumber) {
    const stanzaData = poem_json[stanzaNumber];
    let lines = [];
    for (let i = 0; i < 4; i++) {
        let line = '';
        if (i === 0) {
            line += '<span class="initiator">' + stanzaData["initiator"] + '</span>';
        }
        line += lineTextFormat(stanzaData[i.toString()]);
        if (i === 3) {
            line += '<span class="terminator">' + stanzaData["terminator"] + '</span>';
        }

        lines.push(lineElement(line));
    }

    return lines;
}

function lineTextFormat(lineText) {
    let formatted = '<span>';
    formatted += lineText.replaceAll(' ', '</span> <span>');
    formatted += '</span>';
    return formatted;
}

function lineElement(innerHTML) {
    const line = document.createElement("div");
    line.classList.add('line');
    line.innerHTML = innerHTML;
    const charCount = line.textContent.length;
    line.setAttribute('data-char-count', charCount);

    return line;
}

function stanzaCountLineChars(stanza) {
    const lines = Array.prototype.slice.call(stanza.children);
    lines.forEach((line) => {
        const chars = line.textContent.length;
        if (chars > mostChars) {
            mostChars = Math.ceil(chars);
            const prevEl = document.getElementById('most-line-characters');
            if (prevEl) {
                prevEl.removeAttribute('id');
            }
            line.setAttribute('id', 'most-line-characters');
        }
        else if (chars < leastChars) {
            leastChars = Math.floor(chars);
            const prevEl = document.getElementById('least-line-characters');
            if (prevEl) {
                prevEl.removeAttribute('id');
            }
            line.setAttribute('id', 'least-line-characters');
        }
    });
}

function scale(number, inMin, inMax, outMin, outMax) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function logScale(x) {
    const logScalar = (maxScaling - minScaling)/Math.log(10);
    return Math.log(x)*logScalar+minScaling
}

function invLogScale(x) {
    const normalVal =  logScale(x);
    return scale(normalVal, minScaling, maxScaling, maxScaling, minScaling);
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function randomStanzaIndex() {
    return getRandomInt(stanzaCount);
}

function fetchStanza(index, selector, uid = null) {
    const realIndex = (index + stanzaCount) % stanzaCount;
    const baseSelector = selector + ' [data-stanza-number="' + realIndex + '"]';
    let uidSelector = '';
    if (uid !== null) {
        uidSelector = '[uid="' + uid + '"]';
    }
    const stanza = document.querySelector(baseSelector + uidSelector);
    return stanza;
}

function fetchStagedStanza(index) {
    return fetchStanza(index, '#poem-staging');
}

function fetchRenderedStanza(index, uid) {
    return fetchStanza(index, '#poem-container', uid);
}

function placeFirstStanza(stanza) {

    anchorStanza = document.createElement("div");
    anchorStanza.setAttribute('id', 'anchor');
    const firstStanza = placeStanza(stanza);
    firstStanza.setAttribute('id', 'anchor-stanza');
    poemContainer.append(anchorStanza);

    // First stanza Unique ID.
    const FSUID = firstStanza.getAttribute('uid');

    addNonRenderedConnector(firstStanza, -1);
    addNonRenderedConnector(firstStanza, 1);

    return firstStanza;
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
                anchorStanza.prepend(clonedStanza);
            }
            else {
                anchorStanza.append(clonedStanza);
            }

            clonedStanza.style.setProperty('--left-offset', parseFloat(options.leftOffset));
            clonedStanza.style.setProperty('--top-offset', parseFloat(options.topOffset));
        }
    }
    else {
        anchorStanza.append(clonedStanza);
    }

    return clonedStanza;
}

// https://gist.github.com/jjmu15/8646226
// Determine if an element is in the visible viewport.
function isInViewport(element) {
    var rect = element.getBoundingClientRect();
    var html = document.documentElement;
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || html.clientHeight) &&
        rect.right <= (window.innerWidth || html.clientWidth)
    );
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

function getUID(stanza) {
    const uid = stanza.getAttribute('uid');
    if (uid !== null) {
        return stanza.getAttribute('uid');
    }
    else {
        console.error('________________________');
        console.log(stanza);
        console.error('Above stanza has no UID.');
    }
}

function cascadeRender(options) {
    if (typeof anchorStanza !== 'undefined') {

        const connectorKeys = Object.keys(nonRenderedConnectors);
        if (connectorKeys.length > 0) {

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

function fetchConnector(stanza, direction) {
    if (direction < 0) {
        return stanza.querySelector('.initiator');
    }
    else if (direction > 0) {
        return stanza.querySelector('.terminator');
    }
    console.error('Improper direction declared.');
}

function checkForVisibleConnectors() {
    const connectorKeys = Object.keys(nonRenderedConnectors);

    if (connectorKeys.length > 0) {
        const connectors = [];
        connectorKeys.forEach((key) => {
            const connector = nonRenderedConnectors[key];
            if ( connector.visible === true ) {
                connectors.push(key);
            }
        });

        return connectors;
    }
    else {
        return [];
    }
}

function UID() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 12).padStart(12, 0);
}

function setStanzaOffsetTuples() {
    poemStaging.childNodes.forEach((stanza, index) => {
        const stanzaBB = stanza.getBoundingClientRect();

        const initiator = stanza.querySelector('.initiator');
        const initiatorBB = initiator.getBoundingClientRect();

        const terminator = stanza.querySelector('.terminator');
        const terminatorBB = terminator.getBoundingClientRect();
    
        const left = terminatorBB.left - initiatorBB.left;
        const top = terminatorBB.top - initiatorBB.top;
        const initiatorTopOffset = stanzaBB.top - initiatorBB.top;

        stanza.setAttribute('data-left-offset', left);
        stanza.setAttribute('data-top-offset', top);
        stanza.setAttribute('data-initiator-top-offset', initiatorTopOffset);
    });
}