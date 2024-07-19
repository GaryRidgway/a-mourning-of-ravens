


// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  // window.requestAnimationFrame(function(){
  //   console.log(1);
  // }).then(
  //   () =>{
  //     window.requestAnimationFrame(function(){
  //       console.log(2);
  //     });
  //   }
  // );
  document.fonts.ready.then(
    ()=>{
      // const styleEl= document.createElement("style");
      // styleEl.innerHTML = '#poem-container, #poem-staging {font-family: Cinzel;}';
      // document.querySelector('head').append(styleEl);
    }
  ).then(
    addStanzasToStaging(poem_json)
  )
  .then(()=>{
    mourn.staging.widestStanza = getWidestStanza(mourn.config.poemStaging).width;
    pairSpaceAndScale();
  }).then(
    setStanzaOffsets()
  ).then(()=>{
    mourn.config.docStyle.setProperty('--stanza-width', (mourn.staging.widestStanza * mourn.staging.mainScaling) + 'px');
  }).then(()=>{
    const startStanzaIndex = randomStanzaIndex();
    mourn.trackers.startStanza = fetchStagedStanza(startStanzaIndex);
    placeFirstStanza(mourn.trackers.startStanza);
  }).then(()=>{
    cascadeRender();
  }).then(()=>{
    scrollInit();
  }).then(()=>{
    if(mourn.debug.on) {
      placePoemCenter();
    }
  })
});

var animation1 = function(){
  return new Promise(function(resolve) {
    var t = 0;
    var runAnimation = function(){
        if (t < endValue) {
            t++; 
            // do animation stuff
            requestAnimationFrame(runAnimation)
        }
        else{resolve()}
    };

    runAnimation();
 });
}