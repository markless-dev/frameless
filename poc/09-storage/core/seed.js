// Emulates the COMPILER-DERIVED seed artifact: given the statically known
// set of storage cells, produce the sync inline script that reads the driver
// pre-paint, patches root attributes, and leaves the landing slot for the
// runtime (any framework) to consume.

export function seedScriptFor(cells) {
  const cfg = JSON.stringify(cells.map((c) => ({ key: c.key, fallback: c.fallback })));
  return (
    "(function(){var cells=" +
    cfg +
    ';var slot={};for(var i=0;i<cells.length;i++){var c=cells[i],v;try{v=localStorage.getItem(c.key)}catch(e){v=null}if(v===null)v=c.fallback;slot[c.key]=v;document.documentElement.setAttribute("data-"+c.key,v)}window.__FRAMELESS_STATE__=slot})()'
  );
}
