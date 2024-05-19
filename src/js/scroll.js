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

    calcStartScrollPos();
}

function createScrollZone() {
    if(debugV) {
        dbp('createScrollZone()') 
    }

    scrollZoneData.container = document.createElement("div");
    scrollZoneData.container.id = 'scroll-zone-container';
    poemContainer.append(scrollZoneData.container);

    scrollZoneData.el = document.createElement("div");
    scrollZoneData.el.id = 'scroll-zone';
    scrollZoneData.container.append(scrollZoneData.el);

    scrollZoneData.buffer = document.createElement("div");
    scrollZoneData.buffer.id = 'scroll-zone-buffer';
    scrollZoneData.el.append(scrollZoneData.buffer);

    scrollZoneData.dims = {
        x: scrollZoneData.el.scrollWidth,
        y: scrollZoneData.el.scrollHeight
    }

    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16,
        false
    );

    scrollZoneData.el.onscroll = function (e) {
        scrollTick(e);
    }
}

function scrollTick(e) {
    if(debugV) {
        dbp('scrollTick()') 
    }

    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16
    );
    setAnchorOffsets();
    checkStanzaScroll()
}

function setScrollZone(x, y, addToTotal = true) {
    if(debugV) {
        dbp('setScrollZone()') 
    }

    scrollZoneData.prevX = scrollZoneData.el.scrollLeft;
    scrollZoneData.prevY = scrollZoneData.el.scrollTop;
    scrollZoneData.el.scrollLeft = x;
    scrollZoneData.el.scrollTop = y;

    if (addToTotal) {
        const left = scrollZoneData.prevX - scrollZoneData.el.scrollLeft;
        const top = scrollZoneData.prevY - scrollZoneData.el.scrollTop;
        const leftPower = Math.abs(left);
        const topPower = Math.abs(top);
        const maxScroll = leftPower > topPower ? left : top;
        scrollZoneData.total = {
            x: scrollZoneData.total.x + maxScroll,
            y: scrollZoneData.total.y + maxScroll
        }

        currentScrollValue += maxScroll;
    }
}

function setAnchorOffsets() {
    if(debugV) {
        dbp('setAnchorOffsets()') 
    }

    anchorStyle.setProperty('--left-main-offset', (scrollZoneData.total.x) * -1);
    anchorStyle.setProperty('--top-main-offset', (scrollZoneData.total.y*slope) * -1);
}

function calcStartScrollPos() {
    if(debug) {
        dbp('calcStartScrollPos()') 
    }

    const startData = startStanza.dataset;
    const startTerminatorWidth = parseFloat(startData.terminatorWidth);
    const startFullWidth = startTerminatorWidth + parseFloat(startData.scrollWidth);
    console.log(startTerminatorWidth, parseFloat(startData.scrollWidth));
    startScrollPos = startFullWidth/2;

    calcAnchorOffset();
}

function calcAnchorOffset() {
    if(debugV) {
        dbp('calcAnchorOffset()') 
    }

    const currentStanza = currentScrollStanzaData.target;
    const startStanzaLastLineChildNodes = currentStanza.childNodes[currentStanza.childNodes.length-1].childNodes;
    const startStanzaTerminator = startStanzaLastLineChildNodes[startStanzaLastLineChildNodes.length-1];
    const startStanzaTerminatorHeight = startStanzaTerminator.getBoundingClientRect().height;
    const startStanzaMid = currentStanza.getBoundingClientRect().height/2;

    // y = mx+b;
    console.log(parseFloat(currentStanza.dataset.slope), currentScrollValue, startStanzaTerminatorHeight);
    const y = parseFloat(currentStanza.dataset.slope)*startScrollPos + startStanzaTerminatorHeight;
    // console.log(startStanzaMid+startStanzaTerminatorHeight);
    // console.log(y);
    anchorStyle.setProperty('--start-offset', (startStanzaMid + startStanzaTerminatorHeight - y));
}

function setCurrentScrollStanza(stanza, isFirst = false) {
    if(debugV) {
        dbp('setCurrentScrollStanza()') 
    }

    const newCurrentScrollStanza = {};
    const data = stanza.dataset;
    newCurrentScrollStanza.target = stanza;
    newCurrentScrollStanza.slope = parseFloat(data.slope);
    newCurrentScrollStanza.scrollWidth = parseFloat(data.scrollWidth);
    
    let newCurrentScrollValue = 0;
    console.log(newCurrentScrollValue);

    if (isFirst) {
        newCurrentScrollValue = startScrollPos;
    }
    else {
        if (currentScrollValue < 0) {
            const normalizedValue = currentScrollValue + newCurrentScrollStanza.scrollWidth;
            newCurrentScrollValue = normalizedValue % newCurrentScrollStanza.scrollWidth;
        }
        else {
            const normalizedValue = currentScrollValue + currentScrollStanzaData.scrollWidth;
            newCurrentScrollValue = normalizedValue % currentScrollStanzaData.scrollWidth;
        }
    }

    currentScrollValue = newCurrentScrollValue;
    slope = parseFloat(newCurrentScrollStanza.slope);
    currentScrollStanzaData = newCurrentScrollStanza;

    calcAnchorOffset();
}

function checkStanzaScroll() {
    if(debugV) {
        dbp('checkStanzaScroll()') 
    }

    if (currentScrollValue > currentScrollStanzaData.scrollWidth) {
        console.log('greater');
        console.log(currentScrollValue);
        setCurrentScrollStanza(currentScrollStanzaData.target.nextSibling);
    }
    else if (currentScrollValue < 0) {
        console.log('lesser');
        console.log(currentScrollValue);
        setCurrentScrollStanza(currentScrollStanzaData.target.previousSibling);
    }
}