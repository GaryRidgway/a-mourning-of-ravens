// Functions.
function pairSpaceAndScale() {
    const allLines = poemStaging.querySelectorAll('.stanza .line');
    const numAllLines = allLines.length;
    allLines.forEach((line, index) => {
        const hasConnector = line.querySelectorAll('.connector').length > 0;
        const hasTerminator = line.querySelectorAll('.terminator').length > 0;
        let charCount = parseInt(line.getAttribute('data-char-count'));

        let pairIndex = null;
        if (hasConnector) {
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
            line += '<span class="connector">' + stanzaData["connector"] + '</span>';
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

function fetchStanza(index) {
    const realIndex = (index + stanzaCount) % stanzaCount;
    const stagedStanza = document.querySelector('#poem-staging [data-stanza-number="' + realIndex + '"');
    return stagedStanza;
}

function placeFirstStanza(stanza) {

    anchorStanza = document.createElement("div");
    anchorStanza.setAttribute('id', 'anchor');
    const firstStanza = placeStanza(stanza);
    firstStanza.setAttribute('id', 'anchor-stanza');
    poemContainer.append(anchorStanza);

    return anchorStanza;
}

function placeStanza(stanza, options = null) {
    const clonedStanza = stanza.cloneNode(true);
    anchorStanza.append(clonedStanza);

    if (options !== null) {
        if (
            options.leftOffset && 
            options.topOffset
        ) {
            clonedStanza.style.setProperty('--left-offset', parseFloat(options.leftOffset));
            clonedStanza.style.setProperty('--top-offset', parseFloat(options.topOffset));
            clonedStanza.style.setProperty('--top-offset-diff', parseFloat(options.topOffsetDiff));
        }
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

function cascadeRender(stanza, index, options = defaultCascadeOptions) {
    let newIterationMax = null;
    if(options.iterationMax !== null) {
        newIterationMax = {
            'iteration': options.iterationMax['iteration']+1,
            'max': options.iterationMax['max']
        }

        if (newIterationMax.iteration >= newIterationMax.max) {
            return;
        }
    }
    const connector = stanza.querySelector('.connector');
    const terminator = stanza.querySelector('.terminator');

    // CONNECTOR.
    if (isInViewport(connector) && options.flow < 1) {
        const conIndex = index - 1;
        const conStanza = fetchStanza(conIndex);
        const rolledLeftOffset = -options.rolloverOffset.left - parseFloat(conStanza.dataset.leftOffset);


        const rolledTopOffset_sansDiff = options.rolloverOffset.top + parseFloat(stanza.dataset.topOffset);
        const rolledTopOffset = -rolledTopOffset_sansDiff;
 
        const newConStanza = placeStanza(
            conStanza,
            {
                leftOffset: rolledLeftOffset,
                topOffset: rolledTopOffset
            }
        );
        if (options.estop) {
            return;
        }

        cascadeRender(
            newConStanza,
            conIndex,
            {
                rolloverOffset: {
                    left: parseFloat(newConStanza.dataset.leftOffset),
                    top: parseFloat(newConStanza.dataset.topOffset)
                },
                flow: -1,
                iterationMax: newIterationMax,
                estop: options.estop
            }
        );
    }

    // TERMINATOR.
    if (isInViewport(terminator) && options.flow > -1) {
        const terIndex = index + 1;
        const terStanza = fetchStanza(terIndex);
        const rolledLeftOffset = options.rolloverOffset.left + parseFloat(stanza.dataset.leftOffset);
        const rolledTopOffset_sansDiff = options.rolloverOffset.top + parseFloat(stanza.dataset.topOffset);
        const rolledTopOffset = rolledTopOffset_sansDiff;

        const newTerStanza = placeStanza(
            terStanza,
            {
                leftOffset: rolledLeftOffset,
                topOffset: rolledTopOffset,
            }
        );
        if (options.estop) {
            return;
        }
        cascadeRender(
            newTerStanza,
            terIndex,
            {
                rolloverOffset: {
                    left: parseFloat(stanza.dataset.leftOffset),
                    top: parseFloat(stanza.dataset.topOffset),
                },
                flow: 1,
                iterationMax: newIterationMax,
                estop: options.estop
            }
        );
    }
}

function setStanzaOffsetTuples() {
    poemStaging.childNodes.forEach((stanza, index) => {
        const stanzaBB = stanza.getBoundingClientRect();

        const connector = stanza.querySelector('.connector');
        const connectorBB = connector.getBoundingClientRect();

        const terminator = stanza.querySelector('.terminator');
        const terminatorBB = terminator.getBoundingClientRect();
    
        const left = terminatorBB.left - connectorBB.left;
        const top = terminatorBB.top - connectorBB.top;
        const connectorTopOffset = stanzaBB.top - connectorBB.top;

        stanza.setAttribute('data-left-offset', left);
        stanza.setAttribute('data-top-offset', top);
        stanza.setAttribute('data-connector-top-offset', connectorTopOffset);
    });
}