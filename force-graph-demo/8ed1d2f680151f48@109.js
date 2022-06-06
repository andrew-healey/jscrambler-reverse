// https://observablehq.com/@d3/modifying-a-force-directed-graph@109
function _1(md){return(
md`# Modifying a Force-Directed Graph

This notebook demonstrates how to update a live [force-directed graph](/@d3/force-directed-graph). We use [*selection*.join](/@d3/selection-join) with a key function to add and remove elements as the graph changes; and we update the simulation’s nodes and links before restarting.`
)}

function _graph(html,graph1,graph2,graph3,invalidation)
{
  const form = html`<form style="font: 12px var(--sans-serif); display: flex; height: 33px; align-items: center;">
  <label style="margin-right: 1em; display: inline-flex; align-items: center;">
    <input type="radio" name="radio" value="1" style="margin-right: 0.5em;" checked> Graph 1
  </label>
  <label style="margin-right: 1em; display: inline-flex; align-items: center;">
    <input type="radio" name="radio" value="2" style="margin-right: 0.5em;"> Graph 2
  </label>
  <label style="margin-right: 1em; display: inline-flex; align-items: center;">
    <input type="radio" name="radio" value="3" style="margin-right: 0.5em;"> Graph 3
  </label>
</form>`;
  const graphs = {1: graph1, 2: graph2, 3: graph3};
  const timeout = setInterval(() => {
    form.value = graphs[form.radio.value = (+form.radio.value) % 3 + 1];
    form.dispatchEvent(new CustomEvent("input"));
  }, 2000);
  form.onchange = () => form.dispatchEvent(new CustomEvent("input")); // Safari
  form.oninput = event => { 
    if (event.isTrusted) clearInterval(timeout), form.onchange = null;
    form.value = graphs[form.radio.value];
  };
  form.value = graphs[form.radio.value];
  invalidation.then(() => clearInterval(timeout));
  return form;
}


function _chart(d3,width,height,invalidation,color)
{
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height]);

  const simulation = d3.forceSimulation()
      .force("charge", d3.forceManyBody().strength(-1000))
      .force("link", d3.forceLink().id(d => d.id).distance(200))
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .on("tick", ticked);

  let link = svg.append("g")
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
    .selectAll("line");

  let node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll("circle");

  function ticked() {
    node.attr("cx", d => d.x)
        .attr("cy", d => d.y)

    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
  }

  // Terminate the force layout when this cell re-runs.
  invalidation.then(() => simulation.stop());

  return Object.assign(svg.node(), {
    update({nodes, links}) {

      // Make a shallow copy to protect against mutation, while
      // recycling old nodes to preserve position and velocity.
      const old = new Map(node.data().map(d => [d.id, d]));
      nodes = nodes.map(d => Object.assign(old.get(d.id) || {}, d));
      links = links.map(d => Object.assign({}, d));

      simulation.nodes(nodes);
      simulation.force("link").links(links);
      simulation.alpha(1).restart();

      node = node
        .data(nodes, d => d.id)
        .join(enter => enter.append("circle")
          .attr("r", 8)
          .attr("fill", d => color(d.id)));

      link = link
        .data(links, d => `${d.source.id}\t${d.target.id}`)
        .join("line");
    }
  });
}


function _update(chart,graph){return(
chart.update(graph)
)}

function _graph1(){return(
{
  nodes: [
    {id: "a"},
    {id: "b"},
    {id: "c"}
  ],
  links: []
}
)}

function _graph2(){return(
{
  nodes: [
    {id: "a"},
    {id: "b"},
    {id: "c"}
  ],
  links: [
    {source: "a", target: "b"},
    {source: "b", target: "c"},
    {source: "c", target: "a"}
  ]
}
)}

function _graph3(){return(
{
  nodes: [
    {id: "a"},
    {id: "b"}
  ],
  links: [
    {source: "a", target: "b"}
  ]
}
)}

function _color(d3){return(
d3.scaleOrdinal(d3.schemeTableau10)
)}

function _height(){return(
400
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof graph")).define("viewof graph", ["html","graph1","graph2","graph3","invalidation"], _graph);
  main.variable(observer("graph")).define("graph", ["Generators", "viewof graph"], (G, _) => G.input(_));
  main.variable(observer("chart")).define("chart", ["d3","width","height","invalidation","color"], _chart);
  main.variable(observer("update")).define("update", ["chart","graph"], _update);
  main.variable(observer("graph1")).define("graph1", _graph1);
  main.variable(observer("graph2")).define("graph2", _graph2);
  main.variable(observer("graph3")).define("graph3", _graph3);
  main.variable(observer("color")).define("color", ["d3"], _color);
  main.variable(observer("height")).define("height", _height);
  return main;
}
