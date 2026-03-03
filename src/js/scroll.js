const scrollDebug = mourn.debug.on && mourn.debug.includeScroll;
const scrollDebugV = mourn.debug.verbose && mourn.debug.includeScroll;
let autoScrollRafId = null;
let autoScrollPrevFrameTs = null;
let reducedMotionListener = null;
let reducedMotionMediaQuery = null;
let scrollTickRafId = null;
let refreshRingMetricsRafId = null;
let flowBoxesSyncRafId = null;
const flowParams = new URLSearchParams(window.location.search);
let flowWordBoxesEnabled = (() => {
    const raw = flowParams.get('wordBoxes');
    if (raw === null) return true;
    return raw === '1';
})();
let flowWordInsetXPx = (() => {
    const raw = flowParams.get('wordInsetX') ?? flowParams.get('wordInset');
    const parsed = raw === null ? 3 : parseFloat(raw);
    if (!Number.isFinite(parsed)) return 3;
    return Math.max(0, Math.min(20, parsed));
})();
let flowWordInsetYPx = (() => {
    const raw = flowParams.get('wordInsetY') ?? flowParams.get('wordInset');
    const parsed = raw === null ? 5 : parseFloat(raw);
    if (!Number.isFinite(parsed)) return 5;
    return Math.max(0, Math.min(20, parsed));
})();

window.__mournSetWordBoxes = function setWordBoxes(enabled) {
    flowWordBoxesEnabled = !!enabled;
    queueFlowFieldBoxSync();
};
window.__mournSetWordInsetPx = function setWordInsetPx(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordInsetXPx = Math.max(0, Math.min(20, parsed));
    flowWordInsetYPx = Math.max(0, Math.min(20, parsed));
    queueFlowFieldBoxSync();
};
window.__mournSetWordInsetXPx = function setWordInsetXPx(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordInsetXPx = Math.max(0, Math.min(20, parsed));
    queueFlowFieldBoxSync();
};
window.__mournSetWordInsetYPx = function setWordInsetYPx(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordInsetYPx = Math.max(0, Math.min(20, parsed));
    queueFlowFieldBoxSync();
};
const perfProbe = {
    enabled: false,
    logEnabled: false,
    lastFrameTs: null,
    frames: 0,
    totalDeltaMs: 0,
    maxDeltaMs: 0,
    spikesOver24ms: 0,
    wraps: {
        toCenterFromLow: 0,
        toCenterFromHigh: 0,
    },
};

function isPerfURLFlagEnabled() {
    const params = new URLSearchParams(window.location.search);
    return params.get('perf') === '1';
}

function formatPerfSnapshot() {
    const avgMs = perfProbe.frames > 0 ? (perfProbe.totalDeltaMs / perfProbe.frames) : 0;
    return [
        '[pf]',
        'f=' + perfProbe.frames,
        'a=' + avgMs.toFixed(2),
        'm=' + perfProbe.maxDeltaMs.toFixed(2),
        's24=' + perfProbe.spikesOver24ms,
        'wl=' + perfProbe.wraps.toCenterFromLow,
        'wh=' + perfProbe.wraps.toCenterFromHigh,
    ].join(' ');
}

function initPerfProbe() {
    perfProbe.enabled = scrollDebug || isPerfURLFlagEnabled();
    perfProbe.logEnabled = false;
    perfProbe.lastFrameTs = null;
    perfProbe.frames = 0;
    perfProbe.totalDeltaMs = 0;
    perfProbe.maxDeltaMs = 0;
    perfProbe.spikesOver24ms = 0;
    perfProbe.wraps.toCenterFromLow = 0;
    perfProbe.wraps.toCenterFromHigh = 0;
    window.__mournPerf = perfProbe;
    window.__mournPerfSnapshot = () => formatPerfSnapshot();
    window.__mournPerfPrint = () => {
        const snapshot = formatPerfSnapshot();
        console.log(snapshot);
        return snapshot;
    };
    window.__mournPerfReset = () => {
        initPerfProbe();
        return formatPerfSnapshot();
    };
    window.__mournPerfLogs = (enabled) => {
        perfProbe.logEnabled = !!enabled;
        return perfProbe.logEnabled;
    };
}

function perfRecordFrame(timestamp, source = 'unknown') {
    if (!perfProbe.enabled || timestamp === null) {
        return;
    }

    if (perfProbe.lastFrameTs !== null) {
        const deltaMs = timestamp - perfProbe.lastFrameTs;
        perfProbe.frames += 1;
        perfProbe.totalDeltaMs += deltaMs;
        perfProbe.maxDeltaMs = Math.max(perfProbe.maxDeltaMs, deltaMs);
        if (deltaMs > 24) {
            perfProbe.spikesOver24ms += 1;
            if (scrollDebugV && perfProbe.logEnabled) {
                console.warn('[perf] frame spike', { deltaMs: Math.round(deltaMs * 10) / 10, source });
            }
        }

        if (perfProbe.logEnabled && perfProbe.frames % 120 === 0) {
            console.log(formatPerfSnapshot());
        }
    }

    perfProbe.lastFrameTs = timestamp;
}

function perfMarkWrap(direction) {
    if (!perfProbe.enabled) {
        return;
    }

    if (direction === 'low') {
        perfProbe.wraps.toCenterFromLow += 1;
    }
    else if (direction === 'high') {
        perfProbe.wraps.toCenterFromHigh += 1;
    }
}

function snapOffset(value, precision = 10) {
    return Math.round(value * precision) / precision;
}

function getRenderedStanzas() {
    return Array.from(mourn.trackers.anchor.children).filter((el) => el.classList.contains('stanza'));
}

function positiveModulo(value, modulo) {
    return ((value % modulo) + modulo) % modulo;
}

function getStanzaScrollMeta(stanza) {
    if (stanza && stanza._ringData) {
        return stanza._ringData;
    }

    const data = stanza.dataset;
    return {
        slope: parseFloat(data.slope),
        scrollWidth: parseFloat(data.scrollWidth),
        topOffset: parseFloat(data.topOffset),
    };
}

function refreshRingMetrics() {
    if (!mourn.scrollZoneData.ring) {
        return;
    }

    mourn.scrollZoneData.ring.records.forEach((record) => {
        const bb = record.el.getBoundingClientRect();
        record.el._ringData.width = bb.width;
        record.el._ringData.height = bb.height;
    });
}

function isRingWrapCandidate() {
    if (!mourn.scrollZoneData.ring || !mourn.scrollStanza.currentScrollStanzaData) {
        return false;
    }

    const ring = mourn.scrollZoneData.ring;
    const currentIndex = mourn.scrollStanza.currentScrollStanzaData.target._ringIndex;
    if (typeof currentIndex !== 'number') {
        return false;
    }

    return (
        currentIndex <= ring.centerStartIndex ||
        currentIndex >= ring.centerEndIndex
    );
}

function shiftRingOffsets(deltaLeft, deltaTop) {
    if (!mourn.scrollZoneData.ring) {
        return;
    }

    mourn.scrollZoneData.ring.records.forEach((record) => {
        record.left += deltaLeft;
        record.top += deltaTop;
        record.el.style.setProperty('--left-offset', record.left);
        record.el.style.setProperty('--top-offset', record.top);
    });
}

function seedFixedCycleRing() {
    const seedCycleCount = 5;
    const cycleSize = mourn.config.stanzaCount;
    const activeCycleIndex = Math.floor(seedCycleCount / 2);
    const totalSeededStanzas = cycleSize * seedCycleCount;
    const activeIndex = cycleSize * activeCycleIndex;

    const previousStartStanza = mourn.trackers.startStanza;
    const startIndex = previousStartStanza
        ? parseInt(previousStartStanza.dataset.stanzaNumber)
        : 0;
    getRenderedStanzas().forEach((stanza) => stanza.remove());
    mourn.trackers.nonRenderedConnectors = {};

    let leftOffset = 0;
    let topOffset = 0;
    const seeded = [];
    const ringRecords = [];
    const seededStagedStanzas = [];
    const seededOffsets = [];

    for (let i = 0; i < totalSeededStanzas; i++) {
        const sequenceIndex = startIndex - activeIndex + i;
        const stagedStanza = fetchStagedStanza(sequenceIndex);
        if (!stagedStanza) {
            console.error('Failed to fetch staged stanza for ring seed.', { sequenceIndex });
            if (previousStartStanza) {
                mourn.trackers.startStanza = previousStartStanza;
            }
            return false;
        }
        seededStagedStanzas.push(stagedStanza);
        seededOffsets.push({
            leftOffset,
            topOffset,
        });

        const stanzaLeftDelta = parseFloat(stagedStanza.dataset.leftOffset);
        const stanzaTopDelta = parseFloat(stagedStanza.dataset.topOffset);
        leftOffset += stanzaLeftDelta;
        topOffset += stanzaTopDelta;
    }

    const activeOrigin = seededOffsets[activeIndex];
    if (!activeOrigin) {
        console.error('Failed to compute active origin for ring seed.');
        if (previousStartStanza) {
            mourn.trackers.startStanza = previousStartStanza;
        }
        return false;
    }

    for (let i = 0; i < totalSeededStanzas; i++) {
        const stagedStanza = seededStagedStanzas[i];
        const offset = seededOffsets[i];
        const ringLeft = offset.leftOffset - activeOrigin.leftOffset;
        const ringTop = offset.topOffset - activeOrigin.topOffset;
        const ringData = {
            slope: parseFloat(stagedStanza.dataset.slope),
            scrollWidth: parseFloat(stagedStanza.dataset.scrollWidth),
            topOffset: parseFloat(stagedStanza.dataset.topOffset),
            width: stagedStanza.getBoundingClientRect().width,
            height: stagedStanza.getBoundingClientRect().height,
        };
        const renderedStanza = placeStanza(stagedStanza, {
            leftOffset: ringLeft,
            topOffset: ringTop
        });
        renderedStanza._ringIndex = i;
        renderedStanza._ringData = ringData;
        seeded.push(renderedStanza);
        ringRecords.push({
            el: renderedStanza,
            left: ringLeft,
            top: ringTop,
        });
    }

    mourn.scrollZoneData.ring = {
        stanzas: seeded,
        records: ringRecords,
        cycleSize,
        centerStartIndex: activeIndex,
        centerEndIndex: activeIndex + cycleSize - 1,
    };

    if (!seeded[activeIndex]) {
        console.error('Failed to create active stanza for ring seed.');
        if (previousStartStanza) {
            mourn.trackers.startStanza = previousStartStanza;
        }
        return false;
    }

    mourn.trackers.startStanza = seeded[activeIndex];
    return true;
}

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setAnchorCenterOffsets() {
    const target = mourn.scrollStanza.currentScrollStanzaData && mourn.scrollStanza.currentScrollStanzaData.target
        ? mourn.scrollStanza.currentScrollStanzaData.target
        : mourn.trackers.startStanza;
    if (target && target._ringData) {
        mourn.scrollZoneData.anchorHalfWidth = target._ringData.width / 2;
        mourn.scrollZoneData.anchorHalfHeight = target._ringData.height / 2;
        return;
    }

    const targetBB = target.getBoundingClientRect();
    mourn.scrollZoneData.anchorHalfWidth = targetBB.width / 2;
    mourn.scrollZoneData.anchorHalfHeight = targetBB.height / 2;
}

function getCurrentTopActiveOffset(usedSlope = null) {
    const curSlope = usedSlope !== null ? usedSlope : mourn.trackers.slope;

    if (typeof mourn.scrollZoneData.anchorHalfHeight !== 'number') {
        setAnchorCenterOffsets();
    }

    const indexedVal = mourn.scrollStanza.currentScrollValue * curSlope * -1;
    return (
        (mourn.scrollStanza.currentScrollStanzaData.previousScrollOffset * mourn.scrollStanza.direction) +
        mourn.scrollStanza.currentScrollStanzaData.indexedOffset +
        mourn.scrollZoneData.anchorHalfHeight +
        indexedVal
    );
}

function applyScrollDelta(rawScrollDelta) {
    const maxScroll = rawScrollDelta * mourn.trackers.scrollSpeedMultiplier;

    mourn.scrollZoneData.total.x += maxScroll;
    mourn.scrollZoneData.total.y += maxScroll * mourn.trackers.slope;

    mourn.scrollStanza.currentScrollValue += maxScroll;
}

function retargetCurrentScrollStanza(targetStanza) {
    if (!targetStanza || !mourn.scrollStanza.currentScrollStanzaData) {
        return;
    }

    const previousTopOffset = getCurrentTopActiveOffset();
    const currentDirection = mourn.scrollStanza.direction;

    mourn.scrollStanza.currentScrollStanzaData.target = targetStanza;
    mourn.scrollStanza.currentScrollStanzaData.slope = parseFloat(targetStanza.dataset.slope);
    mourn.scrollStanza.currentScrollStanzaData.scrollWidth = parseFloat(targetStanza.dataset.scrollWidth);
    mourn.trackers.slope = mourn.scrollStanza.currentScrollStanzaData.slope;
    mourn.trackers.anchorStyle.setProperty('--slope', mourn.trackers.slope);
    mourn.scrollStanza.direction = currentDirection;

    const nextTopOffset = getCurrentTopActiveOffset();
    const offsetCorrection = previousTopOffset - nextTopOffset;
    mourn.scrollStanza.currentScrollStanzaData.indexedOffset += offsetCorrection;
}

function wrapCurrentStanzaToRingCenter() {
    if (!mourn.scrollZoneData.ring || !mourn.scrollStanza.currentScrollStanzaData) {
        return;
    }

    const ring = mourn.scrollZoneData.ring;
    const currentStanza = mourn.scrollStanza.currentScrollStanzaData.target;
    const currentIndex = currentStanza._ringIndex;
    if (typeof currentIndex !== 'number') {
        return;
    }

    if (currentIndex < ring.centerStartIndex) {
        const equivalentStanza = ring.stanzas[currentIndex + ring.cycleSize];
        if (equivalentStanza) {
            const currentRecord = ring.records[currentIndex];
            const equivalentRecord = ring.records[currentIndex + ring.cycleSize];
            retargetCurrentScrollStanza(equivalentStanza);
            shiftRingOffsets(
                currentRecord.left - equivalentRecord.left,
                currentRecord.top - equivalentRecord.top
            );
            perfMarkWrap('low');
        }
        return;
    }

    if (currentIndex > ring.centerEndIndex) {
        const equivalentStanza = ring.stanzas[currentIndex - ring.cycleSize];
        if (equivalentStanza) {
            const currentRecord = ring.records[currentIndex];
            const equivalentRecord = ring.records[currentIndex - ring.cycleSize];
            retargetCurrentScrollStanza(equivalentStanza);
            shiftRingOffsets(
                currentRecord.left - equivalentRecord.left,
                currentRecord.top - equivalentRecord.top
            );
            perfMarkWrap('high');
        }
    }
}

function stopAutoScroll() {
    if (autoScrollRafId !== null) {
        window.cancelAnimationFrame(autoScrollRafId);
    }
    autoScrollRafId = null;
    autoScrollPrevFrameTs = null;

    if (reducedMotionMediaQuery && reducedMotionListener) {
        reducedMotionMediaQuery.removeEventListener('change', reducedMotionListener);
    }
    reducedMotionListener = null;
    reducedMotionMediaQuery = null;

    if (refreshRingMetricsRafId !== null) {
        window.cancelAnimationFrame(refreshRingMetricsRafId);
        refreshRingMetricsRafId = null;
    }

    if (flowBoxesSyncRafId !== null) {
        window.cancelAnimationFrame(flowBoxesSyncRafId);
        flowBoxesSyncRafId = null;
    }
}

function startAutoScroll(speedMultiplier = 1) {
    stopAutoScroll();

    if (prefersReducedMotion()) {
        console.info('Auto-scroll skipped due to prefers-reduced-motion setting.');
        return;
    }

    if (!Number.isFinite(speedMultiplier) || speedMultiplier === 0) {
        return;
    }

    const basePixelsPerSecond = 120;
    const pixelsPerSecond = basePixelsPerSecond * speedMultiplier;
    reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionListener = function(event) {
        if (event.matches) {
            stopAutoScroll();
        }
    };
    reducedMotionMediaQuery.addEventListener('change', reducedMotionListener);

    const tick = (timestamp) => {
        if (autoScrollPrevFrameTs === null) {
            autoScrollPrevFrameTs = timestamp;
        }

        perfRecordFrame(timestamp, 'auto');

        const deltaMs = Math.min(timestamp - autoScrollPrevFrameTs, 50);
        autoScrollPrevFrameTs = timestamp;
        const deltaPx = pixelsPerSecond * (deltaMs / 1000);

        if (mourn.scrollZoneData.el && mourn.scrollStanza.currentScrollStanzaData) {
            applyScrollDelta(deltaPx);
            const stanzaChanged = checkStanzaScroll();
            if (stanzaChanged || isRingWrapCandidate()) {
                wrapCurrentStanzaToRingCenter();
            }
            setAnchorOffsets(null);
        }

        autoScrollRafId = window.requestAnimationFrame(tick);
    };

    autoScrollRafId = window.requestAnimationFrame(tick);
}

// Initialize the scroll zone and the current scroll stanza.
function scrollInit() {
    if(scrollDebug) {
        dbp('scrollInit()') 
    }

    initPerfProbe();
    createScrollZone();
    const ringSeeded = seedFixedCycleRing();
    if (!ringSeeded) {
        console.warn('Falling back to pre-ring start stanza due to seeding failure.');
    }
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
    setAnchorCenterOffsets();
    queueFlowFieldBoxSync();
    window.addEventListener('resize', queueRefreshRingMetrics);
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
    mourn.scrollZoneData.el.onscroll = queueScrollTick;
}

// Funtion to fire on every scroll event.
function scrollTick(timestamp = null) {
    if(scrollDebugV) {
        dbp('scrollTick()') 
    }

    perfRecordFrame(timestamp, 'manual');

    // Reset the scroll zone and track the distance scrolled.
    setScrollZone(

        // Multiply by 0.16 to put it in the center.
        mourn.scrollZoneData.dims.x * 0.16,
        mourn.scrollZoneData.dims.y * 0.16
    );

    // Check to see if we have changed stanzas.
    const stanzaChanged = checkStanzaScroll();
    if (stanzaChanged || isRingWrapCandidate()) {
        wrapCurrentStanzaToRingCenter();
    }

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
        const maxScroll = (leftPower > topPower ? left : top);
        applyScrollDelta(maxScroll);
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

    if (typeof mourn.scrollZoneData.anchorHalfWidth !== 'number' ||
        typeof mourn.scrollZoneData.anchorHalfHeight !== 'number') {
        setAnchorCenterOffsets();
    }
    const aBBWO = mourn.scrollZoneData.anchorHalfWidth;
    const aBBHO = mourn.scrollZoneData.anchorHalfHeight;

    // Set the left active offset css value.
    const snappedLeftOffset = snapOffset(mourn.scrollZoneData.total.x * -1 + aBBWO);
    mourn.trackers.anchorStyle.setProperty('--left-active-offset', snappedLeftOffset);
    if(scrollDebug) {
        dbp('');
        console.log('Previous scroll offset: ' + dbt(mourn.scrollStanza.currentScrollStanzaData.previousScrollOffset));
        console.log('Indexed offset: ' + dbt(mourn.scrollStanza.currentScrollStanzaData.indexedOffset));
        console.log('Direction: ' + dbt(mourn.scrollStanza.direction));
        console.log('Anchor bounding box height offset, or');
        console.log('aBBHO: ' + dbt(aBBHO));
        // console.log('Stanza indexed y val: ' + (indexedVal));
        dbp('','\u2508');
    }

    let newTopActiveOffset = snapOffset(getCurrentTopActiveOffset(curSlope));

    if(scrollDebug) {
        console.log('Active offset (rounded): ' + dbt(newTopActiveOffset));
        console.log('aBBHO: ' + dbt(aBBHO));
    }

    // mourn.trackers.anchorStyle.setProperty('--big-b', bigB);
    mourn.scrollStanza.currentTopActiveOffset = newTopActiveOffset;
    mourn.trackers.anchorStyle.setProperty('--top-active-offset', mourn.scrollStanza.currentTopActiveOffset);
    queueFlowFieldBoxSync();
}

function setCurrentScrollStanzaContinuous(nextStanza, direction) {
    if (!nextStanza) {
        return false;
    }

    const previousTopOffset = getCurrentTopActiveOffset();
    const stanzaWasSet = setCurrentScrollStanza(nextStanza);
    if (!stanzaWasSet) {
        return false;
    }
    mourn.scrollStanza.direction = direction;
    const nextTopOffset = getCurrentTopActiveOffset();
    const offsetCorrection = previousTopOffset - nextTopOffset;
    mourn.scrollStanza.currentScrollStanzaData.indexedOffset += offsetCorrection;
    return true;
}

// Sets what stanza is the current stanza.
function setCurrentScrollStanza(stanza, isFirst = false) {
    if(scrollDebugV) {
        dbp('setCurrentScrollStanza()') 
    }

    if(scrollDebug) {
        console.log('STANZA PASSED IN');
        console.log(stanza);
    }

    if (!stanza) {
        console.error('Cannot set current scroll stanza: stanza is null.');
        return false;
    }

    // Initialize a new object for a scroll stanza.
    // This should probably be an object with a constructor.
    const newCurrentScrollStanza = {};

    const meta = getStanzaScrollMeta(stanza);

    // And track some of its relevant data.
    newCurrentScrollStanza.target = stanza;
    newCurrentScrollStanza.slope = meta.slope;
    newCurrentScrollStanza.scrollWidth = meta.scrollWidth;

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
            newCurrentScrollValue = positiveModulo(normalizedValue, newCurrentScrollStanza.scrollWidth);
            newCurrentScrollStanza.previousScrollOffset = mourn.scrollZoneData.total.y;
            newCurrentScrollStanza.indexedOffset = meta.topOffset;
        }
        else {
            const previousScrollWidth = mourn.scrollStanza.currentScrollStanzaData.scrollWidth;
            const normalizedValue = mourn.scrollStanza.currentScrollValue + previousScrollWidth;
            newCurrentScrollValue = positiveModulo(normalizedValue, previousScrollWidth);
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

    return true;
}

// Check to see if we have changed stanzas.
function checkStanzaScroll() {
    if (!mourn.scrollStanza.currentScrollStanzaData) {
        return false;
    }

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
        let nextStanza = null;
        if (mourn.scrollZoneData.ring) {
            const ring = mourn.scrollZoneData.ring;
            const currentIndex = mourn.scrollStanza.currentScrollStanzaData.target._ringIndex;
            const nextIndex = positiveModulo(currentIndex + 1, ring.stanzas.length);
            nextStanza = ring.stanzas[nextIndex];
        }
        else {
            nextStanza = mourn.scrollStanza.currentScrollStanzaData.target.nextSibling;
        }

        // Set the current stanza.
        return setCurrentScrollStanzaContinuous(nextStanza, 1);
    }

    // Else if we have passed below the start of the current stanza...
    else if (mourn.scrollStanza.currentScrollValue < 0) {
        let previousStanza = null;
        if (mourn.scrollZoneData.ring) {
            const ring = mourn.scrollZoneData.ring;
            const currentIndex = mourn.scrollStanza.currentScrollStanzaData.target._ringIndex;
            const previousIndex = positiveModulo(currentIndex - 1, ring.stanzas.length);
            previousStanza = ring.stanzas[previousIndex];
        }
        else {
            previousStanza = mourn.scrollStanza.currentScrollStanzaData.target.previousSibling;
        }

        // Set the current stanza.
        return setCurrentScrollStanzaContinuous(previousStanza, -1);
    }

    return false;
}
function queueScrollTick() {
    if (scrollTickRafId !== null) {
        return;
    }

    scrollTickRafId = window.requestAnimationFrame((timestamp) => {
        scrollTickRafId = null;
        scrollTick(timestamp);
    });
}

function queueRefreshRingMetrics() {
    if (refreshRingMetricsRafId !== null) {
        return;
    }

    refreshRingMetricsRafId = window.requestAnimationFrame(() => {
        refreshRingMetricsRafId = null;
        refreshRingMetrics();
        setAnchorCenterOffsets();
        queueFlowFieldBoxSync();
    });
}

function queueFlowFieldBoxSync() {
    if (flowBoxesSyncRafId !== null) {
        return;
    }

    flowBoxesSyncRafId = window.requestAnimationFrame(() => {
        flowBoxesSyncRafId = null;
        syncFlowFieldBoxesFromPoem();
    });
}

function syncFlowFieldBoxesFromPoem() {
    if (typeof window.setFlowBoxes !== 'function') {
        return;
    }

    const stanzasToSync = getRenderedStanzas();
    stanzasToSync.sort((a, b) => {
        const aIdx = typeof a._ringIndex === 'number' ? a._ringIndex : 0;
        const bIdx = typeof b._ringIndex === 'number' ? b._ringIndex : 0;
        return aIdx - bIdx;
    });

    const viewportMargin = 240;
    const minX = 0 - viewportMargin;
    const minY = 0 - viewportMargin;
    const maxX = window.innerWidth + viewportMargin;
    const maxY = window.innerHeight + viewportMargin;

    const isNearViewport = (bb) => {
        return !(
            bb.right < minX ||
            bb.left > maxX ||
            bb.bottom < minY ||
            bb.top > maxY
        );
    };

    const flowBoxes = [];
    stanzasToSync.forEach((stanza) => {
        const stanzaBB = stanza.getBoundingClientRect();
        if (!isNearViewport(stanzaBB)) {
            return;
        }

        if (flowWordBoxesEnabled) {
            const wordSpans = stanza.querySelectorAll('.line > span:not(.terminator)');
            wordSpans.forEach((wordSpan) => {
                const word = wordSpan.textContent.trim();
                if (word.length === 0) {
                    return;
                }
                const bb = wordSpan.getBoundingClientRect();
                if (!isNearViewport(bb)) {
                    return;
                }
                const insetX = flowWordInsetXPx;
                const insetY = flowWordInsetYPx;
                const shrunkWidth = Math.max(1, bb.width - insetX * 2);
                const shrunkHeight = Math.max(1, bb.height - insetY * 2);
                flowBoxes.push({
                    x: bb.left + insetX,
                    y: bb.top + insetY,
                    w: shrunkWidth,
                    h: shrunkHeight,
                });
            });
        }
        else {
            flowBoxes.push({
                x: stanzaBB.left,
                y: stanzaBB.top,
                w: stanzaBB.width,
                h: stanzaBB.height,
            });
        }
    });

    window.setFlowBoxes(flowBoxes);
}
