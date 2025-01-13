// script.js
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("bubblesContainer");
  
    // Fetch the JSON
    fetch("skills.json")
      .then(resp => resp.json())
      .then(data => {
        const { skills, relationships } = data;
  
        // Convert each skill to a node object for D3
        // We'll use the skill's "name" as an ID
        const nodes = skills.map((skill) => {
          return {
            id: skill.name,
            skill: skill, // reference the raw skill data
            radius: skill.size * 10 // scale size arbitrarily
          };
        });
  
        // The links from "relationships"
        // D3 will match them by node.id
        const links = relationships.map(rel => ({
          source: rel.source,
          target: rel.target,
          distance: rel.distance || 80
        }));
  
        // Create a bubble div for each node
        // Keep references so we can move them on tick
        const nodeElems = nodes.map((node) => {
          const bubble = document.createElement("div");
          bubble.className = "skill-bubble";
  
          // Use a random color or a gradient
          const colors = [
            "#e74c3c", "#3498db", "#2ecc71", "#f1c40f",
            "#9b59b6", "#e67e22", "#1abc9c"
          ];
          // pick a color
          const color = colors[Math.floor(Math.random() * colors.length)];
          bubble.style.background = color;
  
          // set width/height
          const diameter = node.radius * 2;
          bubble.style.width = diameter + "px";
          bubble.style.height = diameter + "px";
  
          // text
          const span = document.createElement("span");
          span.textContent = node.skill.name;
          bubble.appendChild(span);
  
          // Optional: on click, show skill details in a console.log
          bubble.addEventListener("click", () => {
            console.log("Clicked skill:", node.skill.fullName);
            // Here you could display more info in a modal, etc.
          });
  
          container.appendChild(bubble);
          return { nodeData: node, htmlElem: bubble };
        });
  
        // The D3 force simulation
        const sim = d3.forceSimulation(nodes)
          .force("center", d3.forceCenter(container.offsetWidth / 2, container.offsetHeight / 2))
          // Gentle repulsion so bubbles push apart
          .force("charge", d3.forceManyBody().strength(50))
          // Avoid collisions
          .force("collision", d3.forceCollide().radius(d => d.radius + 30))
          // Link relationships
          .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance(d => d.distance) // each link has its own distance
          )
          .on("tick", ticked);
  
        function ticked() {
          // Move each bubble to the updated x, y
          nodeElems.forEach(({ nodeData, htmlElem }) => {
            // Center each bubble on node.x, node.y
            const x = nodeData.x - nodeData.radius;
            const y = nodeData.y - nodeData.radius;
            htmlElem.style.left = x + "px";
            htmlElem.style.top = y + "px";
          });
        }
      })
      .catch(err => {
        console.error("Failed to load skills.json:", err);
      });
  });
  