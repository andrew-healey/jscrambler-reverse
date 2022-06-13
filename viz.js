window.onload = async () => {
  const isLocal = document.location.hostname === 'localhost';
  const isSwitched = new URLSearchParams(document.location.search).has(
    'switched',
  );
  const getFull = isLocal == isSwitched;

	const narration = document.querySelector(".narration");

	const setOps = async ()=>{
		const els = steps.map((step,idx)=>{
			const {type,nodesDeleted,edgesAdded,editedNodes}=step;
			const title=`${idx+1}. Detected ${type}`;
			const desc=editedNodes.length?`Merge ${nodesDeleted} into ${editedNodes.map(node=>node.id)}`:`Delete ${nodesDeleted}`;

			const titleEl=document.createElement("div");
			titleEl.classList.add("op-title");
			titleEl.innerText=title;

			const descEl=document.createElement("div");
			descEl.classList.add("op-desc");
			descEl.innerText=desc;

			const op=document.createElement("div");
			op.classList.add("op");
			op.appendChild(titleEl);
			op.appendChild(descEl);

			if(idx==0){
				op.classList.add("current");
			}

			return op;

		});
		narration.innerHTML="";
		for(let el of els){
			await new Promise(res=>setTimeout(res,1000));
			narration.appendChild(el);
		}
	};

  const { startCase, cases, edges, steps } = await (
    await fetch((getFull ? 'full' : 'partial') + '-graph.json')
  ).json();

	setOps();

  let currStep = 0;

  const svg = d3.select('svg');

  const width = window.innerWidth*0.8;
  const height = window.innerHeight;

  const rad = 30;
	let sizeMultiplier=1;
  const linesRatio = 5;
  const dist = 3;

  let nodesArray, linksArray;

  const getRadius = (node) =>
    sizeMultiplier*(rad + Math.floor(node.code.split('\n').length * linesRatio) + 2);

  const makeArrays = () => {
    nodesArray = cases.map((oneCase) => ({
      id: oneCase.id,
      code: oneCase.code,
      svg: oneCase.svg,
      x: width / 2,
      y: height / 2,
    }));
    linksArray = edges.map((edge) => ({
      source: edge[0],
      target: edge[1],
    }));
  };

  makeArrays();

  const markerBoxWidth = 5;
  const markerBoxHeight = 5;
  const refX = markerBoxWidth*3;
  const refY = markerBoxHeight / 2;
  const markerHeight = markerBoxWidth / 2;
  const markerWidth = markerBoxHeight / 2;
  const arrowPoints = [
    [0, 0],
    [0, markerBoxHeight],
    [markerBoxWidth, markerBoxHeight / 2],
  ];

  const defs = svg.append('defs');

  defs.html(`
    <clipPath id="circle-cutout">
      <circle cx="${rad}" cy="${rad}" r=${rad} />
    </clipPath>
    `);

  defs
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', [0, 0, markerBoxWidth, markerBoxHeight])
    .attr('refX', refX)
    .attr('refY', refY)
    .attr('markerWidth', markerWidth)
    .attr('markerHeight', markerHeight)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', d3.line()(arrowPoints))
		.attr('fill','white')
    .attr('stroke', 'white');

  svg.attr('width', width).attr('height', height);

  const updateLocations = () => {
    nodes.attr('transform', (node) => `translate(${node.x},${node.y})`);

    links = g_links
      .selectAll('line')
      .attr('x1', (edge) => edge.source.x)
      .attr('y1', (edge) => edge.source.y)
      .attr('x2', (edge) => edge.target.x)
      .attr('y2', (edge) => edge.target.y);
  };

  const simulation = d3
    .forceSimulation(nodesArray)
    .force(
      'charge',
      d3.forceManyBody().strength((node) => getRadius(node) * -15),
    )
    .force(
      'link',
      d3
        .forceLink(linksArray)
        .id((node) => node.id)
        .distance(
          (link) =>
            (dist * Math.max(getRadius(link.source) , getRadius(link.target))),
        )
        .strength(1),
    )
    .force('x', d3.forceX(width / 2))
    .force('y', d3.forceY(height / 2))
    .on('tick', updateLocations);

  const rect = svg
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#ccc');
  const g_links = svg.append('g').attr('class', 'links');
  const g_nodes = svg.append('g').attr('class', 'nodes');

  let links;

  const makeLinks = (someLinks) =>
    someLinks
      .enter()
      .append('line')
      .attr('marker-end', 'url(#arrow)')
      .attr('x1', (edge) => edge.source.x)
      .attr('y1', (edge) => edge.source.y)
      .attr('x2', (edge) => edge.target.x)
      .attr('y2', (edge) => edge.target.y);

  // Perform the next step in the replacement process.
  const replace = () => {
    let renderMethod;
    if (currStep >= steps.length) {
      makeArrays();
      currStep = 0;
      renderMethod = nuke;
    } else {
      renderMethod = reRender;
      const { nodesDeleted, edgesAdded, editedNodes } = steps[currStep];

      nodesArray.forEach((node) => {
        const editRecord = editedNodes.find((record) => record.id === node.id);
        if (editRecord) {
          node.code = editRecord.code;
          node.svg = editRecord.svg;
        }
      });

      nodesArray = nodesArray.filter((node) => !nodesDeleted.includes(node.id));

      prunedArray = linksArray.filter(
        (link) =>
          !(
            nodesDeleted.includes(link.source.id) ||
            nodesDeleted.includes(link.target.id)
          ),
      );
      linksArray = [
        ...prunedArray,
        ...edgesAdded.map((edge) => ({
          source: edge[0],
          target: edge[1],
        })),
      ];
      currStep++;
    }

		const htmlOps = [...document.querySelectorAll(".op")];
		htmlOps.forEach((el,idx)=>{
			el.classList.remove("current");
			if(idx===currStep){
				el.classList.add("current");
			}
		})

    simulation.nodes(nodesArray);

    simulation.force(
      'link',
      d3
        .forceLink(linksArray)
        .id((node) => node.id)
        .distance(
          (link) =>
            (dist * (getRadius(link.source) + getRadius(link.target))) / 2,
        )
        .strength(1),
    );
    simulation.alpha(1.5);
    simulation.restart();
    renderMethod();

    nodes
      .select('.preview')
      .attr(
        'transform',
        (node) => `translate(${-getRadius(node)},${-getRadius(node)})`,
      )
      .html((node) => node.svg)
      .select('svg')
      .attr('height', (node) => getRadius(node) * 2)
      .attr('width', (node) => getRadius(node) * 2);

    nodes.select('circle').attr('r', getRadius);
    nodes
      .select('text.num')
      .attr('transform', (node) => {
        const radius = getRadius(node);
        const dist = radius / Math.sqrt(2);
        return `translate(-${0},${dist})`;
      })
      .attr('stroke', (node) =>
        steps[currStep]?.nodesDeleted?.includes?.(node.id) ? 'red' : 'blue',
      );



  };

  const dragStarted = (node) => {
    if (!d3.event.active) simulation.alpha(0.03).restart();
    node.fx = node.x;
    node.fy = node.y;
  };

  const dragged = (node) => {
    node.fx = d3.event.x;
    node.fy = d3.event.y;
  };

  const dragEnded = (node) => {
    if (!d3.event.active) simulation.alpha(0.03).restart();
    node.fx = null;
    node.fy = null;
  };

  const makeNodes = (someNodes) => {
    const nodes = someNodes
      .enter()
      .append('g')
      .attr('class', 'circle')
      .attr('transform', (node) => `translate(${node.x},${node.y})`)
      .on('click', replace)
      .call(
        d3
          .drag() // call specific function when circle is dragged
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded),
      );

    nodes
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', getRadius)
      .attr('class', (node) => (node.id === startCase ? 'start' : ''));

    nodes
      .append('g')
      .attr('class', 'preview')
      .attr(
        'transform',
        (node) => `translate(${-getRadius(node)},${-getRadius(node)})`,
      )
      .attr('clip-path', 'circle(50%)')
      .html((node) => node.svg)
      .select('svg')
      .attr('width', (node) => getRadius(node) * 2)
      .attr('height', (node) => getRadius(node) * 2);

    nodes
      .append('text')
      .attr('class', 'num')
      .text((node) => node.id)
      .attr('transform', (node) => {
        const radius = getRadius(node);
        const dist = radius / Math.sqrt(2);
        return `translate(-${0},${dist})`;
      })
      .attr('stroke', (node) =>
        steps[currStep]?.nodesDeleted?.includes?.(node.id) ? 'red' : 'blue',
      )
      .attr('font-family', 'Consolas');

    return nodes;
  };

  rect.on('click', replace, true);

  const nuke = () => {
    const remove_nodes = g_nodes.selectAll('g.circle').data([]);
    remove_nodes.exit().remove();

    nodes = makeNodes(g_nodes.selectAll('g.circle').data(nodesArray));

    links = makeLinks(g_links.selectAll('line').data(linksArray));
  };

  nuke();

  const reRender = () => {
    // I need to explicitly split my "zombie" DOM nodes into two groups: one which matches one-to-one, in the right order, with my data nodes; and another which has all of my DOM nodes to kill.

    const update_nodes = g_nodes
      .selectAll('g.circle')
      .filter(
        (node) =>
          nodesArray.findIndex((arrNode) => arrNode.id == node.id) !== -1,
      )
      .data(nodesArray);
    update_nodes.exit().remove();

    const remove_nodes = g_nodes
      .selectAll('g.circle')
      .filter(
        (node) =>
          nodesArray.findIndex((arrNode) => arrNode.id == node.id) === -1,
      )
      .data([]);
    remove_nodes.exit().remove();

    nodes = makeNodes(update_nodes).merge(update_nodes);

    const update_links = g_links.selectAll('line').data(linksArray);
    update_links.exit().remove();
    links = makeLinks(update_links).merge(update_links);
  };

};
