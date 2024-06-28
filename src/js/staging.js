function pairSpaceAndScale() {
    const allLines = mourn.config.poemStaging.querySelectorAll('.stanza .line');
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
            mourn.staging.leastChars,
            mourn.staging.mostChars,
            1,
            10
        ));
        line.style.setProperty('--char-spacing', spacing + 'px')


        const scaling = invLogScale(scale(
            charCount,
            mourn.staging.leastChars,
            mourn.staging.mostChars,
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
        if (stanzaWidth > mourn.staging.widestStanza) {
            mourn.staging.widestStanza = Math.ceil(stanzaWidth);
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
    mourn.config.poemStaging.append(stanza);
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
        if (chars > mourn.staging.mostChars) {
            mourn.staging.mostChars = Math.ceil(chars);
            const prevEl = document.getElementById('most-line-characters');
            if (prevEl) {
                prevEl.removeAttribute('id');
            }
            line.setAttribute('id', 'most-line-characters');
        }
        else if (chars < mourn.staging.leastChars) {
            mourn.staging.leastChars = Math.floor(chars);
            const prevEl = document.getElementById('least-line-characters');
            if (prevEl) {
                prevEl.removeAttribute('id');
            }
            line.setAttribute('id', 'least-line-characters');
        }
    });
}

function setStanzaOffsets() {
    mourn.config.poemStaging.childNodes.forEach((stanza, index) => {
        const stanzaBB = stanza.getBoundingClientRect();
        const SPD = getDiagonalOfBB(stanzaBB);
        const SSlope = lineSlope(SPD);

        const initiator = stanza.querySelector('.initiator');
        const initiatorBB = initiator.getBoundingClientRect();
        const IPD = getDiagonalOfBB(initiatorBB);
        const ISlope = lineSlope(IPD);

        const terminator = stanza.querySelector('.terminator');
        const terminatorBB = terminator.getBoundingClientRect();
        const TPD = getDiagonalOfBB(terminatorBB);
        const TSlope = lineSlope(TPD);
    
        const left = terminatorBB.left - initiatorBB.left;
        const top = terminatorBB.top - initiatorBB.top;
        const initiatorTopOffset = stanzaBB.top - initiatorBB.top;

        stanza.setAttribute('data-left-offset', left);
        stanza.setAttribute('data-top-offset', top);
        stanza.setAttribute('data-initiator-top-offset', initiatorTopOffset);
        stanza.setAttribute('data-terminator-width', (TPD[1].x - TPD[0].x));
        const slopeData = [
            SPD[0], {
                x: SPD[1].x - TPD[1].x,
                y: SPD[1].y - TPD[1].y,
            }
        ]
        stanza.setAttribute('data-slope', lineSlope(slopeData));
        stanza.setAttribute('data-scroll-width-begin', mourn.staging.fullScrollWidth);
        const scrollWidth = SPD[1].x - TPD[1].x;
        mourn.staging.fullScrollWidth += scrollWidth;
        stanza.setAttribute('data-scroll-width', scrollWidth);
        stanza.style.setProperty('--svg-width', scrollWidth);
        stanza.style.setProperty('--svg-height', SPD[1].y - TPD[1].y);
    });
}


function getDiagonalOfBB(BB) {
    // const stanzaBB = stanza.getBoundingClientRect();
    const tl = {
        x: BB.left - BB.left,
        y: BB.top - BB.top
    }
    const br = {
        x: BB.right - BB.left,
        y: BB.bottom - BB.top
    }
    return [
        tl,
        br
    ];
}