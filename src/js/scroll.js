const scrollDebug = mourn.debug.on && mourn.debug.includeScroll;
const scrollDebugV = mourn.debug.verbose && mourn.debug.includeScroll;

// Initialize the scroll zone and the current scroll stanza.
function scrollInit() {
    if(scrollDebug) {
        dbp('scrollInit()') 
    }

    createScrollZone();
    if (scrollDebug) {
        mourn.trackers.anchor.childNodes.forEach((stanza) => {
            const centerDot = document.createElement("div");
            centerDot.classList.add('center-dot');
            stanza.prepend(centerDot);
    
            const bounds = document.createElement("div");
            bounds.classList.add('bounds');
            stanza.prepend(bounds);
    
            const boundsTri = document.createElement("div");
            boundsTri.classList.add('bounds-tri');
            bounds.prepend(boundsTri);
        });
    }

    setCurrentScrollStanza(mourn.trackers.startStanza, true);
}

// Create the scrollable area that the user can interact with.
function createScrollZone() {
    if(scrollDebugV) {
        dbp('createScrollZone()') 
    }

    // Create a container for the scroll zone.
    mourn.scrollZoneData.container = document.createElement("div");
    mourn.scrollZoneData.container.id = 'scroll-zone-container';
    mourn.config.poemContainer.append(mourn.scrollZoneData.container);

    // Create the actual zone.
    mourn.scrollZoneData.el = document.createElement("div");
    mourn.scrollZoneData.el.id = 'scroll-zone';
    mourn.scrollZoneData.container.append(mourn.scrollZoneData.el);

    // Create the buffer scroll space so that the user doesnt see the scrollbars jumping around.
    mourn.scrollZoneData.buffer = document.createElement("div");
    mourn.scrollZoneData.buffer.id = 'scroll-zone-buffer';
    mourn.scrollZoneData.el.append(mourn.scrollZoneData.buffer);

    // Get and store the scroll zone's dimensions for later use.
    mourn.scrollZoneData.dims = {
        x: mourn.scrollZoneData.el.scrollWidth,
        y: mourn.scrollZoneData.el.scrollHeight
    }

    // Set the scroll zone's position, but don't track the initial movement as a scroll.
    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        mourn.scrollZoneData.dims.x * 0.16,
        mourn.scrollZoneData.dims.y * 0.16,
        false
    );

    // Add the scroll listener to the scroll zone.
    mourn.scrollZoneData.el.onscroll = function (e) {
        scrollTick(e);
    }
}

// Funtion to fire on every scroll event.
function scrollTick(e) {
    if(scrollDebugV) {
        dbp('scrollTick()') 
    }

    // Reset the scroll zone and track the distance scrolled.
    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        mourn.scrollZoneData.dims.x * 0.16,
        mourn.scrollZoneData.dims.y * 0.16
    );

    cascadeRender();

    // Check to see if we have changed stanzas.
    checkStanzaScroll();

    setAnchorOffsets(null);
}

// Set the scroll zone and track any movement in a rolling scroll total.
function setScrollZone(x, y, addToTotal = true) {
    if(scrollDebugV) {
        dbp('setScrollZone()') 
    }

    mourn.scrollZoneData.prevX = mourn.scrollZoneData.el.scrollLeft;
    mourn.scrollZoneData.prevY = mourn.scrollZoneData.el.scrollTop;
    mourn.scrollZoneData.el.scrollLeft = x;
    mourn.scrollZoneData.el.scrollTop = y;

    // If we want to track the total scrolling...
    if (addToTotal) {

        // Calculate the largest scroll value between vertical and horizontal.
        const left = mourn.scrollZoneData.prevX - mourn.scrollZoneData.el.scrollLeft;
        const top = mourn.scrollZoneData.prevY - mourn.scrollZoneData.el.scrollTop;
        const leftPower = Math.abs(left);
        const topPower = Math.abs(top);
        const maxScroll = (leftPower > topPower ? left : top) * mourn.trackers.scrollSpeedMultiplier;

        // And then add them to the total.
        // We do this because we want vertical and 
        // horizontal scrolling to do the same thing, move the
        // poem diagonally. It can get confusing if someone doesn't
        // know whether they should scroll forizontally or vertically,
        // so we just normalize the value to the higher one.
        mourn.scrollZoneData.total = {
            x: mourn.scrollZoneData.total.x + maxScroll,
            y: mourn.scrollZoneData.total.y + maxScroll * mourn.trackers.slope
        }

        mourn.scrollStanza.currentScrollValue += maxScroll;
    }
}

// Set the offsets for the poem, mimicing a diagonal scroll.
//
// The left aftive offset is what is changed for horizontal scroll
// and it will always be a function of the current scroll value,
// (Ex. mourn.scrollZoneData.total.x * theSlope + anOffset)
//
// The top active offset is a bit more complicated because
// the slopes of the different stanzas change.
function setAnchorOffsets(usedSlope = null) {
    const curSlope = usedSlope !== null? usedSlope : mourn.trackers.slope;
    if(scrollDebugV) {
        dbp('setAnchorOffsets()');
    }

    // Anchor bounding box
    const aBB = mourn.trackers.anchor.getBoundingClientRect();

    // Anchor bounding box width offset.
    const aBBWO = aBB.width/2;

    // Anchor bounding box height offset.
    const aBBHO = aBB.height/2;

    // Set the left active offset css value.
    mourn.trackers.anchorStyle.setProperty('--left-active-offset', (mourn.scrollZoneData.total.x * -1 + aBBWO));
    const indexedVal = mourn.scrollStanza.currentScrollValue * curSlope * -1;

    if(scrollDebug) {
        dbp('');
        console.log('Previous scroll offset: ' + dbt(mourn.scrollStanza.currentScrollStanzaData.previousScrollOffset));
        console.log('Indexed offset: ' + dbt(mourn.scrollStanza.currentScrollStanzaData.indexedOffset));
        console.log('Direction: ' + dbt(mourn.scrollStanza.mourn.scrollStanza.direction));
        console.log('Anchor bounding box height offset, or');
        console.log('aBBHO: ' + dbt(aBBHO));
        // console.log('Stanza indexed y val: ' + (indexedVal));
        dbp('','\u2508');
    }

    let newTopActiveOffset = (mourn.scrollStanza.currentScrollStanzaData.previousScrollOffset * mourn.scrollStanza.direction) + mourn.scrollStanza.currentScrollStanzaData.indexedOffset + aBBHO + indexedVal;

    if(scrollDebug) {
        console.log('Active offset (rounded): ' + dbt(newTopActiveOffset));
        console.log('(' + dbt(mourn.scrollStanza.currentScrollStanzaData.previousScrollOffset) + '* ' + dbt(mourn.scrollStanza.direction) + ') + ' + dbt(mourn.scrollStanza.currentScrollStanzaData.indexedOffset) + '  + ' + dbt(aBBHO) + ' + ' + dbt(indexedVal) + ' = ' + dbt(newTopActiveOffset));
    }

    // mourn.trackers.anchorStyle.setProperty('--big-b', bigB);
    mourn.scrollStanza.currentTopActiveOffset = newTopActiveOffset;
    // mourn.trackers.anchorStyle.setProperty('--top-active-offset', 'calc(' + newTopActiveOffset + ' + ' + bigB + ')');
    mourn.trackers.anchorStyle.setProperty('--top-active-offset', 'calc(' + mourn.scrollStanza.currentTopActiveOffset + ')');
}

// Sets what stanza is the current stanza.
function setCurrentScrollStanza(stanza, isFirst = false, BigB = false) {
    if(scrollDebugV) {
        dbp('setCurrentScrollStanza()') 
    }

    if(scrollDebug) {
        console.log('STANZA PASSED IN');
        console.log(stanza);
    }

    // Initialize a new object for a scroll stanza.
    // This should probably be an object with a constructor.
    const newCurrentScrollStanza = {};

    // Get the stanza we are setting as the current stanza's data attributes.
    const data = stanza.dataset;

    // And track some of its relevant data.

    newCurrentScrollStanza.target = stanza;
    newCurrentScrollStanza.slope = parseFloat(data.slope);
    newCurrentScrollStanza.scrollWidth = parseFloat(data.scrollWidth);

    if(scrollDebug) {
        console.log('Stanza data created');
        console.log(newCurrentScrollStanza);
    }
    
    // Reset the 'mourn.scrollStanza.currentScrollValue'.
    let newCurrentScrollValue = 0;

    if (isFirst) {
        newCurrentScrollStanza.previousScrollOffset = 0;
        newCurrentScrollStanza.indexedOffset = 0;

        if (mourn.config.startInTopLeft) {
            newCurrentScrollValue = 0;
        }
        else {
            newCurrentScrollValue = newCurrentScrollStanza.target.getBoundingClientRect().width/2;
        }
    }
    else {

        if (mourn.scrollStanza.currentScrollValue <= 0) {
            const normalizedValue = mourn.scrollStanza.currentScrollValue + newCurrentScrollStanza.scrollWidth;
            newCurrentScrollValue = normalizedValue % newCurrentScrollStanza.scrollWidth;
            newCurrentScrollStanza.previousScrollOffset = mourn.scrollZoneData.total.y;
            newCurrentScrollStanza.indexedOffset = parseFloat(data.topOffset);
        }
        else {
            const normalizedValue = mourn.scrollStanza.currentScrollValue + mourn.scrollStanza.currentScrollStanzaData.scrollWidth;
            newCurrentScrollValue = normalizedValue % mourn.scrollStanza.currentScrollStanzaData.scrollWidth;
            newCurrentScrollStanza.previousScrollOffset = -mourn.scrollZoneData.total.y;
            newCurrentScrollStanza.indexedOffset = 0;
        }
    }

    // Set the 'mourn.scrollStanza.currentScrollValue' to what we have calculated it to be.
    mourn.scrollStanza.currentScrollValue = newCurrentScrollValue;

    // Get and set the new slope.
    mourn.trackers.slope = parseFloat(newCurrentScrollStanza.slope);

    // And add it to the anchor stanza css.
    mourn.trackers.anchorStyle.setProperty('--slope', mourn.trackers.slope);

    //And then make the curent stanza data the stuff we made.
    mourn.scrollStanza.currentScrollStanzaData = newCurrentScrollStanza;


    // dbp('');
    // console.log('GREATER');
    // // HEY ALAN THE CURRENT SCROLL VALUE IS A GOOD VRIABLE USE IT
    // console.log('pos in stanza: ' + mourn.scrollStanza.currentScrollValue);
    // console.log('slope: ' + mourn.scrollStanza.currentScrollStanzaData.slope);
    // console.log('f(n) WITHOUT +B: ' + mourn.scrollStanza.currentScrollStanzaData.slope * mourn.scrollStanza.currentScrollValue);
    // console.log('stanza number: ' + mourn.scrollStanza.currentScrollStanzaData.target.nextSibling.dataset.stanzaNumber);

}

// Check to see if we have changed stanzas.
function checkStanzaScroll() {
    if(scrollDebugV) {
        dbp('checkStanzaScroll()');
    }


    if(scrollDebug) {
        console.log('Current scroll value: ' + mourn.scrollStanza.currentScrollValue);
        console.log('Current scroll stanza width: ' + mourn.scrollStanza.currentScrollStanzaData.scrollWidth);
        console.log('Greater: ' + (mourn.scrollStanza.currentScrollValue > mourn.scrollStanza.currentScrollStanzaData.scrollWidth));
        console.log('Lesser: ' + (mourn.scrollStanza.currentScrollValue < 0));
    }

    // If we have passed beyond the width of the current scroll stanza...
    if (mourn.scrollStanza.currentScrollValue > mourn.scrollStanza.currentScrollStanzaData.scrollWidth) {
        // Set the current stanza.
        setCurrentScrollStanza(mourn.scrollStanza.currentScrollStanzaData.target.nextSibling);
        mourn.scrollStanza.direction = 1;
    }

    // Else if we have passed below the start of the current stanza...
    else if (mourn.scrollStanza.currentScrollValue < 0) {

        // Set the current stanza.
        setCurrentScrollStanza(mourn.scrollStanza.currentScrollStanzaData.target.previousSibling);
        mourn.scrollStanza.direction = -1;
    }
}