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