window.onload = async () => {
  const { cases, edges, steps } = await (await fetch("graph.json")).json();

  let currStep = 0;

  const svg = d3.select("svg");

  const width = 960;
  const height = 500;

  let nodesArray, linksArray;

  const makeArrays = () => {
    nodesArray = cases.map((oneCase) => ({
      id: oneCase.id,
      code: oneCase.code,
      x: width / 2,
      y: height / 2,
    }));
    linksArray = edges.map((edge) => ({
      source: edge[0],
      target: edge[1],
    }));
  };

  makeArrays();

  svg.attr("width", width).attr("height", height);

  const updateLocations = () => {
    nodes.attr("cx", (node) => node.x).attr("cy", (node) => node.y);
    links = g_links
      .selectAll("line")
      .attr("x2", (edge) => edge.source.x)
      .attr("y2", (edge) => edge.source.y)
      .attr("x1", (edge) => edge.target.x)
      .attr("y1", (edge) => edge.target.y);
  };

  const simulation = d3
    .forceSimulation(nodesArray)
    .force("charge", d3.forceManyBody().strength(-100))
    .force(
      "link",
      d3
        .forceLink(linksArray)
        .id((node) => node.id)
        .distance(20)
        .strength(1)
    )
    .force("x", d3.forceX(width / 2))
    .force("y", d3.forceY(height / 2))
    .on("tick", updateLocations);

  const rect = svg
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#ccc");
  const g_links = svg.append("g").attr("class", "links");
  const g_nodes = svg.append("g").attr("class", "nodes");

  let links = g_links
    .selectAll("line")
    .data(linksArray)
    .enter()
    .append("line")
    .attr("x2", (edge) => edge.source.x)
    .attr("y2", (edge) => edge.source.y)
    .attr("x1", (edge) => edge.target.x)
    .attr("y1", (edge) => edge.target.y);

  // Perform the next step in the replacement process.
  const replace = () => {
    if (currStep >= steps.length) {
      makeArrays();
      currStep = 0;
    } else {
      const { nodesDeleted, edgesAdded } = steps[currStep];
      currStep++;

      nodesArray = nodesArray.filter((node) => !nodesDeleted.includes(node.id));
      prunedArray = linksArray.filter(
        (link) =>
          !(
            nodesDeleted.includes(link.source.id) ||
            nodesDeleted.includes(link.target.id)
          )
      );
      linksArray = [
        ...prunedArray,
        ...edgesAdded.map((edge) => ({
          source: edge[0],
          target: edge[1],
        })),
      ];
    }

    simulation.nodes(nodesArray);

    simulation.force(
      "link",
      d3
        .forceLink(linksArray)
        .id((node) => node.id)
        .distance(20)
        .strength(1)
    );
    simulation.alpha(1);
    simulation.restart();
    reRender();
  };

  let nodes = g_nodes
    .selectAll("circle")
    .data(nodesArray)
    .enter()
    .append("circle")
    .attr("cx", (node) => node.x)
    .attr("cy", (node) => node.y)
    .on("click", replace);

  rect.on("click", replace, true);

  const reRender = () => {
    const update_nodes = g_nodes.selectAll("circle").data(nodesArray);
    update_nodes.exit().remove();
    nodes = update_nodes.enter().append("circle").merge(update_nodes);

    const update_links = g_links.selectAll("line").data(linksArray);
    update_links.exit().remove();
    links = update_links.enter().append("line").merge(update_links);
  };
};
