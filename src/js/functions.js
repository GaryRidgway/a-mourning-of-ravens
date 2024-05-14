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

function fetchStanza(index, selector) {
    const realIndex = (index + stanzaCount) % stanzaCount;
    const stanza = document.querySelector(selector + ' [data-stanza-number="' + realIndex + '"');
    return stanza;
}

function fetchStagedStanza(index) {
    return fetchStanza(index, '#poem-staging');
}

function fetchRenderedStanza(index) {
    return fetchStanza(index, '#poem-container');
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

function render(prevStanza, direction = 1) {
    // console.log('-------START RENDER-------');

    const prevStanzaIndex = parseInt(prevStanza.dataset.stanzaNumber);
    const stanza = fetchStagedStanza(prevStanzaIndex + direction);

    const refStanza = direction < 0 ? stanza : prevStanza;
    const styleStanza = fetchRenderedStanza(prevStanzaIndex);
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

function cascadeRender(
    stanza,
    index,
    cascadeOptions = defaultCascadeOptions,
    renderOptions = defaultRenderOptions
) {
    let newIterationMax = null;
    if(cascadeOptions.iterationMax !== null) {
        newIterationMax = {
            'iteration': cascadeOptions.iterationMax['iteration']+1,
            'max': cascadeOptions.iterationMax['max']
        }

        if (newIterationMax.iteration >= newIterationMax.max) {
            return;
        }
    }

    const initiator = stanza.querySelector('.initiator');
    const terminator = stanza.querySelector('.terminator');

    // INITIATOR.
    // isInViewport(terminator)
    if (cascadeOptions.flow < 1) {
        nonRenderedConnectors.push(
            {
                direction: -1,
                element: initiator
            }
        );
    }

    // TERMINATOR.
    if (cascadeOptions.flow > -1) {
        nonRenderedConnectors.push(
            {
                direction: 1,
                element: terminator
            }
        );
    }

    if (nonRenderedConnectors.length > 0) {
        nonRenderedConnectors.forEach((connector) => {
            const conIndex = index + connector.direction;
            const newStanzaRefs = render(
                stanza,
                connector.direction,
                renderOptions
            );
    
            const newStanza = newStanzaRefs.stanza;
            const newStanzaRenderOptions = newStanzaRefs.options;
    
            if (cascadeOptions.estop) {
                return;
            }
    
            cascadeRender(
                newStanza,
                conIndex,
                {
                    flow: connector.direction,
                    iterationMax: newIterationMax ? newIterationMax : null,
                    estop: cascadeOptions.estop
                },
                newStanzaRenderOptions
            );
        });
    }
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