document.addEventListener('keydown', function(event) {
    checkKey(event);
});

function checkKey(e) {

    e = e || window.event;
    const arrowKeys = ['38', '40', '37', '39'];

    if (arrowKeys.includes(e.keyCode)) {
        e.preventDefault();
    }

    if (e.keyCode == '38') {
        // up arrow

        console.log('up');
    }
    else if (e.keyCode == '40') {
        // down arrow
        console.log('down');
    }
    else if (e.keyCode == '37') {
       // left arrow
        console.log('left');
    }
    else if (e.keyCode == '39') {
       // right arrow
        console.log('right');
    }

}