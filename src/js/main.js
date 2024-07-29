


// Ready code.
document.addEventListener("DOMContentLoaded", function () {
  
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

window.addEventListener("load", (event) => {
  document.fonts.ready
  .then(
    ()=>{
      window.requestAnimationFrame(function(){
        addStanzasToStaging(poem_json);
      window.requestAnimationFrame(function(){
        mourn.config.docStyle.setProperty('--stanza-width', (mourn.staging.widestStanza * mourn.staging.mainScaling) + 'px');
      window.requestAnimationFrame(function(){
        const startStanzaIndex = randomStanzaIndex();
        mourn.trackers.startStanza = fetchStagedStanza(startStanzaIndex);
        placeFirstStanza(mourn.trackers.startStanza);
      window.requestAnimationFrame(function(){
        pairSpaceAndScale();
      window.requestAnimationFrame(function(){
        setStanzaOffsets();
      // window.requestAnimationFrame(function(){
        // cascadeRender();
      // window.requestAnimationFrame(function(){
        // scrollInit();
      // window.requestAnimationFrame(function(){
      //   if(mourn.debug.on) {
      //     placePoemCenter();
      //   }
      // });
      // });
      // });
      });
      });
      });
      });
      });
    }
  )
});
