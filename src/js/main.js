document.addEventListener("DOMContentLoaded", function(event) { 
    // Lines
    // Stanzas
    // Connectors
    const poem_container = document.querySelector('.poem-container');
    const scrollbox = poem_container.querySelector('.scrollbox');
    const scroller = scrollbox.querySelector('.poem-scroller');
    const poem = document.getElementById("poem");
    const poemsEl = scrollbox.querySelector(".poems");
    const status = document.getElementById("status");
    const stanzas = poem.childElementCount;
    const rounding_precision = 3;
    const totalPoems = 2;
    let poems = 1;

    const rollingOffset = {
        x: 0,
        y: 0
    };
    const maxDims = {
        x: 0,
        y: 0,
        full_width: 0,
        full_height: 0
    };

    poemSetup(poem);

    for (let i = 0; i < stanzas; i++) {
        if (i < stanzas) {
            const stanza = poem.children[i];
            const stanzaBB = stanza.getBoundingClientRect();
            const connector = stanza.querySelector("line:last-child connector");
            const connectorBB = connector.getBoundingClientRect();

            const s1Top = stanzaBB.top;
            const connectorTop = connectorBB.top;
            const diffTop = connectorTop - s1Top;

            const stanzaLeft = stanzaBB.left;
            const connectorLeft = connectorBB.left;
            const diffLeft = connectorLeft - stanzaLeft;

            if (i + 1 !== stanzas) {
            const nextStanza = poem.children[i + 1];
            nextStanza.style.top = (rollingOffset.y + diffTop).toFixed(rounding_precision) + "px";
            nextStanza.style.left = (rollingOffset.x + diffLeft).toFixed(rounding_precision) + "px";
            }
            
            addRollingOffset(diffLeft, diffTop)

            maxDims.x = maxDims.x > stanzaBB.width ? maxDims.x : stanzaBB.width;
            maxDims.y = maxDims.y > stanzaBB.height ? maxDims.y : stanzaBB.height;
            maxDims.full_width = rollingOffset.x + stanzaBB.width;
            maxDims.full_height = rollingOffset.y + stanzaBB.height;
        }
    }

    // This is actually probably the poem dims.
    poem_container.style.setProperty("--box_height", Math.hypot(maxDims.x, maxDims.full_height) + 'px');
    viewport_hypot();


    // for (i=0; i < totalPoems-1; i++) {
    //     const new_poem = poem.cloneNode(true);
    //     poemsEl.appendChild( new_poem );
    //     poemSetup(new_poem);
    // }

    function reportWindowSize() {
        viewport_hypot();
    }

    function addRollingOffset(x, y) {
        rollingOffset.x += x;
        rollingOffset.y += y;
        poem_container.style.setProperty("--rolling-x",  rollingOffset.x + 'px');
        poem_container.style.setProperty("--rolling-y",  rollingOffset.y + 'px');
    }

    function viewport_hypot() {
        poem_container.style.setProperty("--viewport_hypot", Math.hypot(maxDims.x, window.innerHeight).toFixed(rounding_precision) + 'px');
        
        const angle = Math.atan(maxDims.full_height/maxDims.full_width);
        const adj_angle = angle + Math.PI/2 - Math.PI;
        const angle_height = window.innerHeight / Math.cos(Math.PI/2 - angle);
        const needed_height = (maxDims.x/Math.tan(Math.PI/2 - angle)) + maxDims.y;
        poem_container.style.setProperty("--box_width", needed_height.toFixed(rounding_precision) + 'px');
        
        const bonus_height = (maxDims.x/2) * Math.tan(adj_angle);
        
        poem_container.style.setProperty("--angle", adj_angle.toFixed(rounding_precision) + 'rad');
        poem_container.style.setProperty("--angle_height", (angle_height + -2*bonus_height).toFixed(rounding_precision) + 'px');
    }

    function poemSetup(element) {
        element.style.setProperty("--poem-no", poems);
        if(poems !== 1) {
            // element.style.position = 'absolute';
        }
        poems++;
    }

    window.onresize = reportWindowSize;

    scrollbox.addEventListener("scroll", (event) => {
        let inside = isInViewport(poem.children[0], poem_container);
        if (inside) {
            status.innerHTML = 'IN';
        }
        else {
            status.innerHTML = 'OUT';
        }
      });
});

// https://www.quora.com/How-do-I-find-out-if-an-element-in-a-browser-touches-another-element-in-JavaScript#:~:text=You%20can%20use%20the%20getBoundingClientRect()%20method%20in%20JavaScript%20to,element%20relative%20to%20the%20viewport.
function isInViewport(elem, container) {

	// Get the bounding box of the first element 
    const rect1 = elem.getBoundingClientRect(); 
    
    // Get the bounding box of the second element 
    const rect2 = container.getBoundingClientRect(); 
    
    // Check if the two elements overlap 
    const overlap = !(rect1.right < rect2.left ||  
                    rect1.left > rect2.right ||  
                    rect1.bottom < rect2.top ||  
                    rect1.top > rect2.bottom); 
    
    // Log the result 
    return overlap;
};