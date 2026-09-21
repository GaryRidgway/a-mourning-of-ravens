const scrollDebug = mourn.debug.on && mourn.debug.includeScroll;
const scrollDebugV = mourn.debug.verbose && mourn.debug.includeScroll;
let autoScrollPrevFrameTs = null;
let autoScrollSpeedMultiplier = null;
let autoScrollPaused = false;
let reducedMotionListener = null;
let reducedMotionMediaQuery = null;
let scrollTickRafId = null;
let refreshRingMetricsRafId = null;
let flowBoxesSyncRafId = null;
let manualScrollDebounceId = null;
let isManualScrollActive = false;
let prevLeftActiveOffset = null;
// The anchor's current offsets, held here rather than read back out of CSS.
//
// These used to live as --left-active-offset / --top-active-offset on #anchor,
// with the stylesheet building the transform out of them. That is a nice way to
// express it and an expensive way to run it: a custom property INHERITS, so
// writing one on #anchor invalidates style for its whole subtree — 1155
// elements of stanzas, lines and word spans — every single scroll frame, to
// move one element that none of them read the value of.
//
// Measured on an emulated phone at 4x throttle, eight hard swipes:
//
//   custom properties   1.60s of recalc over 155 passes   10.3ms per pass
//   direct transform    0.26s of recalc over 268 passes    0.97ms per pass
//
// The direct arm ran MORE frames and still spent a sixth of the time. That
// 10ms a frame was the stutter on a long scroll: it does not show up in a JS
// profile, because it is not JS.
let currentLeftActiveOffset = 0;
let currentTopActiveOffsetPx = 0;
// Collider position cache — eliminates getBoundingClientRect from the per-frame sync.
// Populated once on init and on resize; the per-frame sync uses pure arithmetic.
let colliderAnchorBaseX = null;
let colliderAnchorBaseY = null;
let colliderCacheReady = false;
const MANUAL_SCROLL_DEBOUNCE_MS_FALLBACK = 300;
const glyphMeasureCanvas = document.createElement('canvas');
const glyphMeasureCtx = glyphMeasureCanvas.getContext('2d');
const flowParams = new URLSearchParams(window.location.search);
let flowCollidersEnabled = (() => {
    const raw = flowParams.get('enableWordColliders');
    if (raw === null) return true;
    return raw === '1';
})();
let flowWordBoxesEnabled = (() => {
    const raw = flowParams.get('wordBoxes');
    if (raw === null) return true;
    return raw === '1';
})();
let flowWordInsetXPx = (() => {
    const raw = flowParams.get('wordInsetX') ?? flowParams.get('wordInset');
    const parsed = raw === null ? 0 : parseFloat(raw);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
})();
let flowWordInsetYPx = (() => {
    const raw = flowParams.get('wordInsetY') ?? flowParams.get('wordInset');
    const parsed = raw === null ? 0 : parseFloat(raw);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
})();
let flowWordOffsetXPx = (() => {
    const raw = flowParams.get('wordOffsetX');
    const parsed = raw === null ? CONFIG.wordOffsetX : parseFloat(raw);
    if (!Number.isFinite(parsed)) return CONFIG.wordOffsetX;
    return parsed;
})();
let flowWordOffsetYPx = (() => {
    const raw = flowParams.get('wordOffsetY');
    const parsed = raw === null ? CONFIG.wordOffsetY : parseFloat(raw);
    if (!Number.isFinite(parsed)) return CONFIG.wordOffsetY;
    return parsed;
})();

window.__mournSetWordCollidersEnabled = function setWordCollidersEnabled(enabled) {
    flowCollidersEnabled = !!enabled;
    queueFlowFieldBoxSync();
};
window.__mournSetWordBoxes = function setWordBoxes(enabled) {
    flowWordBoxesEnabled = !!enabled;
    queueFlowFieldBoxSync();
};
window.__mournSetWordInsetPx = function setWordInsetPx(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordInsetXPx = parsed;
    flowWordInsetYPx = parsed;
    queueFlowFieldBoxSync();
};
window.__mournSetWordInsetXPx = function setWordInsetXPx(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordInsetXPx = parsed;
    queueFlowFieldBoxSync();
};
window.__mournSetWordInsetYPx = function setWordInsetYPx(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordInsetYPx = parsed;
    queueFlowFieldBoxSync();
};
window.__mournSetWordOffsetX = function setWordOffsetX(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordOffsetXPx = parsed;
    queueFlowFieldBoxSync();
};
window.__mournSetWordOffsetY = function setWordOffsetY(value) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return;
    }
    flowWordOffsetYPx = parsed;
    queueFlowFieldBoxSync();
};
window.__mournGetWordCollidersEnabled = function() { return flowCollidersEnabled; };
window.__mournGetWordBoxes = function() { return flowWordBoxesEnabled; };
window.__mournGetWordInsetXPx = function() { return flowWordInsetXPx; };
window.__mournGetWordInsetYPx = function() { return flowWordInsetYPx; };
window.__mournGetWordOffsetXPx = function() { return flowWordOffsetXPx; };
window.__mournGetWordOffsetYPx = function() { return flowWordOffsetYPx; };

window.__mournSetAutoScrollPaused = function setAutoScrollPaused(paused) {
    autoScrollPaused = !!paused;

    if (autoScrollPaused) {
        autoScrollPrevFrameTs = null;
        return;
    }

    // Restore speed so the next draw() tick picks it up.
    if (autoScrollSpeedMultiplier !== null && autoScrollPixelsPerSecond === 0) {
        autoScrollPixelsPerSecond = 120 * autoScrollSpeedMultiplier;
    }
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

// Rounding here only exists to keep the CSS custom property string short. What
// matters is the grid it creates relative to the step: at the shipped speed the
// poem advances about 0.27px a frame, so the old 0.1px grid was a third of the
// step and successive frames landed on 0.2, 0.3, 0.2 — measurably uneven motion
// bought for nothing. 0.001px is finer than the step by three orders of
// magnitude, still bounds the string, and takes the per-frame position error to
// zero. Counter-intuitively the old grid hurt FAST machines most: a higher
// frame rate means a smaller step against the same fixed grid.
function snapOffset(value, precision = 1000) {
    return Math.round(value * precision) / precision;
}

function getRenderedStanzas() {
    if (!mourn.trackers.anchor || !mourn.trackers.anchor.children) {
        return [];
    }
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

    // 50 stanzas move together here, which is why this is the one place the
    // cost of the old custom-property + left/top scheme actually showed as a
    // visible hitch. See setStanzaOffset in presenting.js.
    mourn.scrollZoneData.ring.records.forEach((record) => {
        record.left += deltaLeft;
        record.top += deltaTop;
        setStanzaOffset(record.el, record.left, record.top);
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
    autoScrollPrevFrameTs = null;
    autoScrollPixelsPerSecond = 0;

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

    autoScrollSpeedMultiplier = null;
}

let autoScrollPixelsPerSecond = 0;

function startAutoScroll(speedMultiplier = 1) {
    if (prefersReducedMotion()) {
        console.info('Auto-scroll skipped due to prefers-reduced-motion setting.');
        return;
    }

    if (!Number.isFinite(speedMultiplier) || speedMultiplier === 0) {
        return;
    }

    stopAutoScroll();
    autoScrollSpeedMultiplier = speedMultiplier;

    if (autoScrollPaused) {
        return;
    }

    const basePixelsPerSecond = 120;
    autoScrollPixelsPerSecond = basePixelsPerSecond * speedMultiplier;

    reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionListener = function(event) {
        if (event.matches) {
            stopAutoScroll();
        }
    };
    reducedMotionMediaQuery.addEventListener('change', reducedMotionListener);
    // No rAF loop — auto-scroll is driven by p5's draw() via tickAutoScroll().
}

// A frame delta the auto-scroll should not believe. See the note on
// CONFIG.autoScrollDeltaCapMultiple for why this is a multiple of the local
// frame time rather than a constant.
const AUTO_SCROLL_DELTA_WINDOW = 30;
// Never cap below this. A 120Hz machine has an 8ms median, and four of those is
// tighter than a single dropped frame — the floor keeps an ordinary hitch on a
// fast machine from being treated as a stall.
const AUTO_SCROLL_DELTA_CAP_FLOOR_MS = 50;
const autoScrollRecentDeltas = [];
let autoScrollDeltaSampleCount = 0;
let autoScrollDeltaCapMs = AUTO_SCROLL_DELTA_CAP_FLOOR_MS;

function updateAutoScrollDeltaCap(rawDeltaMs) {
    // A zero delta is the first frame after a pause, not a measurement.
    if (!(rawDeltaMs > 0)) {
        return;
    }

    autoScrollRecentDeltas[autoScrollDeltaSampleCount % AUTO_SCROLL_DELTA_WINDOW] = rawDeltaMs;
    autoScrollDeltaSampleCount += 1;

    // Wait for a full window: a median of three frames taken during startup
    // would set the cap from the least representative frames of the session.
    if (autoScrollRecentDeltas.length < AUTO_SCROLL_DELTA_WINDOW) {
        return;
    }

    // Recomputed on a duty cycle rather than every frame. Sorting 30 numbers is
    // cheap but not free, and the median of a 30-frame window cannot move fast
    // enough for a 15-frame refresh to miss anything.
    if (autoScrollDeltaSampleCount % 15 !== 0) {
        return;
    }

    // Median, not mean, and that is the whole trick: the outliers this is meant
    // to catch are exactly the samples that would drag a mean up and widen the
    // cap to let the next one through.
    const sorted = autoScrollRecentDeltas.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    autoScrollDeltaCapMs = Math.max(
        AUTO_SCROLL_DELTA_CAP_FLOOR_MS,
        median * CONFIG.autoScrollDeltaCapMultiple
    );
}

// Called once per frame from p5's draw(). Runs the auto-scroll delta in the
// same rAF callback as the particle sim, eliminating scheduling jitter.
window.__mournTickAutoScroll = function tickAutoScroll(nowMs) {
    if (autoScrollPaused || autoScrollSpeedMultiplier === null || autoScrollPixelsPerSecond === 0) {
        return;
    }

    if (autoScrollPrevFrameTs === null) {
        autoScrollPrevFrameTs = nowMs;
    }

    perfRecordFrame(nowMs, 'auto');

    const rawDeltaMs = nowMs - autoScrollPrevFrameTs;
    updateAutoScrollDeltaCap(rawDeltaMs);
    const deltaMs = Math.min(rawDeltaMs, autoScrollDeltaCapMs);
    autoScrollPrevFrameTs = nowMs;
    const deltaPx = autoScrollPixelsPerSecond * (deltaMs / 1000);

    if (mourn.scrollZoneData.el && mourn.scrollStanza.currentScrollStanzaData) {
        applyScrollDelta(deltaPx);
        const stanzaChanged = checkStanzaScroll();
        if (stanzaChanged || isRingWrapCandidate()) {
            wrapCurrentStanzaToRingCenter();
        }
        setAnchorOffsets(null);
    }
};

// Initialize the scroll zone and the current scroll stanza.
function scrollInit() {
    if(scrollDebug) {
        dbp('scrollInit()') 
    }

    initPerfProbe();
    createScrollZone();
    initTouchScroll();
    if (typeof initPinchZoom === 'function') initPinchZoom();
    const ringSeeded = seedFixedCycleRing();
    if (!ringSeeded) {
        console.warn('Falling back to pre-ring start stanza due to seeding failure.');
    }
    // Phase 2, item 5: remove staging area from layout after ring seeding.
    // All stanza measurements are captured in data-* attributes and _ringData;
    // fetchStagedStanza only needs cloneNode(true) which works on hidden elements.
    mourn.config.poemStaging.style.display = 'none';
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
    cacheColliderPositions();
    queueFlowFieldBoxSync();
    window.addEventListener('resize', () => {
        // The collider cache is rebuilt below from getBoundingClientRect, which
        // reports post-transform rects — so a live pinch scale would be baked
        // into the cache and then applied a second time by the sync. Drop the
        // zoom back to 1 first; a resize on a phone is a rotation, where
        // re-centring the poem is wanted anyway.
        if (typeof window.__mournResetPoemZoom === 'function') window.__mournResetPoemZoom();
        invalidateGlyphRectCache();
        colliderCacheReady = false;
        queueRefreshRingMetrics();
        // Re-cache after ring metrics refresh gives layout time to settle.
        requestAnimationFrame(() => {
            cacheColliderPositions();
            // Re-centre the scroll box against the new geometry. Doing this only
            // inside scrollTick would deadlock: a rotation that shrinks an axis
            // leaves the box pinned to that axis's wall, and a gesture into the
            // wall produces no scroll event at all — so the handler that would
            // free it never runs. false because putting the box back is not the
            // reader scrolling, and counting it would jump the poem on rotate.
            const rest = getScrollZoneRestPosition();
            setScrollZone(rest.x, rest.y, false);
        });
    });
}

// Where the scroll zone parks between gestures.
//
// The poem is driven by the DISTANCE the box travels, not by where it ends up,
// so the box has to be re-centred after every event or it runs out of room.
// That makes the rest point the whole ballgame: whatever headroom it leaves on
// each side is how far a single gesture can be read before the browser clamps
// and the delta silently comes back short.
//
// This used to be 0.16 of a scrollWidth/scrollHeight measured ONCE at startup.
// Two things were wrong with it. The cached measurement went stale the moment
// the viewport changed — rotate a phone and the rest point is still computed
// from the portrait geometry, which lands it past the end of the shorter axis,
// where the browser pins it to the wall and one scroll direction stops working
// outright. And 0.16 of the buffer is about 72% of the way along the usable
// range even when the measurement IS current, so the two directions never had
// equal room to begin with.
//
// Measured live and centred fixes both. On a 1512x738 desktop this moves the
// rest point 363 -> 350, which is nothing; on a rotated phone it moves it off
// the wall, which is everything.
function getScrollZoneRestPosition() {
    const el = mourn.scrollZoneData.el;
    return {
        x: (el.scrollWidth - el.clientWidth) / 2,
        y: (el.scrollHeight - el.clientHeight) / 2,
    };
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
    applyScrollBufferSize();

    // Set the scroll zone's position, but don't track the initial movement as a scroll.
    const rest = getScrollZoneRestPosition();
    setScrollZone(rest.x, rest.y, false);

    // Add the scroll listener to the scroll zone.
    mourn.scrollZoneData.el.onscroll = queueScrollTick;
}

// Funtion to fire on every scroll event.
function scrollTick(timestamp = null) {
    if(scrollDebugV) {
        dbp('scrollTick()')
    }

    // Writing scrollLeft/scrollTop makes the browser fire a scroll event, and
    // that event is indistinguishable from the reader's — so every re-centre
    // this code performs comes back around as a gesture it did not make. Left
    // unhandled that is expensive: measured, six viewport-height changes with
    // no input at all ran this function six times, faded the manual-scroll
    // state in and out six times, paused and resumed the auto-scroll twelve
    // times, and teleported the poem 39 px. A phone's URL bar shows and hides
    // while you swipe, so this fires constantly and reads as jumpiness.
    //
    // They are easy to tell apart. A real gesture IS the box having moved off
    // where it was parked — that is the entire input mechanism. Still sitting
    // exactly where it was put means this event is our own echo.
    if (mourn.scrollZoneData.el.scrollLeft === mourn.scrollZoneData.parkedX &&
        mourn.scrollZoneData.el.scrollTop === mourn.scrollZoneData.parkedY) {
        return;
    }

    perfRecordFrame(timestamp, 'manual');

    // Reset the scroll zone and track the distance scrolled. Measured fresh
    // rather than cached: this runs after the viewport may have changed, and a
    // stale rest point is what pinned an axis to the wall.
    const rest = getScrollZoneRestPosition();
    setScrollZone(rest.x, rest.y);

    afterScrollDelta();
}

// Everything that has to happen once a scroll delta has landed in the totals,
// regardless of which input produced it. Split out of scrollTick when the touch
// path arrived: a finger reaches applyScrollDelta directly and never touches
// the scroll box, but it needs the identical stanza check, ring wrap, anchor
// write and manual-scroll bookkeeping afterwards.
function afterScrollDelta() {
    // Check to see if we have changed stanzas.
    const stanzaChanged = checkStanzaScroll();
    if (stanzaChanged || isRingWrapCandidate()) {
        wrapCurrentStanzaToRingCenter();
    }

    if (!isManualScrollActive) {
        isManualScrollActive = true;
        // Pause auto-scroll so manual and auto deltas don't combine.
        if (autoScrollSpeedMultiplier !== null) {
            window.__mournSetAutoScrollPaused(true);
        }
        if (typeof window.onManualScrollStart === 'function') {
            window.onManualScrollStart();
        }
    }

    setAnchorOffsets(null);
    clearTimeout(manualScrollDebounceId);
    const debounceMs = typeof window.getScrollFreezeDebounceMs === 'function'
        ? window.getScrollFreezeDebounceMs()
        : MANUAL_SCROLL_DEBOUNCE_MS_FALLBACK;
    manualScrollDebounceId = setTimeout(() => {
        isManualScrollActive = false;
        if (typeof window.onManualScrollEnd === 'function') {
            window.onManualScrollEnd();
        }
        // Resume auto-scroll after manual scroll ends.
        if (autoScrollSpeedMultiplier !== null) {
            window.__mournSetAutoScrollPaused(false);
        }
    }, debounceMs);
}

// Size the buffer, and re-centre the box against the size it now has.
//
// This is the ceiling on a single scroll event, so it is the difference between
// a hard flick scrolling far and a hard flick stopping dead against the wall.
// See CONFIG.scrollBufferViewports for the measurements.
function applyScrollBufferSize() {
    const buffer = mourn.scrollZoneData.buffer;
    if (!buffer) return;
    const viewports = Number(CONFIG.scrollBufferViewports);
    const size = (Number.isFinite(viewports) && viewports > 0 ? viewports : 1.5) * 100;
    // Written twice on purpose, vw/vh then dvw/dvh. A CSSOM setter validates
    // what it is given and silently no-ops on a unit the browser does not know,
    // so on iOS below 15.4 the first assignment is what survives and on anything
    // newer the second one replaces it. Same fallback as the stylesheets, and
    // the stylesheet value cannot cover for a failure here because it is dvw too.
    buffer.style.width = size + 'vw';
    buffer.style.width = size + 'dvw';
    buffer.style.height = size + 'vh';
    buffer.style.height = size + 'dvh';
    // The rest point is derived from the scrollable range, so it moved.
    const rest = getScrollZoneRestPosition();
    setScrollZone(rest.x, rest.y, false);
}
window.applyScrollBufferSize = applyScrollBufferSize;

// Turn the box's two-axis movement into the poem's one scroll value.
//
// This used to be `|left| > |top| ? left : top` — take whichever axis moved
// further, discard the other outright. Down and right both advance the poem, so
// on a diagonal that throws away real travel: measured on the wheel, a 45-degree
// gesture landed 67% of what the same distance delivered along an axis. It also
// left the anti-diagonal unstable, because which axis "wins" can change between
// events and flip the sign with it — that direction measured anywhere from 26%
// to 75% across runs.
//
// Enlarging the scroll buffer made this worse rather than better, which is why
// it is fixed here and not left alone: with more headroom each event carries
// more of BOTH axes, so the axis being discarded is a bigger loss than it was.
//
// The fix keeps the direction of the plain sum but restores the gesture's true
// length, so a diagonal is worth its actual distance instead of twice it:
//
//   vertical    104% -> 104%    (identical; the wheel feel does not change)
//   horizontal   96% ->  96%    (identical)
//   diagonal down-right  67% ->  96%
//   diagonal up-right    erratic -> 4%, predictably
//
// That last row is the deliberate trade. Up-and-right is the one genuinely
// ambiguous direction — rightward asks to go forward, upward asks to go back —
// and it now answers close to zero every time instead of a different number
// every time. A consistent nothing beats an unpredictable something.
function combineScrollAxes(left, top) {
    const l1 = Math.abs(left) + Math.abs(top);
    if (l1 === 0) return 0;
    return ((left + top) / l1) * Math.hypot(left, top);
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

    // Where the box actually came to rest, which is not always where it was
    // sent — the browser clamps to the scrollable range. Read back rather than
    // assumed, because this is what scrollTick compares against to tell the
    // reader's gesture from the echo of this very write.
    mourn.scrollZoneData.parkedX = mourn.scrollZoneData.el.scrollLeft;
    mourn.scrollZoneData.parkedY = mourn.scrollZoneData.el.scrollTop;

    // If we want to track the total scrolling...
    if (addToTotal) {
        const left = mourn.scrollZoneData.prevX - mourn.scrollZoneData.el.scrollLeft;
        const top = mourn.scrollZoneData.prevY - mourn.scrollZoneData.el.scrollTop;
        applyScrollDelta(combineScrollAxes(left, top));
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
    currentLeftActiveOffset = snappedLeftOffset;
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
    // Signal the screen-space scroll delta to frozen particles.
    if (isManualScrollActive && prevLeftActiveOffset !== null && typeof window.applyManualScrollDelta === 'function') {
        const prevTop = mourn.scrollStanza.currentTopActiveOffset || 0;
        const deltaX = snappedLeftOffset - prevLeftActiveOffset;
        const deltaY = newTopActiveOffset - prevTop;
        window.applyManualScrollDelta(deltaX, deltaY);
    }
    prevLeftActiveOffset = snappedLeftOffset;
    mourn.scrollStanza.currentTopActiveOffset = newTopActiveOffset;
    currentTopActiveOffsetPx = newTopActiveOffset;
    // transform is not an inherited property, so this invalidates #anchor and
    // nothing below it. See currentLeftActiveOffset for the measurements.
    mourn.trackers.anchorStyle.transform =
        'translate3d(' + snappedLeftOffset + 'px,' + newTopActiveOffset + 'px,0)';
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
// ---------------------------------------------------------------------------
// Touch input — read the finger, not the scroll box.
//
// The hidden scroll box is a good input device for a wheel, which arrives as
// many small discrete deltas, and a bad one for a finger. Two limits fall out
// of re-centring the box after every event:
//
//   1. A gesture cap. No single scroll event can report more travel than the
//      box has room for, which on a 390px phone is 62.5px across and 176px
//      down. Everything past that is clamped away in silence.
//   2. Events arrive on the main thread, so the capture rate is the sim's
//      frame rate. A busy phone delivers two or three events for a whole
//      swipe, not twenty.
//
// Measured on an emulated iPhone 14 at 24fps: a 300px swipe arrived as ONE
// 193.6px step and landed between 15% and 105% of its distance depending on
// speed and axis. The poem's velocity does not track the finger's, and that
// non-proportionality is what a reader sees as jumping.
//
// pointermove already carries the displacement, so none of that indirection is
// needed. This reads it straight and hands it to the same applyScrollDelta the
// box path uses. With touch-action: none the browser stops scrolling the box
// on touch, so the two paths never both fire; wheel and keys are untouched.
// ---------------------------------------------------------------------------

let touchPointerId = null;
let touchLastX = 0;
let touchLastY = 0;
let touchLastMoveTs = 0;
let touchVelocity = 0;
let touchInertiaRafId = null;
let touchPendingDelta = 0;
let touchCommitRafId = null;
let touchListenersBound = false;

// How a two-axis finger becomes the poem's one-dimensional scroll value.
//
// setScrollZone takes whichever raw axis moved further and throws the other
// away. That is what costs a diagonal swipe its distance — measured on desktop
// at 61fps, with no clipping involved at all, a 45-degree swipe landed 55-80%
// of what the same travel delivered along an axis. Every finger swipe is
// diagonal to some degree, so the touch path cannot afford it.
//
// Both axes therefore contribute, but NOT equally, and not by the geometry
// either. Three formulations were measured on an emulated phone, 300px swipes
// in all eight directions:
//
//   dx + dy (equal authority). Cardinals land 101-109%, which matches the box
//     path exactly. But down-right overshoots to 152% and up-right collapses to
//     4% — it sits on the null line, so one of the most natural swipes on a
//     phone does nothing at all. Rejected on that measurement.
//
//   Projection onto the poem's travel direction, (dx + dy*slope)/(1+slope^2).
//     Geometrically honest and never cancels in any common direction, but the
//     stanzas run at slopes of 0.20-0.30 — a shallow, nearly horizontal
//     diagonal — so a vertical swipe weighs about 0.23. That is roughly four
//     times weaker than today for the one gesture phone readers reach for
//     first. Right for the geometry, wrong for the hand.
//
//   Per-axis weights, dx + dy*w, which is what ships. Horizontal stays exact at
//     1:1, vertical keeps whatever authority w grants it, and the null moves off
//     to dx = -w*dy where no cardinal or 45-degree gesture lands. Nothing
//     cancels and nothing overshoots.
//
// w is touchVerticalWeight, and it is a feel judgement rather than a derivable
// number, which is why it is on the panel: 1 restores equal authority and the
// 45-degree null with it, and the stanza slope restores the pure projection.
//
// The result is NEGATED, which is not cosmetic and was got wrong first time.
// The box path does not measure the gesture; it measures setScrollZone's
// prev - current, which is how far the box travelled back toward its rest
// point, and that is the negation of how far the gesture pushed it out. A raw
// finger delta therefore arrives with the opposite sign to the value this
// poem has always been driven by. Measured on the same synthesized gesture,
// reading the finger directly rather than trusting a tool's axis convention:
// finger right 315px gives the box path -307 and, unnegated, this path +442.
function touchDeltaFromPointer(dx, dy) {
    let delta = -(dx + dy * CONFIG.touchVerticalWeight) * CONFIG.touchScrollGain;
    // Compensate for pinch zoom. The poem is driven in its own coordinates, so a
    // fixed finger delta advances a fixed amount of POEM — but the glyphs are
    // scaled, so on screen the words crawl when zoomed out (they move by
    // delta x zoom). Dividing the delta by the zoom makes the words track the
    // finger 1:1 at any size, which reads as "faster when zoomed out": the same
    // swipe now covers more of the poem the smaller the type is. Fed here rather
    // than in applyScrollDelta so the inertia glide, which is measured off this
    // same delta, is compensated too. min is 0.4, so the divide is always safe.
    if (CONFIG.enablePinchZoomScrollComp) {
        const zoom = window.__mournPoemZoom && window.__mournPoemZoom.scale;
        if (zoom > 0) delta /= zoom;
    }
    return delta;
}

function stopTouchInertia() {
    if (touchInertiaRafId !== null) {
        window.cancelAnimationFrame(touchInertiaRafId);
        touchInertiaRafId = null;
    }
}

// Reading the finger at full rate and ACTING on it at full rate are different
// things, and conflating them is what made the first version of this stutter.
//
// What hangs off a committed delta is not cheap: setAnchorOffsets reaches
// window.applyManualScrollDelta, which walks every particle in the sketch to
// drag the frozen ones along with the poem. That is fine once a frame. It is
// not fine once per pointermove — a digitizer runs at 60-120Hz against a sim
// that may be drawing at 24, and when the main thread falls behind the queued
// moves arrive in a burst, so several full particle passes land back to back
// on a thread that was already late. The box path never had this problem
// because queueScrollTick coalesced it into one rAF; bypassing the box dropped
// that coalescing on the floor along with everything else.
//
// So the finger is still read at full resolution — every coalesced sample is
// summed, nothing is thrown away — and the accumulated total is spent once per
// frame. Distance is preserved exactly; only the redundant work is gone.
function flushTouchDelta() {
    const delta = touchPendingDelta;
    touchPendingDelta = 0;
    if (delta === 0) return;
    applyScrollDelta(delta);
    afterScrollDelta();
}

function queueTouchCommit() {
    if (touchCommitRafId !== null) return;
    touchCommitRafId = window.requestAnimationFrame(() => {
        touchCommitRafId = null;
        flushTouchDelta();
    });
}

function startTouchInertia() {
    stopTouchInertia();
    if (!CONFIG.enableTouchInertia) return;
    if (Math.abs(touchVelocity) < CONFIG.touchInertiaMinSpeed) return;

    let prevTs = null;
    const step = (ts) => {
        if (prevTs === null) prevTs = ts;
        // A long frame must not launch the poem across a stanza. Same reasoning
        // as autoScrollDeltaCapMultiple, and the same failure it guards.
        const dt = Math.min(ts - prevTs, 64);
        prevTs = ts;

        // Expressed per 16.67ms so the glide lasts the same wall-clock time on
        // a 120Hz phone as on one struggling at 24.
        touchVelocity *= Math.pow(CONFIG.touchInertiaDecay, dt / 16.667);

        if (Math.abs(touchVelocity) < CONFIG.touchInertiaMinSpeed) {
            touchInertiaRafId = null;
            return;
        }

        // Already inside a rAF, so this spends the delta now rather than
        // queueing a second frame to do it.
        touchPendingDelta += touchVelocity * dt;
        flushTouchDelta();
        touchInertiaRafId = window.requestAnimationFrame(step);
    };
    touchInertiaRafId = window.requestAnimationFrame(step);
}

function onTouchPointerDown(event) {
    if (!CONFIG.enableTouchScroll) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    // One finger drives the poem. A second landing mid-gesture would otherwise
    // fight the first, and a pinch would read as an enormous swipe.
    if (touchPointerId !== null) return;

    stopTouchInertia();
    touchPointerId = event.pointerId;
    touchLastX = event.clientX;
    touchLastY = event.clientY;
    touchLastMoveTs = event.timeStamp;
    touchVelocity = 0;

    // Capture so a finger that slides off the scroll zone — onto the controls,
    // or past the edge of the glass — keeps feeding this handler rather than
    // silently ending the gesture wherever it crossed.
    try { event.target.setPointerCapture(event.pointerId); } catch {}
}

function onTouchPointerMove(event) {
    if (touchPointerId !== event.pointerId) return;
    // A second finger down means a pinch is in progress; the first finger's
    // travel must not also scroll the poem, or the zoom fights a swipe. Keep the
    // baseline current while we sit out, so that when the pinch ends and this
    // finger takes over again it measures from where it is, not from a jump.
    if (window.__mournPinchActive) {
        touchLastX = event.clientX;
        touchLastY = event.clientY;
        touchLastMoveTs = event.timeStamp;
        touchVelocity = 0;
        return;
    }

    // A 120Hz digitizer feeding a 30fps render loop delivers four samples per
    // frame and the browser hands over only the last one unless asked. The
    // other three are real finger travel; dropping them is the same distance
    // loss the box path was already guilty of.
    const samples = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : null;
    const points = (samples && samples.length) ? samples : [event];

    let total = 0;
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const delta = touchDeltaFromPointer(point.clientX - touchLastX, point.clientY - touchLastY);
        const dt = point.timeStamp - touchLastMoveTs;
        touchLastX = point.clientX;
        touchLastY = point.clientY;
        touchLastMoveTs = point.timeStamp;
        total += delta;

        // Velocity for the glide, smoothed over the last few samples so one
        // jittery reading near lift-off does not decide the whole throw.
        if (dt > 0) {
            const instant = delta / dt;
            touchVelocity = touchVelocity * 0.7 + instant * 0.3;
        }
    }

    if (total !== 0) {
        touchPendingDelta += total;
        queueTouchCommit();
    }
}

function onTouchPointerUp(event) {
    if (touchPointerId !== event.pointerId) return;
    touchPointerId = null;
    try { event.target.releasePointerCapture(event.pointerId); } catch {}

    // Digitizers occasionally report one absurd sample as contact breaks.
    const cap = CONFIG.touchInertiaMaxSpeed;
    if (touchVelocity > cap) touchVelocity = cap;
    else if (touchVelocity < -cap) touchVelocity = -cap;

    startTouchInertia();
}

function onTouchPointerCancel(event) {
    if (touchPointerId !== event.pointerId) return;
    touchPointerId = null;
    // Cancelled is not released: the system took the gesture away (a call, a
    // system edge swipe), which is not a throw and should not glide.
    touchVelocity = 0;
    stopTouchInertia();
}

// iOS turns a swipe that begins at the screen edge into back/forward
// navigation. touch-action does not reach that gesture: it governs scrolling and
// zoom, one layer below the browser's own chrome, so the box can be locked down
// completely and the page will still be navigated away from underneath it.
//
// The collision is not incidental. A finger moving right takes the poem
// backward — touchDeltaFromPointer negates, and setAnchorOffsets writes
// -total.x — so the gesture iOS claims from the left edge is precisely the one a
// reader makes to go back over a stanza. The right edge is the mirror case and
// only bites once they have already gone back at least once.
//
// preventDefault on touchstart, for a touch that starts inside the gutter, is
// the only lever there is. It is undocumented WebKit behaviour rather than an
// API, Apple has narrowed it before, and it cannot be verified anywhere but on a
// real iPhone. Hence a control and not a constant: widen it if a swipe still
// escapes, set it to 0 if cancelling touchstart costs more than it saves.
//
// Read live from CONFIG rather than cached, so the panel and the URL param take
// effect without rebinding. pointerdown fires before touchstart, so cancelling
// here costs the pointer path nothing — onTouchPointerDown has already run and
// the gesture is live by the time this is reached.
function onTouchEdgeGuard(event) {
    const gutter = Number(CONFIG.touchEdgeGuardPx);
    if (!(gutter > 0)) return;
    const viewportWidth = window.innerWidth;
    const touches = event.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const x = touches[i].clientX;
        if (x <= gutter || x >= viewportWidth - gutter) {
            if (event.cancelable) event.preventDefault();
            return;
        }
    }
}

// touch-action is what stops the browser scrolling the box under our feet, so
// it has to track the toggle rather than being set once in the stylesheet.
// Called at init and from the control panel.
function applyTouchScrollMode() {
    const el = mourn.scrollZoneData.el;
    if (!el) return;
    el.style.touchAction = CONFIG.enableTouchScroll ? 'none' : '';
    if (!CONFIG.enableTouchScroll) {
        touchPointerId = null;
        touchVelocity = 0;
        touchPendingDelta = 0;
        if (touchCommitRafId !== null) {
            window.cancelAnimationFrame(touchCommitRafId);
            touchCommitRafId = null;
        }
        stopTouchInertia();
    }
}
window.applyTouchScrollMode = applyTouchScrollMode;

function initTouchScroll() {
    const el = mourn.scrollZoneData.el;
    if (!el || touchListenersBound) return;
    touchListenersBound = true;
    // Non-passive on move: with touch-action none there is nothing left to
    // cancel, but leaving the option open costs nothing and a browser that
    // ignores touch-action still needs the preventDefault.
    el.addEventListener('pointerdown', onTouchPointerDown, { passive: true });
    el.addEventListener('pointermove', onTouchPointerMove, { passive: false });
    el.addEventListener('pointerup', onTouchPointerUp, { passive: true });
    el.addEventListener('pointercancel', onTouchPointerCancel, { passive: true });
    // Bound regardless of what enableTouchScroll says, and non-passive because
    // a passive listener's preventDefault is ignored. The navigation gesture
    // takes the page away from the box path just as readily as from this one,
    // so the guard is about the browser rather than about which input path is
    // in force; touchEdgeGuardPx set to 0 is what turns it off.
    el.addEventListener('touchstart', onTouchEdgeGuard, { passive: false });
    applyTouchScrollMode();
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

// Build the collider position cache. Reads the DOM once (forced layout) so that
// the per-frame syncFlowFieldBoxesFromPoem can compute positions arithmetically.
// Called once after ring seeding and again on resize.
function cacheColliderPositions() {
    colliderCacheReady = false;
    const ring = mourn.scrollZoneData.ring;
    if (!ring || !mourn.trackers.anchor) return;

    // One getBoundingClientRect on the anchor to establish the base position.
    const anchorBB = mourn.trackers.anchor.getBoundingClientRect();
    // Base position = screen position minus the current transform offsets.
    colliderAnchorBaseX = anchorBB.left - currentLeftActiveOffset;
    colliderAnchorBaseY = anchorBB.top - currentTopActiveOffsetPx;

    // Cache each stanza's word positions relative to the stanza's top-left corner.
    for (let i = 0; i < ring.stanzas.length; i++) {
        const stanza = ring.stanzas[i];
        const stanzaBB = stanza.getBoundingClientRect();
        const stanzaW = stanza._ringData ? stanza._ringData.width : stanzaBB.width;
        const stanzaH = stanza._ringData ? stanza._ringData.height : stanzaBB.height;
        const words = [];

        const wordSpans = stanza.querySelectorAll('.line > span:not(.terminator)');
        for (let j = 0; j < wordSpans.length; j++) {
            const span = wordSpans[j];
            if (span.textContent.trim().length === 0) continue;
            const glyphBB = getWordGlyphRect(span);
            words.push({
                relX: glyphBB.left - stanzaBB.left,
                relY: glyphBB.top - stanzaBB.top,
                w: glyphBB.width,
                h: glyphBB.height,
            });
        }

        stanza._colliderCache = { words, width: stanzaW, height: stanzaH };
    }

    colliderCacheReady = true;
}

function syncFlowFieldBoxesFromPoem() {
    if (typeof window.setFlowBoxes !== 'function') return;
    if (!mourn.trackers.anchor) return;
    if (!flowCollidersEnabled) {
        window.setFlowBoxes([]);
        return;
    }

    const ring = mourn.scrollZoneData.ring;
    if (!ring || !colliderCacheReady) return;

    // The values JS already set, straight from the variables holding them.
    const anchorX = colliderAnchorBaseX + currentLeftActiveOffset;
    const anchorY = colliderAnchorBaseY + currentTopActiveOffsetPx;

    const viewportMargin = 240;
    const minX = -viewportMargin;
    const minY = -viewportMargin;
    const maxX = window.innerWidth + viewportMargin;
    const maxY = window.innerHeight + viewportMargin;

    const flowBoxes = [];
    for (let i = 0; i < ring.records.length; i++) {
        const record = ring.records[i];
        const stanza = ring.stanzas[i];
        const cache = stanza._colliderCache;
        if (!cache) continue;

        const stanzaX = anchorX + record.left;
        const stanzaY = anchorY + record.top;

        // Viewport-cull the whole stanza.
        if (stanzaX + cache.width < minX || stanzaX > maxX ||
            stanzaY + cache.height < minY || stanzaY > maxY) {
            continue;
        }

        if (flowWordBoxesEnabled && cache.words.length > 0) {
            for (let w = 0; w < cache.words.length; w++) {
                const word = cache.words[w];
                const wordX = stanzaX + word.relX;
                const wordY = stanzaY + word.relY;

                if (wordX + word.w < minX || wordX > maxX ||
                    wordY + word.h < minY || wordY > maxY) {
                    continue;
                }

                const insetX = flowWordInsetXPx >= 0
                    ? Math.min(flowWordInsetXPx, Math.max(0, (word.w - 1) * 0.5))
                    : flowWordInsetXPx;
                const insetY = flowWordInsetYPx >= 0
                    ? Math.min(flowWordInsetYPx, Math.max(0, (word.h - 1) * 0.5))
                    : flowWordInsetYPx;

                flowBoxes.push({
                    x: wordX + insetX + flowWordOffsetXPx,
                    y: wordY + insetY + flowWordOffsetYPx,
                    w: Math.max(1, word.w - insetX * 2),
                    h: Math.max(1, word.h - insetY * 2),
                });
            }
        } else {
            flowBoxes.push({
                x: stanzaX,
                y: stanzaY,
                w: cache.width,
                h: cache.height,
            });
        }
    }

    // Pinch zoom is a composited affine on the #poem-zoom wrapper, which the
    // cached collider positions know nothing about — they were measured at scale
    // 1. Re-applying the identical transform to every box here keeps the ink
    // glued to the words at any zoom without re-measuring the DOM. The wrapper
    // maps a local point P (viewport coords minus the container origin) to
    // S*P + T, so a box at screen (x,y) renders at origin + S*(x - origin) + T.
    // Must match #poem-zoom's translate(tx,ty) scale(S) exactly — see
    // window.__mournPoemZoom. Culling above ran on the untransformed positions,
    // which is safe: a zoom only pushes off-screen boxes further off.
    const zoom = window.__mournPoemZoom;
    if (zoom && (zoom.scale !== 1 || zoom.tx !== 0 || zoom.ty !== 0)) {
        const s = zoom.scale;
        const ox = zoom.originX;
        const oy = zoom.originY;
        const tx = zoom.tx;
        const ty = zoom.ty;
        for (let i = 0; i < flowBoxes.length; i++) {
            const b = flowBoxes[i];
            b.x = ox + (b.x - ox) * s + tx;
            b.y = oy + (b.y - oy) * s + ty;
            b.w *= s;
            b.h *= s;
        }
    }

    window.setFlowBoxes(flowBoxes);
}

function invalidateGlyphRectCache() {
    if (!mourn.trackers.anchor) return;
    const stanzas = mourn.trackers.anchor.querySelectorAll('.stanza');
    for (let i = 0; i < stanzas.length; i++) {
        delete stanzas[i]._colliderCache;
        const spans = stanzas[i].querySelectorAll('.line > span:not(.terminator)');
        for (let j = 0; j < spans.length; j++) {
            delete spans[j]._glyphCache;
        }
    }
    colliderCacheReady = false;
}

function getWordGlyphRect(wordSpan) {
    const spanBB = wordSpan.getBoundingClientRect();

    // If we have a cached measurement, apply it to the current span position.
    if (wordSpan._glyphCache) {
        const c = wordSpan._glyphCache;
        const left = spanBB.left + c.offsetLeft;
        const top = spanBB.top + c.offsetTop;
        return {
            left: left,
            top: top,
            right: left + c.width,
            bottom: top + c.height,
            width: c.width,
            height: c.height,
            x: left,
            y: top,
        };
    }

    // No cache — do the expensive measurement once and store offsets relative to spanBB.
    const textNode = wordSpan.firstChild;
    const text = textNode?.textContent ?? wordSpan.textContent;
    if (!text || text.trim().length === 0) {
        return spanBB;
    }

    if (textNode?.nodeType === Node.TEXT_NODE && glyphMeasureCtx) {
        const punctuationPattern = /[\s'"`,.;:!?()[\]{}\-]/;
        const computed = window.getComputedStyle(wordSpan);
        glyphMeasureCtx.font = buildCanvasFont(computed);
        let minLeft = Infinity;
        let minTop = Infinity;
        let maxRight = -Infinity;
        let maxBottom = -Infinity;
        let foundGlyph = false;

        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if (punctuationPattern.test(char)) {
                continue;
            }
            const range = document.createRange();
            range.setStart(textNode, index);
            range.setEnd(textNode, index + 1);
            const charBB = range.getBoundingClientRect();
            const metrics = glyphMeasureCtx.measureText(char);
            const metricsWidth = (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0);
            const metricsHeight = (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0);
            if (
                Number.isFinite(charBB.width) &&
                Number.isFinite(charBB.height) &&
                charBB.width > 0 &&
                charBB.height > 0 &&
                Number.isFinite(metricsWidth) &&
                Number.isFinite(metricsHeight) &&
                metricsWidth > 0 &&
                metricsHeight > 0
            ) {
                const glyphLeft = charBB.left + Math.max(0, (charBB.width - metricsWidth) * 0.5);
                const glyphTop = charBB.top + Math.max(0, (charBB.height - metricsHeight) * 0.5);
                minLeft = Math.min(minLeft, glyphLeft);
                minTop = Math.min(minTop, glyphTop);
                maxRight = Math.max(maxRight, glyphLeft + metricsWidth);
                maxBottom = Math.max(maxBottom, glyphTop + metricsHeight);
                foundGlyph = true;
            }
        }

        if (foundGlyph) {
            const glyphWidth = maxRight - minLeft;
            const glyphHeight = maxBottom - minTop;
            // Cache offsets relative to span's bounding box
            wordSpan._glyphCache = {
                offsetLeft: minLeft - spanBB.left,
                offsetTop: minTop - spanBB.top,
                width: glyphWidth,
                height: glyphHeight,
            };
            return {
                left: minLeft,
                top: minTop,
                right: maxRight,
                bottom: maxBottom,
                width: glyphWidth,
                height: glyphHeight,
                x: minLeft,
                y: minTop,
            };
        }
    }

    const range = document.createRange();
    range.selectNodeContents(wordSpan);
    const glyphBB = range.getBoundingClientRect();

    if (
        Number.isFinite(glyphBB.width) &&
        Number.isFinite(glyphBB.height) &&
        glyphBB.width > 0 &&
        glyphBB.height > 0
    ) {
        // Cache the range-based fallback too
        wordSpan._glyphCache = {
            offsetLeft: glyphBB.left - spanBB.left,
            offsetTop: glyphBB.top - spanBB.top,
            width: glyphBB.width,
            height: glyphBB.height,
        };
        return glyphBB;
    }

    return spanBB;
}

function buildCanvasFont(computed) {
    if (computed.font && computed.font !== '') {
        return computed.font;
    }
    const style = computed.fontStyle || 'normal';
    const variant = computed.fontVariant || 'normal';
    const weight = computed.fontWeight || '400';
    const stretch = computed.fontStretch && computed.fontStretch !== 'normal'
        ? `${computed.fontStretch} `
        : '';
    const size = computed.fontSize || '16px';
    const family = computed.fontFamily || 'serif';
    return `${style} ${variant} ${weight} ${stretch}${size} ${family}`;
}
