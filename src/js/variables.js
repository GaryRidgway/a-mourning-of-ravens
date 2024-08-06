mourn = {
    config: {

        // Const.
        stanzaCount : poem_json.length,
        poemStaging : document.getElementById("poem-staging"),
        poemContainer : document.getElementById("poem-container"),
        docStyle : document.documentElement.style,
        startInTopLeft : true,
    },

    debug : {

        // Const.
        on : false,
        verbose: false,
        stringLength : 30,
        includeScroll : true,
        includeHelpers : true,
        trimStringLength : 5,
    },

    trackers: {
        anchor : null,
        anchorStyle : null,
        startStanza : null,
        startStanzaSlope : null,
        nonRenderedConnectors : {},
        slope : 1,
        scrollSpeedMultiplier : 1.1,
    },

    staging : {
        widestStanza : 0,
        leastChars : 100000000000000,
        mostChars : 0,
        fullScrollWidth : 0,

        // Const.
        minScaling : 1.01,
        maxScaling : 2.2,
        mainScaling : 1.3
    },

    scrollZoneData : {
        container: null,
        el: null,
        buffer: null,
        lenience: 200,
        prevX: 0,
        prevY: 0,
        dims: {},
        total: {
            x: 0,
            y: 0
        },
        arrowKeyMult: 5,
        maxScrollMs: 100,
        arrowScrollMSInterval: 1
    },

    scrollStanza : {
        currentScrollValue : 0,
        currentScrollStanzaData : null,
        direction : 1,
        currentTopActiveOffset: 0,
    }
};