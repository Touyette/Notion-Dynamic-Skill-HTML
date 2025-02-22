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

  // Close details with Escape key
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      // Only hide if the details panel is visible
      if (detailsPanel.style.display === "block") {
        hideDetails();
      }
    }
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

      // Convert each skill's rating into a node radius.
      const nodes = skills.map(skill => ({
        id: skill.name,
        skill: skill,
        radius: (skill.rating || 1) * 10,
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
      const margin = 80;
      nodes.forEach(n => {
        if (n.id === "Data Science") {
          n.fx = n.radius + margin;        // pinned left
          n.fy = height * 0.5;            // center vertically
        } else if (n.id === "Soft Skills") {
          n.fx = width - n.radius - margin; // pinned right
          n.fy = height * 0.5;            // center vertically
        }
      });

      const graph = buildGraph(nodes, links);

      // Create bubble divs
      nodes.forEach(nodeData => {
        const bubble = document.createElement("div");
        bubble.className = "skill-bubble";

        // Distinguish anchors with a grey border
        if (nodeData.isAnchor) {
          bubble.style.border = "3px solid #999";
        }

        // Set bubble diameter
        const diameter = nodeData.radius * 2;
        bubble.style.width = diameter + "px";
        bubble.style.height = diameter + "px";

        // Create a container for text (skill name + rating)
        const textContainer = document.createElement("div");
        textContainer.style.display = "flex";
        textContainer.style.flexDirection = "column";
        textContainer.style.alignItems = "center";
        textContainer.style.justifyContent = "center";

        // Skill name
        const nameSpan = document.createElement("span");
        nameSpan.textContent = nodeData.skill.name;
        nameSpan.style.fontWeight = "bold";
        nameSpan.style.marginBottom = "3px";
        textContainer.appendChild(nameSpan);

        // Rating as X/10
        if (typeof nodeData.skill.rating === "number") {
          const ratingSpan = document.createElement("span");
          ratingSpan.textContent = `${nodeData.skill.rating}/10`;
          ratingSpan.style.fontSize = "13px";
          ratingSpan.style.opacity = "0.9";
          textContainer.appendChild(ratingSpan);
        }

        bubble.appendChild(textContainer);

        // On click => show skill details
        bubble.addEventListener("click", () => {
          showDetails(nodeData, bubble.style.background);
        });

        // Make bubble draggable
        d3.select(bubble)
          .call(d3.drag()
            .on("start", event => dragStarted(event, nodeData))
            .on("drag", event => dragged(event, nodeData))
            .on("end", event => dragEnded(event, nodeData))
          );

        nodesContainer.appendChild(bubble);
        nodeElems.push({ nodeData, htmlElem: bubble });
      });

      // Create edges in SVG
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
          .attr("x1", d => getNodeById(nodes, d.source).x)
          .attr("y1", d => getNodeById(nodes, d.source).y)
          .attr("x2", d => getNodeById(nodes, d.target).x)
          .attr("y2", d => getNodeById(nodes, d.target).y);
      }
    })
    .catch(err => console.error("Failed to load skills.json:", err));

  // Color each node based on distance from two anchors
  function updateNodeColors(graph) {
    const anchorSoft = "Soft Skills";
    const anchorData = "Data Science";

    const distFromSoft = dijkstra(graph, anchorSoft);
    const distFromData = dijkstra(graph, anchorData);

    // We'll skip some edges of the rainbow to avoid muddy purples, e.g. 0.1 -> 0.9
    const customRainbow = t => d3.interpolateRainbow(0.1 + 0.8 * t);

    nodeElems.forEach(({ nodeData, htmlElem }) => {
      const id = nodeData.id;

      // If it's Soft Skills => forced color (red)
      if (id === anchorSoft) {
        htmlElem.style.background = "#f55"; 
        return;
      }
      // If it's Data Science => forced color (blue)
      if (id === anchorData) {
        htmlElem.style.background = "#59f";
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

  // Build adjacency list for Dijkstra
  function buildGraph(nodes, links) {
    const graph = {};
    nodes.forEach(n => { graph[n.id] = []; });
    links.forEach(link => {
      graph[link.source].push({ id: link.target, weight: link.distance });
      graph[link.target].push({ id: link.source, weight: link.distance });
    });
    return graph;
  }

  // Dijkstra => shortest path distances from startId
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
    // Keep anchor nodes pinned; free others
    if (!nodeData.isAnchor) {
      nodeData.fx = null;
      nodeData.fy = null;
    }
  }

  // Build skill content HTML; rating block goes at the bottom now
  function buildSkillContentHTML(skill) {
    let html = "";

    // 1) Append skill.content elements
    if (Array.isArray(skill.content)) {
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
    }

    // 2) Now add rating and rationale at the bottom
    if (typeof skill.rating === "number") {
      html += `
        <h3>Rating ${skill.rating}/10</h3>
        <p>${skill.ratingExplanation || ""}</p>
      `;
    }

    if (!html) {
      html = "<p>No details available.</p>";
    }
    return html;
  }

  function getNodeById(nodes, id) {
    return nodes.find(n => n.id === (typeof id === "string" ? id : id.id));
  }
});
