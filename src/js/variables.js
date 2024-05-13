// Variables.
const stanzaCount = poem_json.length;

const poemStaging = document.getElementById("poem-staging");
const poemContainer = document.getElementById("poem-container");
const docStyle = document.documentElement.style;
let widestStanza = 0;
let leastChars = 100000000000000;
let mostChars = 0;

const minSpacing = -1;
const maxSpacing = 2;

const minScaling = 1.01;
const maxScaling = 2.2;

const mainScaling = 1.3;

const defaultCascadeOptions = {
    flow: 0,
    iterationMax: null,
    estop: false
};

const defaultRenderOptions = {
    leftOffset: 0,
    topOffset: 0,
}

let anchorStanza;