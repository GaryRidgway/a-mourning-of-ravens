function scrollInit() {
    createScrollZone();
    anchor.childNodes.forEach((stanza) => {
        const centerDot = document.createElement("div");
        centerDot.classList.add('center-dot');
        stanza.prepend(centerDot);
    });

    // const dots = anchor.querySelectorAll('.center-dot');
    // console.log(dots);

//     dots.forEach((dot, index) => {
//         if (index+1 !== dots.length) {
//             const startDot = dot.getBoundingClientRect();
//             const startDotOffsets = {
//                 left: startDot.left,
//                 top: startDot.top
//             }

//             const endDot = dots[index+1].getBoundingClientRect();
//             const endDotOffsets = {
//                 left: endDot.left,
//                 top: endDot.top
//             }
//             console.log(dot, dots[index+1])

//             const dotDiffs = {
//                 x: endDotOffsets.left - startDotOffsets.left,
//                 y: endDotOffsets.top - startDotOffsets.top
//             }

//             const viewBox = '0 0 ' + dotDiffs.x + ' ' + dotDiffs.y;
//             const svgContainer = document.createElement('div');
//             svgContainer.classList.add('svg-container');
//             svgContainer.style.width = dotDiffs.x + 'px';
//             console.log(dotDiffs.y);
//             svgContainer.style.height = dotDiffs.y + 'px';
//             svgContainer.innerHTML = '\
//             <svg xmlns="http://www.w3.org/2000/svg">\
//                 <line x1="0" y1="0" x2="'+dotDiffs.x+'" y2="'+dotDiffs.y+'" stroke="black"></line>\
//                 Sorry, your browser does not support inline SVG.\
//             </svg>';


//             // const dotLineSVG = document.createElement('svg');
//             // dotLineSVG.setAttribute('viewBox', '0 0 100 100');
//             // dotLineSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
//             // dotLineSVG.setAttribute('width', dotDiffs.x);
//             // dotLineSVG.setAttribute('height', dotDiffs.y);

//             // <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="
//             //     position: absolute;
//             //     width: 100px;
//             //     height: 100px;
//             //     left: 100px;
//             // "><line x1="0" y1="80" x2="100" y2="20" stroke="black"></line></svg>


//             // const dotLine = document.createElement('line');
//             // dotLine.setAttribute('x1', '0');
//             // dotLine.setAttribute('y1', '80');
//             // dotLine.setAttribute('x2', '100');
//             // dotLine.setAttribute('y2', '20');
//             // dotLine.setAttribute('stroke', 'black');

//             // dotLineSVG.append(dotLine);
//             // svgContainer.append(dotLineSVG);
//             dot.append(svgContainer);


// //   <line x1="0" y1="80" x2="100" y2="20" stroke="black" />

// //   <!-- If you do not specify the stroke
// //        color the line will not be visible -->

//         }
//     });
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
        scrollZoneData.dims.x * 0.16,
        scrollZoneData.dims.y * 0.16,
        false
    );

    scrollZoneData.el.onscroll = function (e) {
        setScrollZone(
            scrollZoneData.dims.x * 0.16,
            scrollZoneData.dims.y * 0.16
        );
        setAnchorOffsets();
        // console.log(
        //     '[' +
        //     scrollZoneData.total.x +
        //     ', ' +
        //     scrollZoneData.total.y +
        //     ']'
        // )
    }
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
    }
}

function setAnchorOffsets() {
    anchorStyle.setProperty('--left-main-offset', (scrollZoneData.total.x/slope) * scrollSpeedMultiplier);
    anchorStyle.setProperty('--top-main-offset', (scrollZoneData.total.y) * scrollSpeedMultiplier);
}