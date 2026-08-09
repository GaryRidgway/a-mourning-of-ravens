// Settings for the unattended "show" build. Loaded only by show/index.html.
//
// A note on the project's three-places rule: features normally need a control
// panel row, a URL param and a constants entry. This one deliberately gets only
// the constants entry, because the other two are precisely what it exists to
// remove — a runtime-adjustable, URL-addressable kill switch for the hardening
// would hand back every failure mode the hardening is there to prevent. Change
// these values here, in the file, and rebuild.
const SHOW_CONFIG = {
  // Block the one interaction that does not undo itself: pressing on a word
  // collider and dragging it. mousePressed is what sets draggedBoxIndex, so
  // swallowing just the press stops the drag at its source — mouse movement
  // still reaches the sketch, and the wake swirl that follows the cursor keeps
  // working. Left a word dragged out of register with its glyph, nothing but a
  // reload puts it back, which is what makes this worth blocking and scrolling
  // not worth blocking.
  lockColliderDrag: true,
  // Wheel, touch and arrow-key scrolling. Off by default: the poem auto-scrolls
  // and already handles being scrolled by hand — scrollFreezeDebounceMs and
  // scrollFreezeFadeInMs exist for exactly that — so a visitor who scrolls just
  // moves along the poem and the auto-scroll carries on. Nothing to recover
  // from, so there is nothing to protect against. Set true for a kiosk that
  // should be strictly hands-off.
  lockScroll: false,
  // Chord that toggles both locks off, for the operator. Deliberately awkward
  // to hit by accident.
  unlockChord: { ctrl: true, shift: true, alt: false, code: 'KeyU' },
  // Hide the mouse cursor after this many idle milliseconds. Idle-hide rather
  // than always-hidden so an operator can still find the pointer by moving it.
  // 0 disables hiding entirely.
  hideCursorAfterMs: 3000,
  // Ask the OS not to blank the display. Requires a secure context, so it works
  // over https or from localhost and silently does nothing over plain http from
  // another machine. Not a substitute for turning off the screensaver.
  keepScreenAwake: true,
  // Reload if the sketch stops advancing frames. p5's frameCount is the
  // heartbeat: it needs no hook into the draw loop, and it stops on exactly the
  // failures worth catching — a thrown exception that kills the loop, or a lost
  // canvas context. Checked only while the page is visible, since the sketch
  // intentionally stops itself when the tab is hidden.
  watchdog: true,
  watchdogCheckEveryMs: 5000,
  // How long frames may stall before it counts as dead. Generous, because a
  // long GC pause or a display mode change can legitimately freeze a frame or
  // two, and a needless reload is itself a visible failure.
  watchdogStallMs: 15000,
  // Give the sketch this long to draw its first frame before the watchdog is
  // allowed to fire. Fonts, the noise bake and 5000 particles all land here.
  watchdogGraceMs: 30000,
  // Stop reloading after this many attempts inside the window below. A page
  // that cannot survive startup will otherwise reload forever, which looks far
  // worse than one frozen frame and buries whatever the real error was.
  watchdogMaxReloads: 3,
  watchdogReloadWindowMs: 120000,
  // Whether this build reports to the visitor counter. On, because a QR code is
  // what points people here: this page, not the tuning page, is the one strangers
  // actually open, so it is the one whose opens are worth counting.
  //
  // The cost of that is the watchdog above. A reload it fires is indistinguishable
  // from a fresh visit, so a page that stalls repeatedly on someone's phone will
  // read as several people rather than one. Bounded by watchdogMaxReloads, so the
  // worst case is a handful of phantom opens and not a runaway count — but it is
  // the reason this number should be read as "roughly how many", never as a fact.
  //
  // Turn this off if the show build ever goes back to being a projector, where
  // the audience is the room and nothing about the page is worth counting.
  countVisits: true,
  // Unconditional periodic reload, in minutes. 0 = off. Only worth setting if a
  // soak test shows memory actually climbing over the run length; a reload is
  // visible to anyone watching, so it should be earned, not precautionary.
  scheduledReloadMinutes: 0,
};
