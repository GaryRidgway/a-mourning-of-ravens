// Variables.
const stanzaCount = poem_json.length;

const poemStaging = document.getElementById("poem-staging");
const poemContainer = document.getElementById("poem-container");
const docStyle = document.documentElement.style;
let widestStanza = 0;
let leastChars = 100000000000000;
let mostChars = 0;
let fullScrollWidth = 0;

const minSpacing = -1;
const maxSpacing = 2;

const minScaling = 1.01;
const maxScaling = 2.2;

const mainScaling = 1.3;

const defaultRenderOptions = {
    leftOffset: 0,
    topOffset: 0,
}

let anchor;
let anchorStyle;
let startStanza;
let startStanzaSlope;
let startScrollPos;
let nonRenderedConnectors = {};

const scrollZoneData = {
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
    }
};

let slope = 1;
const scrollSpeedMultiplier = 0.2;

// Debug.
const debug = false;
const debugV = false;
const debugIncludeScroll = true;
const debugIncludeHelpers = true;
const debugStringLength = 30;
const debugTrimStringLength = 5;


// Scroll stanza variables.
let currentScrollStanzaIndex;
let currentScrollValue = 0;
// let currentScrollOffset = 0;
let currentScrollStanzaData;
let direction = 1;
let currentTopActiveOffset = 0;
let prevTopActiveOffset = 0;
let calcOffset = 0;
const startInTopLeft = true;

let scrollOffset = null;