const scrollDebug = debug && debugIncludeScroll;
const scrollDebugV = debugV && debugIncludeScroll;

// Initialize the scroll zone and the current scroll stanza.
function scrollInit() {
    if(scrollDebugV) {
        dbp('scrollInit()') 
    }

    createScrollZone();
    if (scrollDebug) {
        anchor.childNodes.forEach((stanza) => {
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

    setCurrentScrollStanza(startStanza, true);
}

// Create the scrollable area that the user can interact with.
function createScrollZone() {
    if(scrollDebugV) {
        dbp('createScrollZone()') 
    }

    // Create a container for the scroll zone.
    scrollZoneData.container = document.createElement("div");
    scrollZoneData.container.id = 'scroll-zone-container';
    poemContainer.append(scrollZoneData.container);

    // Create the actual zone.
    scrollZoneData.el = document.createElement("div");
    scrollZoneData.el.id = 'scroll-zone';
    scrollZoneData.container.append(scrollZoneData.el);

    // Create the buffer scroll space so that the user doesnt see the scrollbars jumping around.
    scrollZoneData.buffer = document.createElement("div");
    scrollZoneData.buffer.id = 'scroll-zone-buffer';
    scrollZoneData.el.append(scrollZoneData.buffer);

    // Get and store the scroll zone's dimensions for later use.
    scrollZoneData.dims = {
        x: scrollZoneData.el.scrollWidth,
        y: scrollZoneData.el.scrollHeight
    }

    // Set the scroll zone's position, but don't track the initial movement as a scroll.
    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16,
        false
    );

    // Add the scroll listener to the scroll zone.
    scrollZoneData.el.onscroll = function (e) {
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
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16
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

    scrollZoneData.prevX = scrollZoneData.el.scrollLeft;
    scrollZoneData.prevY = scrollZoneData.el.scrollTop;
    scrollZoneData.el.scrollLeft = x;
    scrollZoneData.el.scrollTop = y;

    // If we want to track the total scrolling...
    if (addToTotal) {

        // Calculate the largest scroll value between vertical and horizontal.
        const left = scrollZoneData.prevX - scrollZoneData.el.scrollLeft;
        const top = scrollZoneData.prevY - scrollZoneData.el.scrollTop;
        const leftPower = Math.abs(left);
        const topPower = Math.abs(top);
        const maxScroll = leftPower > topPower ? left : top;

        // And then add them to the total.
        // We do this because we want vertical and 
        // horizontal scrolling to do the same thing, move the
        // poem diagonally. It can get confusing if someone doesn't
        // know whether they should scroll forizontally or vertically,
        // so we just normalize the value to the higher one.
        scrollZoneData.total = {
            x: scrollZoneData.total.x + maxScroll,
            y: scrollZoneData.total.y + maxScroll * slope
        }

        currentScrollValue += maxScroll;
    }
}

// Set the offsets for the poem, mimicing a diagonal scroll.
//
// The left aftive offset is what is changed for horizontal scroll
// and it will always be a function of the current scroll value,
// (Ex. scrollZoneData.total.x * theSlope + anOffset)
//
// The top active offset is a bit more complicated because
// the slopes of the different stanzas change.
function setAnchorOffsets(usedSlope = null) {
    const curSlope = usedSlope !== null? usedSlope : slope;
    if(scrollDebugV) {
        dbp('setAnchorOffsets()');
    }

    // Anchor bounding box
    const aBB = anchor.getBoundingClientRect();

    // Anchor bounding box width offset.
    const aBBWO = aBB.width/2;

    // Anchor bounding box height offset.
    const aBBHO = aBB.height/2;

    // Set the left active offset css value.
    anchorStyle.setProperty('--left-active-offset', (scrollZoneData.total.x * -1 + aBBWO));
    const indexedVal = currentScrollValue * curSlope * -1;

    if(scrollDebug) {
        dbp('');
        console.log('Previous scroll offset: ' + dbt(currentScrollStanzaData.previousScrollOffset));
        console.log('Indexed offset: ' + dbt(currentScrollStanzaData.indexedOffset));
        console.log('Direction: ' + dbt(direction));
        console.log('Anchor bounding box height offset, or');
        console.log('aBBHO: ' + dbt(aBBHO));
        // console.log('Stanza indexed y val: ' + (indexedVal));
        dbp('','\u2508');
    }

    let newTopActiveOffset = (currentScrollStanzaData.previousScrollOffset * direction) + currentScrollStanzaData.indexedOffset + aBBHO + indexedVal;

    if(scrollDebug) {
        console.log('Active offset (rounded): ' + dbt(newTopActiveOffset));
        console.log('(' + dbt(currentScrollStanzaData.previousScrollOffset) + '* ' + dbt(direction) + ') + ' + dbt(currentScrollStanzaData.indexedOffset) + '  + ' + dbt(aBBHO) + ' + ' + dbt(indexedVal) + ' = ' + dbt(newTopActiveOffset));
    }

    // anchorStyle.setProperty('--big-b', bigB);
    currentTopActiveOffset = newTopActiveOffset;
    // anchorStyle.setProperty('--top-active-offset', 'calc(' + newTopActiveOffset + ' + ' + bigB + ')');
    anchorStyle.setProperty('--top-active-offset', 'calc(' + currentTopActiveOffset + ')');
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
    
    // Reset the 'currentScrollValue'.
    let newCurrentScrollValue = 0;

    if (isFirst) {
        newCurrentScrollStanza.previousScrollOffset = 0;
        newCurrentScrollStanza.indexedOffset = 0;

        if (startInTopLeft) {
            newCurrentScrollValue = 0;
        }
        else {
            newCurrentScrollValue = newCurrentScrollStanza.target.getBoundingClientRect().width/2;
        }
    }
    else {

        if (currentScrollValue <= 0) {
            const normalizedValue = currentScrollValue + newCurrentScrollStanza.scrollWidth;
            newCurrentScrollValue = normalizedValue % newCurrentScrollStanza.scrollWidth;
            newCurrentScrollStanza.previousScrollOffset = scrollZoneData.total.y;
            newCurrentScrollStanza.indexedOffset = parseFloat(data.topOffset);
        }
        else {
            const normalizedValue = currentScrollValue + currentScrollStanzaData.scrollWidth;
            newCurrentScrollValue = normalizedValue % currentScrollStanzaData.scrollWidth;
            newCurrentScrollStanza.previousScrollOffset = -scrollZoneData.total.y;
            newCurrentScrollStanza.indexedOffset = 0;
        }
    }

    // Set the 'currentScrollValue' to what we have calculated it to be.
    currentScrollValue = newCurrentScrollValue;

    // Get and set the new slope.
    slope = parseFloat(newCurrentScrollStanza.slope);

    // And add it to the anchor stanza css.
    anchorStyle.setProperty('--slope', slope);

    //And then make the curent stanza data the stuff we made.
    currentScrollStanzaData = newCurrentScrollStanza;


    // dbp('');
    // console.log('GREATER');
    // // HEY ALAN THE CURRENT SCROLL VALUE IS A GOOD VRIABLE USE IT
    // console.log('pos in stanza: ' + currentScrollValue);
    // console.log('slope: ' + currentScrollStanzaData.slope);
    // console.log('f(n) WITHOUT +B: ' + currentScrollStanzaData.slope * currentScrollValue);
    // console.log('stanza number: ' + currentScrollStanzaData.target.nextSibling.dataset.stanzaNumber);

}

// Check to see if we have changed stanzas.
function checkStanzaScroll() {
    if(scrollDebugV) {
        dbp('checkStanzaScroll()');
    }


    if(scrollDebug) {
        console.log('Current scroll value: ' + currentScrollValue);
        console.log('Current scroll stanza width: ' + currentScrollStanzaData.scrollWidth);
        console.log('Greater: ' + (currentScrollValue > currentScrollStanzaData.scrollWidth));
        console.log('Lesser: ' + (currentScrollValue < 0));
    }

    // If we have passed beyond the width of the current scroll stanza...
    if (currentScrollValue > currentScrollStanzaData.scrollWidth) {
        // Set the current stanza.
        setCurrentScrollStanza(currentScrollStanzaData.target.nextSibling);
        direction = 1;
    }

    // Else if we have passed below the start of the current stanza...
    else if (currentScrollValue < 0) {

        // Set the current stanza.
        setCurrentScrollStanza(currentScrollStanzaData.target.previousSibling);
        direction = -1;
    }
}