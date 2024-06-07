// Initialize the scroll zone and the current scroll stanza.
function scrollInit() {
    if(debugV) {
        dbp('scrollInit()') 
    }

    createScrollZone();
    if (debug) {
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
    if(debugV) {
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
    if(debugV) {
        dbp('scrollTick()') 
    }

    // Reset the scroll zone and track the distance scrolled.
    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16
    );

    // Check to see if we have changed stanzas.
    const useBigB = checkStanzaScroll();
    setAnchorOffsets(null, useBigB);
}

// Set the scroll zone and track any movement in a rolling scroll total.
function setScrollZone(x, y, addToTotal = true) {
    if(debugV) {
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
            y: scrollZoneData.total.y + maxScroll
        }

        currentScrollValue += maxScroll;
    }
}

function setAnchorOffsets(usedSlope = null, useBigB = 0) {
    const curSlope = usedSlope !== null? usedSlope : slope;
    if(debugV) {
        dbp('setAnchorOffsets()') 
    }

    const aBB = anchor.getBoundingClientRect();
    const aBBWO = aBB.width/2;
    const aBBHO = aBB.height/2;

    anchorStyle.setProperty('--left-active-offset', (scrollZoneData.total.x * -1 + aBBWO));
    let newTopActiveOffset = (scrollZoneData.total.x * curSlope * -1 + aBBHO);

    if (useBigB !== 0) {
        // console.log('BEEG')
        // newTopActiveOffset = currentTopActiveOffset;
    }

    anchorStyle.setProperty('--big-b', bigB);
    currentTopActiveOffset = newTopActiveOffset;
    // anchorStyle.setProperty('--top-active-offset', 'calc(' + newTopActiveOffset + ' + ' + bigB + ')');
    anchorStyle.setProperty('--top-active-offset', 'calc(' + newTopActiveOffset + ')');

}

// Sets what stanza is the current stanza.
function setCurrentScrollStanza(stanza, isFirst = false, BigB = false) {
    if(debugV) {
        dbp('setCurrentScrollStanza()') 
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
    
    // Reset the 'currentScrollValue'.
    let newCurrentScrollValue = 0;

    if (isFirst) {
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
        }
        else {
            const normalizedValue = currentScrollValue + currentScrollStanzaData.scrollWidth;
            newCurrentScrollValue = normalizedValue % currentScrollStanzaData.scrollWidth;
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
}

// Check to see if we have changed stanzas.
function checkStanzaScroll() {
    if(debugV) {
        dbp('checkStanzaScroll()');
    }

    // Set to 0 by default.
    let changingStanza = 0;

    // If we have passed beyond the width of the current scroll stanza...
    if (currentScrollValue > currentScrollStanzaData.scrollWidth) {
        dbp('greater');
        dbp(scrollZoneData.total.x % currentScrollStanzaData.scrollWidth);
        console.log(currentScrollStanzaData.target.nextSibling.dataset.stanzaNumber);

        // Set the current stanza.
        setCurrentScrollStanza(currentScrollStanzaData.target.nextSibling);
        changingStanza = -1;
    }

    // Else if we have passed below the start of the current stanza.
    else if (currentScrollValue < 0) {
        dbp('lesser');
        console.log(parseFloat(currentScrollStanzaData.target.previousSibling.dataset.scrollWidth));
        console.log(currentScrollStanzaData.target.previousSibling.dataset.stanzaNumber);

        // Set the current stanza.
        setCurrentScrollStanza(currentScrollStanzaData.target.previousSibling);
        changingStanza = 1;
    }

    return changingStanza;
}