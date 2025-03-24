document.addEventListener("DOMContentLoaded", () => {
  const titleBanner    = document.getElementById("titleBanner");
  const vizContainer   = document.getElementById("vizContainer");
  const nodesContainer = document.getElementById("nodesContainer");
  const dataScience = document.getElementById("dataScience");
  const cognitiveScience = document.getElementById("cognitiveScience");
  const edgesSvg       = d3.select("#edgesSvg");
  const detailsOverlay = document.getElementById("detailsOverlay");
  const detailsPanel   = document.getElementById("detailsPanel");
  const skillBanner    = document.getElementById("skillBanner");
  const detailsContent = document.getElementById("detailsContent");
  const closeDetails   = document.getElementById("closeDetails");

  // Container dimensions
  let width  = vizContainer.offsetWidth;
  let height = vizContainer.offsetHeight;
  let shortDim = Math.min(width, height);

  // Scale factors for forces
  const BASE_CHARGE_FACTOR      = -4;   // multiplied by shortDim => negative => repulsion
  const COLLISION_OFFSET_FACTOR = 0.04; // fraction of shortDim to add to collision radius

  let nodeElems  = [];
  let simulation = null;
  let skillsByCategory = {
    'dataScience': [],
    'cognitiveScience': []
  };
  // Track explosion state for each category
  let categoryState = {
    'dataScience': { exploded: false },
    'cognitiveScience': { exploded: false }
  };
  let activeCategory = null;
  let links = [];
  let edges = null;

  detailsOverlay.addEventListener("click", hideDetails);
  closeDetails.addEventListener("click", hideDetails);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && detailsPanel.style.display === "block") {
      hideDetails();
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

  // Set up category bubbles
  function setupCategoryBubbles() {
    const categorySize = shortDim * 0.25; // 25% of the shorter dimension
    
    dataScience.style.width = `${categorySize}px`;
    dataScience.style.height = `${categorySize}px`;
    dataScience.style.left = `${width * 0.3 - categorySize / 2}px`;
    dataScience.style.top = `${height / 2 - categorySize / 2}px`;
    dataScience.style.fontSize = `${categorySize * 0.15}px`;
    
    cognitiveScience.style.width = `${categorySize}px`;
    cognitiveScience.style.height = `${categorySize}px`;
    cognitiveScience.style.left = `${width * 0.7 - categorySize / 2}px`;
    cognitiveScience.style.top = `${height / 2 - categorySize / 2}px`;
    cognitiveScience.style.fontSize = `${categorySize * 0.15}px`;
    
    dataScience.addEventListener("click", () => explodeBubble("dataScience"));
    cognitiveScience.addEventListener("click", () => explodeBubble("cognitiveScience"));
    
    // Initial link between categories
    createCategoryLink();
  }
  
  // Create the initial link between the two category bubbles
  function createCategoryLink() {
    // Clear existing edges
    edgesSvg.selectAll("*").remove();
    
    // Add a single link between categories
    const dataScienceRect = dataScience.getBoundingClientRect();
    const cogScienceRect = cognitiveScience.getBoundingClientRect();
    const containerRect = vizContainer.getBoundingClientRect();
    
    const x1 = dataScienceRect.left + dataScienceRect.width / 2 - containerRect.left;
    const y1 = dataScienceRect.top + dataScienceRect.height / 2 - containerRect.top;
    const x2 = cogScienceRect.left + cogScienceRect.width / 2 - containerRect.left;
    const y2 = cogScienceRect.top + cogScienceRect.height / 2 - containerRect.top;
    
    edgesSvg.append("line")
      .attr("x1", x1)
      .attr("y1", y1)
      .attr("x2", x2)
      .attr("y2", y2)
      .attr("stroke", "#aaa")
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-dasharray", "8,8")
      .attr("id", "categoryLink");
  }

  // Create explosion particles for the Michael Bay effect
  function createExplosionParticles(category, x, y, radius) {
    const particleCount = 50;
    const particleContainer = document.createElement("div");
    particleContainer.className = "explosion-particles";
    vizContainer.appendChild(particleContainer);
    
    const baseColor = category === "dataScience" ? 
      getComputedStyle(document.documentElement).getPropertyValue('--data-science-color').trim() : 
      getComputedStyle(document.documentElement).getPropertyValue('--cognitive-science-color').trim();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "explosion-particle";
      
      // Random size
      const size = Math.random() * (radius * 0.2) + 5;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Start position
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      
      // Random direction and distance
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius * 2;
      const destX = x + Math.cos(angle) * distance;
      const destY = y + Math.sin(angle) * distance;
      
      // Random color variation around the base color
      particle.style.backgroundColor = i % 4 === 0 ? 'white' : baseColor;
      
      particleContainer.appendChild(particle);
      
      // Animate the particle
      setTimeout(() => {
        particle.style.transition = `all ${0.5 + Math.random() * 1}s ease-out`;
        particle.style.left = `${destX}px`;
        particle.style.top = `${destY}px`;
        particle.style.opacity = '0';
      }, 10);
      
      // Remove the particle after animation
      setTimeout(() => {
        particle.remove();
      }, 2000);
    }
    
    // Clean up the container after all animations
    setTimeout(() => {
      particleContainer.remove();
    }, 2500);
  }

  // Michael Bay explosion effect
  function explodeBubble(category) {
    // If this category is already exploded, return
    if (categoryState[category].exploded) return;
    
    // Set this category as active and mark it as exploded
    activeCategory = category;
    categoryState[category].exploded = true;
    
    const bubble = category === "dataScience" ? dataScience : cognitiveScience;
    const otherCategory = category === "dataScience" ? "cognitiveScience" : "dataScience";
    
    // Get bubble position and size
    const rect = bubble.getBoundingClientRect();
    const containerRect = vizContainer.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - containerRect.left;
    const y = rect.top + rect.height / 2 - containerRect.top;
    const radius = rect.width / 2;
    
    // Remove the category link with transition if it exists
    d3.select("#categoryLink").remove();
    
    // Create explosion particles
    createExplosionParticles(category, x, y, radius);
    
    // Wait a bit, then hide the clicked bubble
    setTimeout(() => {
      bubble.style.transition = "all 0.2s ease";
      bubble.style.opacity = "0";
      bubble.style.transform = "scale(0)";
      bubble.style.pointerEvents = "none"; // Disable clicks on hidden bubble
    }, 100);
    
    // Reveal and throw skill bubbles
    setTimeout(() => {
      // Show only the skills for this category
      nodeElems.forEach(({ nodeData, htmlElem }) => {
        if (skillsByCategory[category].includes(nodeData.id)) {
          htmlElem.classList.add("active");
          htmlElem.style.pointerEvents = "auto"; // Ensure clicks work
          
          // Position the bubbles around where the big bubble was
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * radius;
          const startX = x + Math.cos(angle) * distance - nodeData.radius;
          const startY = y + Math.sin(angle) * distance - nodeData.radius;
          
          htmlElem.style.left = `${startX}px`;
          htmlElem.style.top = `${startY}px`;
          
          // Release fixed positions
          nodeData.x = startX + nodeData.radius;
          nodeData.y = startY + nodeData.radius;
          if (!nodeData.isAnchor) {
            nodeData.fx = null;
            nodeData.fy = null;
          }
        }
      });
      
      // Create links between small bubbles with fade-in effect
      createSkillLinks();
      
      // Restart the simulation with a strong force
      if (simulation) {
        simulation.alpha(1).restart();
      }
    }, 500);
  }
  
  // Create links between skill bubbles after explosion
  function createSkillLinks() {
    // Clear any existing links
    edgesSvg.selectAll("line").remove();
    
    // Get all currently visible categories
    const activeCategories = Object.keys(categoryState)
      .filter(cat => categoryState[cat].exploded);
    
    // Get all skills from active categories
    const visibleSkills = [];
    activeCategories.forEach(cat => {
      visibleSkills.push(...skillsByCategory[cat]);
    });
    
    // Filter links to only include those where both source and target are visible
    const visibleLinks = links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return visibleSkills.includes(sourceId) && visibleSkills.includes(targetId);
    });
    
    // Create edges with a fade-in effect
    edges = edgesSvg.selectAll("line")
      .data(visibleLinks)
      .enter()
      .append("line")
      .attr("stroke", "#aaa")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0)
      .attr("class", "skill-link");
    
    // Fade in the edges
    edges.transition()
      .duration(1000)
      .attr("stroke-opacity", 0.7);
  }

  fetch("skills.json")
    .then(resp => resp.json())
    .then(data => {
      const { skills, relationships } = data;

      // Determine rating range
      const allRatings = skills.map(s => s.rating || 1);
      const minRating  = d3.min(allRatings);
      const maxRating  = d3.max(allRatings);

      // Power scale for bubble radii
      const radiusScale = d3.scalePow()
        .exponent(0.8)
        .domain([minRating, maxRating])
        // Adjust these multipliers to taste
        .range([0.08 * shortDim, 0.15 * shortDim])
        .clamp(true);

      // Build node data
      const nodes = skills.map(skill => {
        const rating  = skill.rating || 1;
        const radius  = radiusScale(rating);
        
        // Categorize the skill based on its relationship
        // If it's closer to Data Science, put it in that category, otherwise in Cognitive Science
        // Default to Data Science if unknown
        let category = 'dataScience';
        if (skill.name === "Data Science") {
          category = 'dataScience';
        } else if (skill.name === "Cognitive sciences & Neurosciences") {
          category = 'cognitiveScience';
        }
        
        skillsByCategory[category].push(skill.name);
        
        return {
          id: skill.name,
          skill: skill,
          radius: radius,
          isAnchor:
            skill.name === "Data Science" ||
            skill.name === "Cognitive sciences & Neurosciences"
        };
      });

      // Build link data
      links = (relationships || [])
        .filter(rel => rel.source && rel.target)
        .map(rel => ({
          source: rel.source,
          target: rel.target,
          distance: rel.distance || 80
        }));

      // Pin anchors: Data Science (left), Cog Sci (right)
      const margin = 80;
      nodes.forEach(n => {
        if (n.id === "Data Science") {
          n.fx = n.radius + margin;
          n.fy = height * 0.5;
        } else if (n.id === "Cognitive sciences & Neurosciences") {
          n.fx = width - n.radius - margin;
          n.fy = height * 0.5;
        }
      });

      const graph = buildGraph(nodes, links);
      
      // Create the bubble elements
      nodes.forEach(nodeData => {
        const bubble = document.createElement("div");
        bubble.className = "skill-bubble";

        // Distinguish anchors with a grey border
        if (nodeData.isAnchor) {
          bubble.style.border = "3px solid #999";
        }

        // Each bubble's diameter
        const diameter = nodeData.radius * 2;
        bubble.style.width  = `${diameter}px`;
        bubble.style.height = `${diameter}px`;

        // Container for text (skill name + rating)
        const textContainer = document.createElement("div");
        textContainer.style.display         = "flex";
        textContainer.style.flexDirection  = "column";
        textContainer.style.alignItems     = "center";
        textContainer.style.justifyContent = "center";

        // **Make font size ~60% of bubble radius** 
        const rawFontSize = nodeData.radius * 0.2;
        const clampedFontSize = Math.max(12, Math.min(rawFontSize, 24));
        textContainer.style.fontSize = `${clampedFontSize}px`;

        // Skill name
        const nameSpan = document.createElement("span");
        nameSpan.textContent     = nodeData.skill.name;
        nameSpan.style.fontWeight = "bold";
        textContainer.appendChild(nameSpan);

        // Rating
        if (typeof nodeData.skill.rating === "number") {
          const ratingSpan = document.createElement("span");
          ratingSpan.textContent = `${nodeData.skill.rating}/10`;
          ratingSpan.style.opacity  = "0.9";
          textContainer.appendChild(ratingSpan);
        }

        bubble.appendChild(textContainer);

        // On click => details
        bubble.addEventListener("click", (event) => {
          // Prevent the click from affecting drag
          if (event.ctrlKey || event.shiftKey || event.metaKey) return;
          
          showDetails(nodeData, bubble.style.background);
          
          // Prevent default to avoid issues with drag
          event.preventDefault();
          event.stopPropagation();
        });

        // Initialize drag behavior outside the force layout
        const dragBehavior = d3.drag()
          .on("start", event => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            nodeData.fx = nodeData.x;
            nodeData.fy = nodeData.y;
          })
          .on("drag", event => {
            nodeData.fx = event.x;
            nodeData.fy = event.y;
          })
          .on("end", event => {
            if (!event.active) simulation.alphaTarget(0);
            if (!nodeData.isAnchor) {
              nodeData.fx = null;
              nodeData.fy = null;
            }
          });

        // Apply the drag behavior to the bubble
        d3.select(bubble).call(dragBehavior);

        nodesContainer.appendChild(bubble);
        nodeElems.push({ nodeData, htmlElem: bubble });
      });

      // Force simulation
      simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(width / 2, height / 2))
        // Scale the charge by shortDim
        .force("charge", d3.forceManyBody().strength(BASE_CHARGE_FACTOR * shortDim))
        .force("collision", d3.forceCollide(d => d.radius + (COLLISION_OFFSET_FACTOR * shortDim)))
        .force("link", d3.forceLink(links)
          .id(d => d.id)
          .distance(d => d.distance)
        )
        .on("tick", ticked);

      updateNodeColors(graph);
      setupCategoryBubbles();
      
      // Now categorize skills based on distances from each anchor
      const distFromData = dijkstra(graph, "Data Science");
      const distFromCogn = dijkstra(graph, "Cognitive sciences & Neurosciences");
      
      // Recategorize skills based on the distance
      skillsByCategory = {
        'dataScience': [],
        'cognitiveScience': []
      };
      
      nodes.forEach(node => {
        const id = node.id;
        let dData = distFromData[id];
        let dCogn = distFromCogn[id];
        
        if (!isFinite(dData)) dData = 1000;
        if (!isFinite(dCogn)) dCogn = 1000;
        
        // Assign to category based on which anchor is closer
        const category = dData <= dCogn ? 'dataScience' : 'cognitiveScience';
        skillsByCategory[category].push(id);
      });

      function ticked() {
        nodeElems.forEach(({ nodeData, htmlElem }) => {
          let x = nodeData.x, y = nodeData.y;
          if (x == null) x = width / 2;
          if (y == null) y = height / 2;

          // clamp inside container
          x = Math.max(nodeData.radius, Math.min(width  - nodeData.radius, x));
          y = Math.max(nodeData.radius, Math.min(height - nodeData.radius, y));

          nodeData.x = x;
          nodeData.y = y;
          htmlElem.style.left = `${x - nodeData.radius}px`;
          htmlElem.style.top  = `${y - nodeData.radius}px`;
        });

        // Update edges if present
        if (edges) {
          edges
            .attr("x1", d => getNodeById(nodes, d.source).x)
            .attr("y1", d => getNodeById(nodes, d.source).y)
            .attr("x2", d => getNodeById(nodes, d.target).x)
            .attr("y2", d => getNodeById(nodes, d.target).y);
        }
      }
    })
    .catch(err => console.error("Failed to load skills.json:", err));

  // Distances => color
  function updateNodeColors(graph) {
    const anchorData = "Data Science";
    const anchorCogn = "Cognitive sciences & Neurosciences";

    const distFromData = dijkstra(graph, anchorData);
    const distFromCogn = dijkstra(graph, anchorCogn);

    const customRainbow = t => d3.interpolateRainbow(0.1 + 0.8 * t);

    nodeElems.forEach(({ nodeData, htmlElem }) => {
      const id = nodeData.id;
      if (id === anchorData) {
        htmlElem.style.background = "#59f"; // bright blue
        return;
      }
      if (id === anchorCogn) {
        htmlElem.style.background = "#f55"; // red
        return;
      }

      let dData = distFromData[id];
      let dCogn = distFromCogn[id];
      if (!isFinite(dData)) dData = 1000;
      if (!isFinite(dCogn)) dCogn = 1000;

      const ratio = dCogn / (dCogn + dData);
      htmlElem.style.background = customRainbow(ratio);
    });
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
    const visited   = {};
    const queue     = new Set();

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

  function buildSkillContentHTML(skill) {
    let html = "";
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
