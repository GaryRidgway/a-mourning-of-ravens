// document.addEventListener('keydown', function(event) {
//     checkKey(event);
// });

function checkKey(e) {

    e = e || window.event;
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

    if (arrowKeys.includes(e.key)) {
        e.preventDefault();
    }

    if (e.key === 'ArrowUp') {
        // up arrow
        // console.log('ArrowUp');
        // console.log(e.type);
        if(e.type === 'keydown') {
            arrowScroll();
        }
    }
    else if (e.key === 'ArrowDown') {
        arrowScroll(-1);
    }
    else if (e.key === 'ArrowLeft') {
        arrowScroll();
    }
    else if (e.key === 'ArrowRight') {
        arrowScroll(-1);
    }

}

async function arrowScroll(amount = 1) {
    const adjAmount = mourn.scrollZoneData.arrowKeyMult * amount;
    console.log(adjAmount)
    let delimiter = 1;
    if (adjAmount > mourn.scrollZoneData.maxScrollMs) {
        delimiter = adjAmount / mourn.scrollZoneData.maxScrollMs;
    }
    for(let i = 0; i < Math.abs(adjAmount); i += delimiter) {
        console.log('frame');
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

function keyToggle(e) {
    if(!interval[e.key]) {
        interval[e.key] = setInterval(function() {
            checkKey(e);
        }, mourn.scrollZoneData.arrowScrollMSInterval);
    }
}

document.addEventListener('keydown', function(e) {
    if(!interval[e.key]) {
        console.log('keydown');
        interval[e.key] = setInterval(function() {
            checkKey(e);
        }, mourn.scrollZoneData.arrowScrollMSInterval);
    }
});

document.addEventListener('keyup', function(e) {
    console.log('keyup');
    clearInterval(interval[e.key]); 
    console.log('clearing interval');
    interval[e.key] = null;
});