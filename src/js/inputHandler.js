const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function isEditableTarget() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return !!el.isContentEditable;
}

function dispatchArrowScroll(key) {
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
        arrowScroll();
    }
    else if (key === 'ArrowDown' || key === 'ArrowRight') {
        arrowScroll(-1);
    }
}

async function arrowScroll(amount = 1) {
    const adjAmount = mourn.scrollZoneData.arrowKeyMult * amount;
    let delimiter = 1;
    if (adjAmount > mourn.scrollZoneData.maxScrollMs) {
        delimiter = adjAmount / mourn.scrollZoneData.maxScrollMs;
    }
    for(let i = 0; i < Math.abs(adjAmount); i += delimiter) {
        await delay(1);
        mourn.scrollZoneData.el.scrollBy({
            top: amount,
            left: amount,
            behavior: "auto",
        });
    }
}

const delay = ms => new Promise(res => setTimeout(res, ms));
var interval = {};

document.addEventListener('keydown', function(e) {
    if (!ARROW_KEYS.includes(e.key)) return;
    if (isEditableTarget()) return;

    // Must call preventDefault synchronously here — calling it later from a
    // setInterval callback has no effect.
    e.preventDefault();

    if (interval[e.key]) return;

    dispatchArrowScroll(e.key);
    interval[e.key] = setInterval(function() {
        dispatchArrowScroll(e.key);
    }, mourn.scrollZoneData.arrowScrollMSInterval);
});

document.addEventListener('keyup', function(e) {
    if (interval[e.key]) {
        clearInterval(interval[e.key]);
        interval[e.key] = null;
    }
});
