function scrollInit() {
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

    calcStartScrollPos();

    setCurrentScrollStanza(startStanza, true);
}

function createScrollZone() {
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
    setScrollZone(
        // Multiply by 0.16 to put it in the center.
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16
    );
    setAnchorOffsets();
    checkStanzaScroll()
}

function setScrollZone(x, y, addToTotal = true) {
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
    anchorStyle.setProperty('--left-main-offset', (scrollZoneData.total.x) * -1);
    anchorStyle.setProperty('--top-main-offset', (scrollZoneData.total.y*slope) * -1);
}

function calcStartScrollPos() {
    const startData = startStanza.dataset;
    const startTerminatorWidth = parseFloat(startData.terminatorWidth);
    const startFullWidth = startTerminatorWidth + parseFloat(startData.scrollWidth);
    startScrollPos = startFullWidth/2;

    const startStanzaLastLineChildNodes = startStanza.childNodes[startStanza.childNodes.length-1].childNodes;
    const startStanzaTerminator = startStanzaLastLineChildNodes[startStanzaLastLineChildNodes.length-1];
    const startStanzaTerminatorHeight = startStanzaTerminator.getBoundingClientRect().height;
    const startStanzaMid = startStanza.getBoundingClientRect().height/2;

    // y = mx+b;
    const y = parseFloat(startStanza.dataset.slope)*startScrollPos + startStanzaTerminatorHeight;
    console.log(startStanzaMid+startStanzaTerminatorHeight);
    console.log(y);
    anchorStyle.setProperty('--start-offset', (startStanzaMid + startStanzaTerminatorHeight - y));
}

function setCurrentScrollStanza(stanza, isFirst = false) {
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
            const normalizedValue = currentScrollValue + currentScrollStanza.scrollWidth;
            newCurrentScrollValue = normalizedValue % currentScrollStanza.scrollWidth;
        }
    }
    console.log(newCurrentScrollStanza.target);

    currentScrollValue = newCurrentScrollValue;
    slope = parseFloat(newCurrentScrollStanza.slope);
    currentScrollStanza = newCurrentScrollStanza;
}

function checkStanzaScroll() {
    if (currentScrollValue > currentScrollStanza.scrollWidth) {
        console.log('greater');
        console.log(currentScrollValue);
    }
    else if (currentScrollValue < 0) {
        console.log('lesser');
        console.log(currentScrollValue);
    }
}