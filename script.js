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
        radius: skill.size * 10
      }));
      const links = (relationships || [])
        .filter(rel => rel.source && rel.target)
        .map(rel => ({
          source: rel.source,
          target: rel.target,
          distance: rel.distance || 80
        }));
      const graph = buildGraph(nodes, links);

      nodes.forEach(nodeData => {
        const bubble = document.createElement("div");
        bubble.className = "skill-bubble";
        bubble.style.background = "#666";
        const diameter = nodeData.radius * 2;
        bubble.style.width = diameter + "px";
        bubble.style.height = diameter + "px";

        const span = document.createElement("span");
        span.textContent = nodeData.skill.name;
        bubble.appendChild(span);
        nodesContainer.appendChild(bubble);

        bubble.addEventListener("click", () => {
          showDetails(nodeData, bubble.style.background);
        });

        d3.select(bubble)
          .call(d3.drag()
            .on("start", (event, d) => dragStarted(event, nodeData))
            .on("drag", (event, d) => dragged(event, nodeData))
            .on("end", (event, d) => dragEnded(event, nodeData))
          );

        nodeElems.push({ nodeData, htmlElem: bubble });
      });

      const edges = edgesSvg.selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.7);

      simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("charge", d3.forceManyBody().strength(-2000))
        .force("collision", d3.forceCollide(d => d.radius + 3))
        .force("link", d3.forceLink(links)
          .id(d => d.id)
          .distance(d => d.distance)
        )
        .on("tick", ticked);

      updateNodeColors(graph);

      function ticked() {
        nodeElems.forEach(({ nodeData, htmlElem }) => {
          let x = nodeData.x, y = nodeData.y;
          if (x == null) x = width / 2;
          if (y == null) y = height / 2;
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
    .catch(err => {
      console.error("Failed to load skills.json:", err);
    });

  // ===================
  // Helper functions
  // ===================

  function getNodeById(nodes, id) {
    return nodes.find(n => n.id === id);
  }

  function buildGraph(nodes, links) {
    const graph = {};
    nodes.forEach(n => { graph[n.id] = []; });
    links.forEach(link => {
      graph[link.source].push({ id: link.target, weight: link.distance });
      graph[link.target].push({ id: link.source, weight: link.distance });
    });
    return graph;
  }

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

  function updateNodeColors(graph) {
    const anchorSoft = "Soft Skills";
    const anchorData = "Data Science";
    const distFromSoft = dijkstra(graph, anchorSoft);
    const distFromData = dijkstra(graph, anchorData);
    const colorInterpolator = d3.interpolateRainbow;

    nodeElems.forEach(({ nodeData, htmlElem }) => {
      const id = nodeData.id;
      let dSoft = distFromSoft[id];
      let dData = distFromData[id];
      if (!isFinite(dSoft)) dSoft = 1000;
      if (!isFinite(dData)) dData = 1000;
      const score = dSoft / (dSoft + dData);
      const color = colorInterpolator(score);
      htmlElem.style.background = color;
    });
  }

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
        default:
          if (item.text) {
            html += `<p>${item.text}</p>`;
          }
      }
    });
    return html;
  }
});
  