document.addEventListener("DOMContentLoaded", () => {
  const titleBanner    = document.getElementById("titleBanner");
  const vizContainer   = document.getElementById("vizContainer");
  const nodesContainer = document.getElementById("nodesContainer");
  const edgesSvg       = d3.select("#edgesSvg");
  const detailsOverlay = document.getElementById("detailsOverlay");
  const detailsPanel   = document.getElementById("detailsPanel");
  const skillBanner    = document.getElementById("skillBanner");
  const detailsContent = document.getElementById("detailsContent");
  const closeDetails   = document.getElementById("closeDetails");
  const width          = vizContainer.offsetWidth;
  const height         = vizContainer.offsetHeight;

  let nodeElems = []; 
  let simulation = null;

  // Clicking the overlay closes the details panel.
  detailsOverlay.addEventListener("click", () => {
    hideDetails();
  });

  // Close details panel on button click.
  closeDetails.addEventListener("click", () => {
    hideDetails();
  });

  function showDetails(nodeData, color) {
    const skill = nodeData.skill;
    skillBanner.textContent = skill.fullName || skill.name;
    skillBanner.style.background = color;
    detailsContent.innerHTML = buildSkillContentHTML(skill);

    detailsPanel.style.display = "block";
    detailsOverlay.style.display = "block";
  }

  function hideDetails() {
    detailsPanel.style.display = "none";
    detailsOverlay.style.display = "none";
  }

fetch("skills.json")
  .then(resp => resp.json())
  .then(data => {
    const { skills, relationships } = data;

    const nodes = skills.map(skill => ({
      id: skill.name,
      skill: skill,
      radius: skill.size * 10,
      isAnchor: (skill.name === "Data Science" || skill.name === "Soft Skills")
    }));

    const links = (relationships || [])
      .filter(rel => rel.source && rel.target)
      .map(rel => ({
        source: rel.source,
        target: rel.target,
        distance: rel.distance || 80
      }));

    // Place Data Science (left) + Soft Skills (right).
    // We'll also fix them at some vertical center, but user can drag them around.
    const margin = 80;
    nodes.forEach(n => {
      if (n.id === "Data Science") {
        n.fx = n.radius + margin;         // pinned left
        n.fy = height * 0.5;             // center vertically
      } else if (n.id === "Soft Skills") {
        n.fx = width - n.radius - margin; // pinned right
        n.fy = height * 0.5;             // center vertically
      }
    });

    const graph = buildGraph(nodes, links);

    // Create the bubble divs
    nodes.forEach(nodeData => {
      const bubble = document.createElement("div");
      bubble.className = "skill-bubble";

      // Distinguish anchors with a grey border
      if (nodeData.isAnchor) {
        bubble.style.border = "3px solid #999";
      }
      // Temporary background, final color assigned below
      bubble.style.background = "#666";

      const diameter = nodeData.radius * 2;
      bubble.style.width = diameter + "px";
      bubble.style.height = diameter + "px";

      const span = document.createElement("span");
      span.textContent = nodeData.skill.name;
      bubble.appendChild(span);

      // On click => show skill details
      bubble.addEventListener("click", () => {
        showDetails(nodeData, bubble.style.background);
      });

      // We allow drag for all nodes, but anchors remain pinned after drag.
      d3.select(bubble)
        .call(d3.drag()
          .on("start", event => dragStarted(event, nodeData))
          .on("drag",  event => dragged(event, nodeData))
          .on("end",   event => dragEnded(event, nodeData))
        );

      nodesContainer.appendChild(bubble);
      nodeElems.push({ nodeData, htmlElem: bubble });
    });

    // Create edges
    const edges = edgesSvg.selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#aaa")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.7);

    // Force simulation
    simulation = d3.forceSimulation(nodes)
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("charge", d3.forceManyBody().strength(-2000))
      .force("collision", d3.forceCollide(d => d.radius + 3))
      .force("link", d3.forceLink(links)
        .id(d => d.id)
        .distance(d => d.distance)
      )
      .on("tick", ticked);

    // Assign final colors
    updateNodeColors(graph);

    function ticked() {
      nodeElems.forEach(({ nodeData, htmlElem }) => {
        let x = nodeData.x, y = nodeData.y;
        if (x == null) x = width / 2;
        if (y == null) y = height / 2;
        // clamp
        x = Math.max(nodeData.radius, Math.min(width - nodeData.radius, x));
        y = Math.max(nodeData.radius, Math.min(height - nodeData.radius, y));
        nodeData.x = x;
        nodeData.y = y;
        htmlElem.style.left = (x - nodeData.radius) + "px";
        htmlElem.style.top  = (y - nodeData.radius) + "px";
      });

      edges
        .attr("x1", d => {
          const source = getNodeById(nodes, d.source.id || d.source);
          return source.x;
        })
        .attr("y1", d => {
          const source = getNodeById(nodes, d.source.id || d.source);
          return source.y;
        })
        .attr("x2", d => {
          const target = getNodeById(nodes, d.target.id || d.target);
          return target.x;
        })
        .attr("y2", d => {
          const target = getNodeById(nodes, d.target.id || d.target);
          return target.y;
        });
    }
  })
  .catch(err => console.error("Failed to load skills.json:", err));

/**
 * Overriding the color for Data Science & Soft Skills. 
 * Others get a chunk of the rainbow with no overlap at the ends.
 */
function updateNodeColors(graph) {
  const anchorSoft = "Soft Skills";
  const anchorData = "Data Science";

  const distFromSoft = dijkstra(graph, anchorSoft);
  const distFromData = dijkstra(graph, anchorData);

  // Skip first 5% and last 5% of the rainbow
  const customRainbow = t => d3.interpolateRainbow(0.05 + 0.9 * t);

  nodeElems.forEach(({ nodeData, htmlElem }) => {
    const id = nodeData.id;
    if (id === anchorSoft) {
      // e.g. bright pink
      htmlElem.style.background = "#ff59b4"; 
      return;
    }
    if (id === anchorData) {
      // e.g. bright green
      htmlElem.style.background = "#7aff69"; 
      return;
    }

    let dSoft = distFromSoft[id];
    let dData = distFromData[id];
    if (!isFinite(dSoft)) dSoft = 1000;
    if (!isFinite(dData)) dData = 1000;

    const score = dSoft / (dSoft + dData);
    htmlElem.style.background = customRainbow(score);
  });
}

/** 
 * Only reset fx,fy if it's NOT an anchor node. 
 */
function dragEnded(event, nodeData) {
  if (!event.active) simulation.alphaTarget(0);
  if (!nodeData.isAnchor) {
    nodeData.fx = null;
    nodeData.fy = null;
  }
}


// Updated color function => 
// Data Science, Soft Skills forcibly get distinct preset colors
function updateNodeColors(graph) {
  const anchorSoft = "Soft Skills";
  const anchorData = "Data Science";

  const distFromSoft = dijkstra(graph, anchorSoft);
  const distFromData = dijkstra(graph, anchorData);

  // We'll skip the rainbow edges from 0.0-0.05 and 0.95-1.0 
  // to avoid purple overlap
  const customRainbow = t => d3.interpolateRainbow(0.05 + 0.9 * t);

  nodeElems.forEach(({ nodeData, htmlElem }) => {
    const id = nodeData.id;

    // If it's Soft Skills => bright color #f55, Data Science => #5f5, for instance
    if (id === anchorSoft) {
      htmlElem.style.background = "#f55"; // red-ish
      return;
    }
    if (id === anchorData) {
      htmlElem.style.background = "#5f5"; // green-ish
      return;
    }

    let dSoft = distFromSoft[id];
    let dData = distFromData[id];
    if (!isFinite(dSoft)) dSoft = 1000;
    if (!isFinite(dData)) dData = 1000;

    const score = dSoft / (dSoft + dData);
    const color = customRainbow(score);
    htmlElem.style.background = color;
  });
}


  // Helper: Build adjacency list for Dijkstra.
  function buildGraph(nodes, links) {
    const graph = {};
    nodes.forEach(n => { graph[n.id] = []; });
    links.forEach(link => {
      graph[link.source].push({ id: link.target, weight: link.distance });
      graph[link.target].push({ id: link.source, weight: link.distance });
    });
    return graph;
  }

  // Dijkstra => shortest path distances from startId.
  function dijkstra(graph, startId) {
    const distances = {};
    const visited = {};
    const queue = new Set();

    Object.keys(graph).forEach(id => {
      distances[id] = Infinity;
      queue.add(id);
    });
    distances[startId] = 0;

    while (queue.size) {
      let current = null;
      queue.forEach(id => {
        if (current === null || distances[id] < distances[current]) {
          current = id;
        }
      });
      queue.delete(current);
      visited[current] = true;

      graph[current].forEach(neighbor => {
        if (!visited[neighbor.id]) {
          const alt = distances[current] + neighbor.weight;
          if (alt < distances[neighbor.id]) {
            distances[neighbor.id] = alt;
          }
        }
      });
    }
    return distances;
  }

  // Color assignment => skip the rainbow overlap around 0 and 1.
  function updateNodeColors(graph) {
    const anchorSoft = "Soft Skills";
    const anchorData = "Data Science";

    const distFromSoft = dijkstra(graph, anchorSoft);
    const distFromData = dijkstra(graph, anchorData);

    // 0.1 => ~blue region, 0.9 => ~red/green region, skipping purple ends.
    const customRainbow = t => d3.interpolateRainbow(0.1 + 0.8 * t);

    nodeElems.forEach(({ nodeData, htmlElem }) => {
      const id = nodeData.id;
      let dSoft = distFromSoft[id];
      let dData = distFromData[id];
      if (!isFinite(dSoft)) dSoft = 1000;
      if (!isFinite(dData)) dData = 1000;

      const score = dSoft / (dSoft + dData);
      const color = customRainbow(score);
      htmlElem.style.background = color;
    });
  }

  // Basic D3 drag callbacks
  function dragStarted(event, nodeData) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    nodeData.fx = nodeData.x;
    nodeData.fy = nodeData.y;
  }
  function dragged(event, nodeData) {
    nodeData.fx = event.x;
    nodeData.fy = event.y;
  }
  function dragEnded(event, nodeData) {
    if (!event.active) simulation.alphaTarget(0);
    nodeData.fx = null;
    nodeData.fy = null;
  }

  // Build the HTML for each item in skill.content, including images + PDFs now.
  function buildSkillContentHTML(skill) {
    if (!Array.isArray(skill.content)) {
      return "<p>Aucun détail supplémentaire.</p>";
    }

    let html = "";
    skill.content.forEach(item => {
      switch (item.type) {
        case "heading":
          html += `<h3>${item.text}</h3>`;
          break;
        case "paragraph":
          html += `<p>${item.text}</p>`;
          break;
        case "video":
          html += `
            <div class="video-player">
              <video controls>
                <source src="${item.src}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
              <p>${item.description || ""}</p>
            </div>
          `;
          break;
        case "image":
          html += `
            <div class="image-container">
              <img src="${item.src}" alt="${item.alt || ""}" style="max-width:25%; height:auto;" />
              <p>${item.description || ""}</p>
            </div>
          `;
          break;
        case "pdf":
          // Using <iframe> for inline PDF viewing. 
          html += `
            <div class="pdf-container">
              <iframe src="${item.src}" style="width:100%; height:600px;" frameborder="0"></iframe>
              <p>${item.description || ""}</p>
            </div>
          `;
          break;
        default:
          if (item.text) {
            html += `<p>${item.text}</p>`;
          }
      }
    });
    return html;
  }

  // find a node by name in the nodes array
  function getNodeById(nodes, id) {
    return nodes.find(n => n.id === id);
  }
});
