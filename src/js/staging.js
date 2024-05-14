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