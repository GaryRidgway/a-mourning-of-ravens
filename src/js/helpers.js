const helpersDebug = mourn.debug.on && mourn.debug.includeHelpers;
const helpersDebugV = mourn.debug.verbose && mourn.debug.includeHelpers;

function scale(number, inMin, inMax, outMin, outMax) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function logScale(x) {
    const logScalar = (mourn.staging.maxScaling - mourn.staging.minScaling)/Math.log(10);
    return Math.log(x)*logScalar+mourn.staging.minScaling
}

function invLogScale(x) {
    const normalVal =  logScale(x);
    return scale(normalVal, mourn.staging.minScaling, mourn.staging.maxScaling, mourn.staging.maxScaling, mourn.staging.minScaling);
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function randomStanzaIndex() {
    return getRandomInt(mourn.config.stanzaCount);
}

function fetchStanza(index, selector, uid = null) {
    const realIndex = (index + mourn.config.stanzaCount) % mourn.config.stanzaCount;
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
    if (helpersDebug) {
        console.log('++--is in viewport--++')
    }

    const lenience = mourn.scrollZoneData.lenience;

    var rect = element.getBoundingClientRect();
    var html = document.documentElement;

    return (
        rect.top >= 0 - lenience &&
        rect.left >= 0 - lenience &&
        rect.bottom <= (window.innerHeight || html.clientHeight) + lenience &&
        rect.right <= (window.innerWidth || html.clientWidth) + lenience
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
    const connectorKeys = Object.keys(mourn.trackers.nonRenderedConnectors);

    if (connectorKeys.length > 0) {
        const connectors = [];
        connectorKeys.forEach((key) => {
            const connector = mourn.trackers.nonRenderedConnectors[key];
            if ( isInViewport(connector.stanza) ) {
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


//https://byjus.com/maths/angle-between-two-lines/#:~:text=Problem%20With%20Solution
function lineSlope(pointData) {
    return (pointData[1].y - pointData[0].y)  / (pointData[1].x - pointData[0].x);
}

function angleFromSlopes(slope1, slope2){
    return Math.atan((slope2 - slope1 ) / ( 1 + slope1*slope2));
}