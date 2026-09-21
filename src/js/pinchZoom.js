// Pinch to zoom — a two-finger gesture that scales the poem's type live on a
// touch screen. See CONFIG.enablePinchZoom for why this is a composited CSS
// transform on #poem-container rather than a font-size change: the sizes and
// every measurement downstream of them are baked once at load, and re-deriving
// them per frame is a teardown-and-rebuild that cannot be made smooth. A scale
// can.
//
// Three things move together so the picture stays coherent:
//
//   1. The CSS transform on #poem-container scales the glyphs about a focal
//      point fixed at the gesture's start.
//   2. syncFlowFieldBoxesFromPoem re-applies the SAME focal-point scale to the
//      collider boxes it hands the flow field, so the ink stays glued to the
//      words at any zoom without the DOM being re-measured.
//   3. The particles near the words are frozen for the gesture, exactly as they
//      are during a scroll, and scaled about the focal point each frame so they
//      ride the words instead of being smeared by the fast-moving boxes.
//
// The zoom is a visual multiplier on top of whatever mobilePoemScale already
// did: 1 is the loaded size, below 1 is zoomed out (the ask), above 1 is in.

// The single source of truth the collider sync reads. Kept on window because it
// is the boundary between this file and scroll.js's per-frame box sync.
//
// The zoom is a general affine — scale S and a translation (tx,ty) in the
// container's own coordinates — NOT a single scale-about-one-focal. It has to
// be, because a reader zooms about one point, scrolls, then zooms about another:
// each pinch multiplies the scale about its own focal ON TOP of whatever the
// last one left, and only an accumulated transform stays continuous across that.
// A screen point P (in container-local coords) renders at S*P + (tx,ty).
window.__mournPoemZoom = { scale: 1, tx: 0, ty: 0, originX: 0, originY: 0 };
window.__mournPinchActive = false;

(function () {
    // The element the scale is written to. NOT #poem-container: that clips
    // (overflow:hidden) and holds the invisible #scroll-zone, so scaling it
    // shrank the input surface and cropped the poem to a sub-box. #poem-zoom
    // wraps only #anchor — the text — so the clip and the input stay at full
    // viewport size and only the glyphs scale. Created once, lazily, because
    // #anchor does not exist until placeFirstStanza has run.
    let zoomEl = null;

    function ensureZoomWrapper() {
        if (zoomEl) return zoomEl;
        const anchor = mourn.trackers && mourn.trackers.anchor;
        if (!anchor || !anchor.parentNode) return null;
        zoomEl = document.createElement('div');
        zoomEl.id = 'poem-zoom';
        // Overlay #poem-container exactly, clip nothing, catch no touches — the
        // scroll zone above it owns input. transform-origin 0 0 lets the focal
        // point be carried entirely in the translate, matching the collider
        // sync's mapping.
        zoomEl.style.position = 'absolute';
        zoomEl.style.top = '0';
        zoomEl.style.left = '0';
        zoomEl.style.right = '0';
        zoomEl.style.bottom = '0';
        zoomEl.style.transformOrigin = '0 0';
        zoomEl.style.pointerEvents = 'none';
        zoomEl.style.willChange = 'transform';
        // #poem-container used to centre #anchor with flex; pulling #anchor into
        // this absolute wrapper took it out of that flow. The wrapper spans the
        // same full viewport, so reproducing the exact centring here restores
        // the poem's position — and because the wrapper still starts at the
        // container's own origin, the focal-point maths stays unchanged.
        zoomEl.style.display = 'flex';
        zoomEl.style.alignItems = 'center';
        zoomEl.style.justifyContent = 'center';
        anchor.parentNode.insertBefore(zoomEl, anchor);
        zoomEl.appendChild(anchor);
        return zoomEl;
    }

    // Live gesture state.
    const activePointers = new Map(); // pointerId -> { x, y }
    let pinching = false;
    let startDistance = 0;
    let scaleAtPinchStart = 1;
    // The accumulated transform: scale, plus a translation in container-local
    // coordinates. These persist across gestures — a scroll leaves them alone,
    // and the next pinch composes onto them.
    let currentScale = 1;
    let transX = 0;
    let transY = 0;
    let focalX = 0; // viewport px, fixed for the current gesture
    let focalY = 0;
    let containerLeft = 0; // #poem-container origin, for the CSS transform
    let containerTop = 0;

    function poemZoomEnabled() {
        return !!CONFIG.enablePinchZoom;
    }

    function clampScale(s) {
        const lo = Number.isFinite(CONFIG.pinchZoomMin) ? CONFIG.pinchZoomMin : 0.4;
        const hi = Number.isFinite(CONFIG.pinchZoomMax) ? CONFIG.pinchZoomMax : 1.5;
        return Math.min(hi, Math.max(lo, s));
    }

    // The CSS transform. transform-origin is 0 0, so translate(tx,ty) scale(S)
    // maps a local point P to S*P + (tx,ty) — the exact affine the collider sync
    // re-applies to keep the ink glued to the words. tx/ty are already in the
    // container's local coordinates, so nothing is derived from a single focal
    // here; the focal only enters when a gesture composes onto tx/ty.
    function applyTransform() {
        const target = zoomEl || ensureZoomWrapper();
        if (!target) return;
        if (currentScale === 1 && transX === 0 && transY === 0) {
            target.style.transform = '';
            return;
        }
        target.style.transform =
            'translate(' + transX + 'px,' + transY + 'px) scale(' + currentScale + ')';
    }

    function publishZoom() {
        const z = window.__mournPoemZoom;
        z.scale = currentScale;
        z.tx = transX;
        z.ty = transY;
        z.originX = containerLeft;
        z.originY = containerTop;
        if (typeof queueFlowFieldBoxSync === 'function') queueFlowFieldBoxSync();
    }

    // Drop back to the loaded size and clear the transform. Called on resize
    // (the collider cache is about to be rebuilt from post-transform rects, so
    // the scale has to be gone first) and whenever a gesture lands back at 1.
    window.__mournResetPoemZoom = function resetPoemZoom() {
        currentScale = 1;
        transX = 0;
        transY = 0;
        applyTransform();
        publishZoom();
    };

    function twoPointerState() {
        const pts = [];
        activePointers.forEach((p) => pts.push(p));
        return pts;
    }

    function distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.hypot(dx, dy);
    }

    function beginPinch() {
        const pts = twoPointerState();
        if (pts.length < 2) return;
        pinching = true;
        window.__mournPinchActive = true;
        startDistance = distance(pts[0], pts[1]) || 1;
        // Compose onto the transform already in place. Crucially this does NOT
        // rewrite it from the new focal — that was the cross-gesture jump: with a
        // scale already accumulated, moving the focal shifted the translate by
        // (Fnew - Fold)*(1 - scale). Starting from the current scale and letting
        // the first frame's ratio be ~1 keeps the poem exactly where the scroll
        // left it.
        scaleAtPinchStart = currentScale;
        // Zoom about the viewport centre, NOT the finger midpoint. Anchoring to
        // the fingers keeps that point fixed and shrinks the poem toward it, so
        // an off-centre pinch shifts the poem — and since each gesture adds that
        // shift with no free pan to undo it (this piece only scrolls along its
        // own diagonal), repeated zooms walk the poem off screen. About the
        // centre the translation is always centre*(1 - scale): bounded, and
        // exactly zero at 1x, so the poem stays put and only its size changes.
        focalX = window.innerWidth / 2;
        focalY = window.innerHeight / 2;
        const container = mourn.config.poemContainer;
        const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
        containerLeft = rect.left;
        containerTop = rect.top;
        if (typeof window.onPinchStart === 'function') window.onPinchStart();
    }

    function updatePinch() {
        const pts = twoPointerState();
        if (pts.length < 2) return;
        const dist = distance(pts[0], pts[1]) || 1;
        const target = clampScale(scaleAtPinchStart * (dist / startDistance));
        const ratio = target / currentScale;
        if (ratio === 1) return;
        // Compose a scale-by-ratio about the focal onto the current affine:
        //   P -> ratio*(S*P + T) + Flocal*(1 - ratio)
        // so S' = ratio*S and T' = ratio*T + Flocal*(1 - ratio). This is what
        // makes zoom-scroll-zoom continuous — each pinch builds on the last.
        const focalLocalX = focalX - containerLeft;
        const focalLocalY = focalY - containerTop;
        transX = ratio * transX + focalLocalX * (1 - ratio);
        transY = ratio * transY + focalLocalY * (1 - ratio);
        currentScale = target;
        applyTransform();
        if (typeof window.applyPinchScaleDelta === 'function') {
            window.applyPinchScaleDelta(focalX, focalY, ratio);
        }
        publishZoom();
    }

    function endPinch() {
        if (!pinching) return;
        pinching = false;
        window.__mournPinchActive = false;
        if (typeof window.onPinchEnd === 'function') window.onPinchEnd();
        publishZoom();
    }

    function onPointerDown(event) {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        if (!poemZoomEnabled()) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activePointers.size === 2 && !pinching) beginPinch();
    }

    function onPointerMove(event) {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinching) updatePinch();
    }

    function onPointerUpOrCancel(event) {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.delete(event.pointerId);
        if (pinching && activePointers.size < 2) endPinch();
    }

    // The live zoom level is a display-side interaction, like the scroll
    // position, and deliberately does NOT ride the URL: only edits made in the
    // debug panel write to the query string. The pinch's tunable state — enable,
    // min, max and the scroll compensation — is what belongs in the URL, and it
    // gets there through the ordinary CONTROL_PARAM_DEFS sync when those controls
    // are changed. So the gesture never touches the URL, and a reload starts the
    // reader back at the loaded size.

    // Bound once from scrollInit, after the scroll zone exists. The scroll zone
    // is the element that already owns touch-action:none and the reader's
    // pointers, so the pinch listens there too. passive is fine: preventing the
    // default is the scroll path's job, and it already does with touch-action.
    window.initPinchZoom = function initPinchZoom() {
        const el = mourn.scrollZoneData.el;
        if (!el) return;
        ensureZoomWrapper();
        el.addEventListener('pointerdown', onPointerDown, { passive: true });
        el.addEventListener('pointermove', onPointerMove, { passive: true });
        el.addEventListener('pointerup', onPointerUpOrCancel, { passive: true });
        el.addEventListener('pointercancel', onPointerUpOrCancel, { passive: true });
    };
})();
