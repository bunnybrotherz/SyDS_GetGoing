var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/youth.png",
  adult: "images/adult.png",
  elderly: "images/elderly.png",
  disabled: "images/disabled.png",
  helper: "images/first-aider.png" // Single helper type now
};

var simTimer;
var countdownTimer;
var helperSpawnTimer;
var isRunning = false;
var timer = 30;
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, helper: 0 };
var savedByHelpType = { packing: 0, first_aid: 0 }; // Track victims saved by help needed
var perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

// Add a global speed variable
var speedMultiplier = 1.0;

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var agents = [];

// Helper spawn rate (in seconds)
var helperSpawnRate = 5;

// Ratio of victims to helpers (1:1 by default)
var victimToHelperRatio = 2;

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 0.6,    // Faster than adults
  adult: 0.5,    // Normal speed
  elderly: 0.2,  // Much slower
  disabled: 0.1, // Even slower
  helper: 0.5    // Helpers are fast
};

// Add this to the top section where variables are defined
var totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
var totalByHelpNeeded = { packing: 0, first_aid: 0 }; // Track total victims by help needed

// Tolerance for reaching the goal (to prevent bouncing)
// FIXED: Increased epsilon to reduce bouncing
const epsilon = 0.5;

// Function to calculate distance between two agents
function calculateDistance(agent1, agent2) {
  return Math.sqrt(
    Math.pow(agent1.row - agent2.row, 2) + 
    Math.pow(agent1.col - agent2.col, 2)
  );
}

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

// Function to render the goal point
function renderGoal() {
  surface.selectAll("image.goal").remove();
  
  surface.append("image")
    .attr("class", "goal")
    .attr("xlink:href", "images/floodshelter.png")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", getPixelCoord(goal).x)
    .attr("y", getPixelCoord(goal).y);
}

function updateAgents() {
  const now = Date.now();

  agents.forEach((agent) => {
    if (agent.reachedGoal) {
      // NEW: Check if helper can be redeployed
      if (agent.isHelper && !agent.stayingAtGoal) {
        // Check if less than 10 seconds remain
        if (timer <= 5) {
          agent.stayingAtGoal = true; // Helper stays at goal
          console.log(`Helper staying at goal - less than 10s remaining`);
        } else {
          // Find unassigned victims
          const unassignedVictims = agents.filter(a => 
            a.isVictim && !a.reachedGoal && !a.assignedHelper
          );
          
          if (unassignedVictims.length > 0) {
            // Reset helper's status
            agent.reachedGoal = false;
            agent.waitingSince = null;
            agent.counted = false;
            
            // Find closest victim
            const potentialVictims = unassignedVictims.map(victim => {
              return {
                victim: victim,
                distance: calculateDistance(agent, victim)
              };
            });
            
            potentialVictims.sort((a, b) => a.distance - b.distance);
            const targetVictim = potentialVictims[0].victim;
            
            // Assign helper to victim
            agent.assignedVictim = targetVictim;
            targetVictim.assignedHelper = agent;
            
            console.log(`Helper redeployed to help ${targetVictim.type} victim`);
          }
        }
      }
      return;
    }
    
    if (agent.isHelper && agent.assignedVictim) {
      // Skip if victim already reached goal
      if (agent.assignedVictim.reachedGoal) {
        agent.reachedGoal = true;
        return;
      }
      
      const reachedVictim = Math.abs(agent.row - agent.assignedVictim.row) <= epsilon * 2 &&
                            Math.abs(agent.col - agent.assignedVictim.col) <= epsilon * 2;

      if (!reachedVictim) {
        moveTowards(agent, agent.assignedVictim);
      } else {
        if (!agent.waitingSince) {
          agent.waitingSince = now;
          console.log(`Helper reached victim ${agent.assignedVictim.type} and started waiting`);
        }

        // FIXED: Single wait duration now based on help needed
        let waitDuration = 0;
        if (agent.assignedVictim.helpNeeded === 'packing') {
          waitDuration = 2000; // Time for packing help
        } else if (agent.assignedVictim.helpNeeded === 'first_aid') {
          waitDuration = 1000; // Time for first aid help
        }

        if (now - agent.waitingSince >= waitDuration) {
          moveToGoal(agent, agent.assignedVictim);
        }
      }
    }
  });
}

function moveTowards(agent, target) {
  let speed = victimSpeeds[agent.type] || 1.0;
  
  // Apply global speed multiplier
  speed *= speedMultiplier;
  
  // FIXED: Improved tolerance check to prevent bouncing
  if (Math.abs(target.col - agent.col) <= epsilon * 2 && 
      Math.abs(target.row - agent.row) <= epsilon * 2) {
    // If very close, just snap directly to target position
    agent.col = target.col;
    agent.row = target.row;
    return;
  }
  
  // Otherwise, move toward the target
  if (Math.abs(target.col - agent.col) <= epsilon) {
    agent.col = target.col; // Snap to exact position
  } else {
    let moveX = Math.sign(target.col - agent.col) * speed * 0.1; // Reduce speed when approaching
    agent.col += moveX;
  }

  if (Math.abs(target.row - agent.row) <= epsilon) {
    agent.row = target.row; // Snap to exact position
  } else {
    let moveY = Math.sign(target.row - agent.row) * speed * 0.1; // Reduce speed when approaching
    agent.row += moveY;
  }
}

// FIXED: Improved moveToGoal to prevent bouncing
function moveToGoal(helper, victim) {
  // Check if already very close to goal - if so, snap to exact position and mark as reached
  if (Math.abs(goal.col - victim.col) <= epsilon && Math.abs(goal.row - victim.row) <= epsilon) {
    // Snap exactly to goal position
    victim.col = goal.col;
    victim.row = goal.row;
    helper.col = goal.col;
    helper.row = goal.row;
    
    // Mark both as having reached goal
    victim.reachedGoal = true;
    helper.reachedGoal = true;
    
    // Update saved count if not already counted
    if (!victim.counted) {
      savedCount[victim.type]++;
      savedCount['helper']++; // Single helper type now
      
      // Track victims saved by help needed type
      savedByHelpType[victim.helpNeeded]++;
      
      victim.counted = true;
      helper.counted = true;
      console.log(`Helper and victim ${victim.type} reached goal and were counted (needed ${victim.helpNeeded})`);
    }
    
    return;
  }
  
  let speed = victimSpeeds[victim.type];
  
  // Apply global speed multiplier
  speed *= speedMultiplier;
  
  if (Math.abs(goal.col - victim.col) > epsilon) {
    let moveX = Math.sign(goal.col - victim.col) * speed * 0.1;
    victim.col += moveX;
    helper.col = victim.col;
  }

  if (Math.abs(goal.row - victim.row) > epsilon) {
    let moveY = Math.sign(goal.row - victim.row) * speed * 0.1;
    victim.row += moveY;
    helper.row = victim.row;
  }
}

function getRandomAgentType() {
  const rand = Math.random();
  if (rand < (1 / (1 + victimToHelperRatio))) {
    return 'helper'; // Only one helper type now
  } else {
    return getRandomVictimType();
  }
}

function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.9) return 'elderly';
  return 'disabled';
}

// function spawnNewHelpers() {
//   if (!isRunning) return;
  
//   // More random: Generate helpers based on a probability distribution
//   // 60% chance: 1 helper, 30% chance: 2 helpers, 10% chance: 3-4 helpers
//   const rand = Math.random();
//   let helpersToSpawn = 1; // Default
  
//   if (rand > 0.6 && rand <= 0.9) {
//     helpersToSpawn = 2;
//   } else if (rand > 0.9) {
//     helpersToSpawn = Math.floor(Math.random() * 2) + 3; // 3-4 helpers
//   }
  
//   console.log(`Spawning ${helpersToSpawn} new helpers`);
  
//   // Also make timing more random by adjusting the next spawn interval
//   const variableFactor = 0.5 + Math.random(); // Between 0.5 and 1.5
//   const nextSpawnInterval = helperSpawnRate * 1000 / speedMultiplier * variableFactor;
  
//   // Store the newly spawned helpers
//   const newHelpers = [];
  
//   // Get all unassigned victims once to optimize
//   const unassignedVictims = agents.filter(a => 
//     a.isVictim && !a.reachedGoal && !a.assignedHelper
//   );
  
//   // Create the requested number of helpers
//   for (let i = 0; i < helpersToSpawn; i++) {
//     const simulationSvg = document.getElementById("surface");
//     const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
//     const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
    
//     // Single helper type now
//     const helper = {
//       row: Math.floor(Math.random() * maxRows) + 1,
//       col: Math.floor(Math.random() * maxCols) + 1,
//       type: 'helper',
//       isHelper: true,
//       reachedGoal: false
//     };
    
//     // Make sure helpers don't spawn on the goal
//     if (helper.row === goal.row && helper.col === goal.col) {
//       helper.row = helper.row > 1 ? helper.row - 1 : helper.row + 1;
//     }
    
//     newHelpers.push(helper);
//   }
  
//   // If we have unassigned victims, assign them to our new helpers based on distance
//   if (unassignedVictims.length > 0) {
//     // For each helper, find the nearest victim
//     newHelpers.forEach(helper => {
//       // Skip if no unassigned victims left
//       if (unassignedVictims.length === 0) return;
      
//       // Calculate distances
//       const potentialVictims = unassignedVictims.map(victim => {
//         return {
//           victim: victim,
//           distance: calculateDistance(helper, victim)
//         };
//       });
      
//       // Sort by distance
//       potentialVictims.sort((a, b) => a.distance - b.distance);
      
//       // Assign this helper to the nearest victim
//       const targetVictim = potentialVictims[0].victim;
//       helper.assignedVictim = targetVictim;
//       targetVictim.assignedHelper = helper;
      
//       // Remove the assigned victim from the unassigned list
//       const index = unassignedVictims.indexOf(targetVictim);
//       if (index > -1) {
//         unassignedVictims.splice(index, 1);
//       }
      
//       // Add helper to the agents array
//       agents.push(helper);
      
//       console.log(`New helper spawned and assigned to ${targetVictim.type} victim needing ${targetVictim.helpNeeded} (distance: ${potentialVictims[0].distance.toFixed(2)})`);
//     });
//   }
  
//   // Reset the timer with variable timing
//   if (isRunning) {
//     clearInterval(helperSpawnTimer);
//     helperSpawnTimer = setTimeout(() => {
//       spawnNewHelpers();
//     }, nextSpawnInterval);
//   }
// }

// // Modified function to start the helper spawn timer with initial random delay
// function startHelperSpawnTimer() {
//   // Initial random delay between 1-3 seconds (adjusted for speed)
//   const initialDelay = (1000 + Math.random() * 2000) / speedMultiplier;
  
//   helperSpawnTimer = setTimeout(() => {
//     spawnNewHelpers(); // Initial call to the spawn function
//   }, initialDelay);
// }

// Start simulation function remains mostly the same
function startSim() {
  if (isRunning) {
    // Update based on speed - faster speed means more frequent updates
    const baseInterval = 100;
    const interval = baseInterval / speedMultiplier;
    simTimer = setInterval(simStep, interval);
    
    // // Start spawning helpers with randomized timing
    // startHelperSpawnTimer();
  }
}

// Also update the stop/cleanup function to handle setTimeout properly
function cleanupTimers() {
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  // clearTimeout(helperSpawnTimer);
  isRunning = false;
}

// Update the test button event listener to use 30 agents
document.getElementById("start-button").addEventListener("click", () => {
  cleanupTimers();
  timer = 30;
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, helper: 0 };
  savedByHelpType = { packing: 0, first_aid: 0 }; // Reset help type stats
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  totalByHelpNeeded = { packing: 0, first_aid: 0 }; // Reset help needed totals
  
  agents = generateRandomAgents(30);
  logAssignmentDetails();
  renderGoal();
  renderAgents();
  updateCounters();
});

function simStep() {
  if (!isRunning) return;
  updateAgents();
  renderAgents();
  renderGoal();
  updateCounters();
}

// Function to generate random agents - modified for single helper type
function generateRandomAgents(count) {
  // Use the simulation area dimensions instead of window dimensions
  const simulationSvg = document.getElementById("surface");
  const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
  const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
  
  const agents = [];

  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;
  
  console.log(`Generating ${helpersCount} helpers and ${victimsCount} victims`);

  const helpers = [];
  for (let i = 0; i < helpersCount; i++) {
    let row = Math.floor(Math.random() * maxRows) + 1;
    let col = Math.floor(Math.random() * maxCols) + 1;
    
    // Make sure helpers don't spawn on the goal
    if (row === goal.row && col === goal.col) {
      row = row > 1 ? row - 1 : row + 1;
    }
    
    const helper = {
      row: row,
      col: col,
      type: 'helper', // Single type of helper
      isHelper: true,
      reachedGoal: false
    };
    helpers.push(helper);
    agents.push(helper);
  }
  
  // Reset total counts
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  totalByHelpNeeded = { packing: 0, first_aid: 0 };

  const victims = [];
  for (let i = 0; i < victimsCount; i++) {
    const victimType = getRandomVictimType();
    totalAgentsByType[victimType]++;
    
    // Make sure victims don't spawn on the goal
    let row, col;
    do {
      row = Math.floor(Math.random() * maxRows) + 1;
      col = Math.floor(Math.random() * maxCols) + 1;
    } while (row === goal.row && col === goal.col);
    
    // Determine which type of help this victim needs (packing or first aid)
    // Different victim types might have different probabilities of needing each type of help
    let helpNeeded;
    if (victimType === 'disabled' || victimType === 'elderly') {
      // Elderly and disabled people more likely to need first aid
      helpNeeded = Math.random() < 0.7 ? 'first_aid' : 'packing';
    } else if (victimType === 'youth') {
      // Youth more likely to need packing help
      helpNeeded = Math.random() < 0.7 ? 'packing' : 'first_aid';
    } else {
      // Adults have equal chance
      helpNeeded = Math.random() < 0.5 ? 'packing' : 'first_aid';
    }
    
    // Increment help needed counter
    totalByHelpNeeded[helpNeeded]++;
    
    const victim = {
      row: row,
      col: col,
      type: victimType,
      isVictim: true,
      reachedGoal: false,
      helpNeeded: helpNeeded
    };
    victims.push(victim);
    agents.push(victim);
  }

  // Handle helper assignment (simplified since there's only one helper type)
  // Assign helpers to victims based on proximity
  for (let i = 0; i < helpers.length; i++) {
    const helper = helpers[i];
    
    // Skip if no victims left
    if (victims.length === 0) continue;
    
    // Calculate distances from this helper to all victims
    const victimDistances = victims.map(victim => {
      return {
        victim: victim,
        distance: calculateDistance(helper, victim)
      };
    });
    
    // Sort by distance (nearest first)
    victimDistances.sort((a, b) => a.distance - b.distance);
    
    // Assign this helper to the nearest victim
    const nearestVictim = victimDistances[0].victim;
    helper.assignedVictim = nearestVictim;
    nearestVictim.assignedHelper = helper;
    
    // Remove the assigned victim from the available pool
    const index = victims.indexOf(nearestVictim);
    if (index > -1) {
      victims.splice(index, 1);
    }
    
    console.log(`Assigned helper to ${nearestVictim.type} victim (distance: ${victimDistances[0].distance.toFixed(2)})`);
  }

  return agents;
}

// Update the calculatePerished function for single helper type
function calculatePerished() {
  // Reset perished count
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, helper: 0 };
  
  // Find all victims who didn't reach the goal
  agents.filter(a => a.isVictim && !a.reachedGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });

  // Also count helpers who didn't reach the goal
  agents.filter(a => a.isHelper && !a.reachedGoal).forEach(helper => {
    perishedCount.helper++;
  });
  
  return perishedCount;
}

// Updated to show visual indicators with single helper type
function renderAgents() {
  surface.selectAll("image.agent").remove();
  surface.selectAll("circle.helper-indicator").remove(); 
  surface.selectAll("circle.victim-indicator").remove();
  surface.selectAll("line.assignment").remove();
  
  // Draw lines between helpers and their assigned victims (only for those still moving)
  surface.selectAll("line.assignment")
    .data(agents.filter(agent => agent.isHelper && !agent.reachedGoal && agent.assignedVictim && !agent.assignedVictim.reachedGoal))
    .enter()
    .append("line")
    .attr("class", "assignment")
    .attr("x1", d => (d.col - 0.5) * cellSize)
    .attr("y1", d => (d.row - 0.5) * cellSize)
    .attr("x2", d => (d.assignedVictim.col - 0.5) * cellSize)
    .attr("y2", d => (d.assignedVictim.row - 0.5) * cellSize)
    .attr("stroke", "rgba(100, 100, 100, 0.7)") // Gray line for all helpers
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "5,3"); // Dashed line for better visibility
    
  // Draw victim need indicators
  surface.selectAll("circle.victim-indicator")
    .data(agents.filter(agent => agent.isVictim && !agent.reachedGoal))
    .enter()
    .append("circle")
    .attr("class", "victim-indicator")
    .attr("cx", d => (d.col - 0.5) * cellSize)
    .attr("cy", d => (d.row - 0.5) * cellSize)
    .attr("r", cellSize / 3)  // Smaller than helper indicators
    .attr("fill", "none")  // Transparent fill
    .attr("stroke", d => {
      // Color based on help needed
      if (d.helpNeeded === "packing") return "rgba(54, 162, 235, 0.9)";  // Blue border for packing
      else return "rgba(255, 99, 132, 0.9)";  // Red border for first aid
    })
    .attr("stroke-width", 3);

  // Render helpers first so they appear behind victims
  surface.selectAll("image.helper")
    .data(agents.filter(agent => agent.isHelper && !agent.reachedGoal))
    .enter()
    .append("image")
    .attr("class", "agent helper")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => (d.col - 1) * cellSize)
    .attr("y", d => (d.row - 1) * cellSize);
    
  // Then render victims on top
  surface.selectAll("image.victim")
    .data(agents.filter(agent => agent.isVictim && !agent.reachedGoal))
    .enter()
    .append("image")
    .attr("class", "agent victim")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => (d.col - 1) * cellSize)
    .attr("y", d => (d.row - 1) * cellSize);
}

// Update logAssignmentDetails for single helper type
function logAssignmentDetails() {
  console.log("=== VICTIM TYPE DISTRIBUTION ===");
  console.log(`Youth victims: ${agents.filter(a => a.isVictim && a.type === 'youth').length}`);
  console.log(`Adult victims: ${agents.filter(a => a.isVictim && a.type === 'adult').length}`);
  console.log(`Elderly victims: ${agents.filter(a => a.isVictim && a.type === 'elderly').length}`);
  console.log(`Disabled victims: ${agents.filter(a => a.isVictim && a.type === 'disabled').length}`);
  
  console.log("=== HELP NEEDED DISTRIBUTION ===");
  console.log(`Victims needing packing help: ${agents.filter(a => a.isVictim && a.helpNeeded === 'packing').length}`);
  console.log(`Victims needing first aid: ${agents.filter(a => a.isVictim && a.helpNeeded === 'first_aid').length}`);
  
  console.log("=== HELPER COUNT ===");
  console.log(`Total helpers: ${agents.filter(a => a.isHelper).length}`);
  
  console.log("=== ASSIGNMENT DETAILS ===");
  const helpers = agents.filter(a => a.isHelper);
  helpers.forEach((helper, index) => {
    if (helper.assignedVictim) {
      const distance = calculateDistance(helper, helper.assignedVictim).toFixed(2);
      console.log(`Helper ${index+1} → Victim type: ${helper.assignedVictim.type}, Needs: ${helper.assignedVictim.helpNeeded}, Distance: ${distance}`);
    } else {
      console.log(`Helper ${index+1} → No victim assigned`);
    }
  });
  
  // Check for victims without helpers and log their needs
  const victimsWithoutHelpers = agents.filter(a => a.isVictim && !a.assignedHelper);
  if (victimsWithoutHelpers.length > 0) {
    console.warn(`WARNING: ${victimsWithoutHelpers.length} victims don't have helpers!`);
    victimsWithoutHelpers.forEach((victim, idx) => {
      console.warn(`- Victim ${idx+1} (${victim.type}) needs ${victim.helpNeeded} help`);
    });
  }
}

// UPDATED: Show help needed type stats instead of helper type stats
function updateCounters() {
  const totalVictims = agents.filter(a => a.isVictim).length;
  const savedVictims = agents.filter(a => a.isVictim && a.reachedGoal).length;
  
  // Update stat boxes with saved counts
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `PWD Saved: ${savedCount.disabled}`;
  
  // Update helper stats - now showing help needed types
  document.getElementById('packing-count').textContent = `Packing Victims: ${savedByHelpType.packing}`;
  document.getElementById('first-aider-count').textContent = `First Aid Victims: ${savedByHelpType.first_aid}`;
  document.getElementById('timer-count').textContent = `Time: ${timer}s`;
  
  // Update progress bars to show victims by help needed type
  const packingVictims = {
    saved: savedByHelpType.packing,
    total: totalByHelpNeeded.packing
  };
  
  const firstAidVictims = {
    saved: savedByHelpType.first_aid,
    total: totalByHelpNeeded.first_aid
  };
  
  document.getElementById('urgency-stats').innerHTML = `
    <div class="urgency-progress">
      <div>Victims Saved: ${savedVictims}/${totalVictims} (${totalVictims > 0 ? Math.round(savedVictims/totalVictims*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill high-fill" style="width: ${totalVictims > 0 ? Math.round(savedVictims/totalVictims*100) : 0}%"></div>
      </div>
    </div>
  `;
}

// Add a function to handle slider changes
function updateSpeed() {
  const speedMap = [0.25, 0.5, 1, 2, 4];
  speedMultiplier = speedMap[parseInt(document.getElementById("slider1").value)];
  
  // If simulation is already running, restart it with new speed
  if (isRunning) {
    clearInterval(simTimer);
    clearTimeout(helperSpawnTimer); // Changed from clearInterval
    startSim();
  }
}

// Update the setupCanvas function to initialize with 30 agents
function setupCanvas() {
  try {
    // Check if d3 is defined
    if (typeof d3 === 'undefined') {
      console.error('D3 library is not loaded. Please include the D3.js library in your HTML.');
      
      // Create a fallback error message
      const simulationArea = document.querySelector(".simulation-area");
      simulationArea.innerHTML = '<div style="color:red; padding:20px;">Error: D3.js library is not loaded. Please add <code>&lt;script src="https://d3js.org/d3.v7.min.js"&gt;&lt;/script&gt;</code> to your HTML before this script.</div>';
      return;
    }
    
    // Use dimensions from the SVG in the HTML structure
    const simulationSvg = document.getElementById("surface");
    
    surface = d3.select("#surface");
    
    agents = generateRandomAgents(30);
        
    logAssignmentDetails();
        
    // Directly attach event listeners to HTML elements
    document.getElementById("slider1").addEventListener("input", updateSpeed);
        
    // Initialize speed multiplier
    updateSpeed();
    
    document.getElementById("start-button").addEventListener("click", () => {
      isRunning = true;
      startSim();
      startTimer();
    });
        
    renderGoal();
    renderAgents();
    updateCounters();
      } catch (error) {
        console.error('Error in setupCanvas:', error);
        const simulationArea = document.querySelector(".simulation-area");
        simulationArea.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
      }
    }
    
    // UPDATED: New results modal format with victim data by help type
    function showResults() {
      cleanupTimers();
      
      // Calculate perished people
      const perished = calculatePerished();
      
      const results = {
        youth: savedCount.youth,
        adult: savedCount.adult,
        elderly: savedCount.elderly,
        disabled: savedCount.disabled,
        helper: savedCount.helper
      };
      
      // Create modal
      const modalOverlay = document.createElement('div');
      modalOverlay.style.position = 'fixed';
      modalOverlay.style.top = '0';
      modalOverlay.style.left = '0';
      modalOverlay.style.width = '100%';
      modalOverlay.style.height = '100%';
      modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      modalOverlay.style.display = 'flex';
      modalOverlay.style.justifyContent = 'center';
      modalOverlay.style.alignItems = 'center';
      modalOverlay.style.zIndex = '1000';
      
      const modalContent = document.createElement('div');
      modalContent.style.backgroundColor = 'white';
      modalContent.style.padding = '30px';
      modalContent.style.borderRadius = '10px';
      modalContent.style.maxWidth = '500px';
      modalContent.style.width = '80%';
      modalContent.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
      modalContent.style.maxHeight = '80vh'; // Limit height
      modalContent.style.overflowY = 'auto'; // Enable vertical scroll
      
      let modalHTML = `
        <h2 style="color:#2c3e50; margin-top:0;">Simulation Results</h2>
        <h3 style="color:#2c3e50;">Victims Saved by Type</h3>
        <div class="result-category">
          <div class="result-label">Youth: ${results.youth}/${totalAgentsByType.youth || 0}</div>
          <div class="result-bar-container">
            <div class="result-bar youth-bar" style="width: ${totalAgentsByType.youth > 0 ? Math.round((results.youth/totalAgentsByType.youth)*100) : 0}%"></div>
          </div>
          <div class="result-percentage">${totalAgentsByType.youth > 0 ? Math.round((results.youth/totalAgentsByType.youth)*100) : 0}%</div>
        </div>
        <div class="result-category">
          <div class="result-label">Adults: ${results.adult}/${totalAgentsByType.adult || 0}</div>
          <div class="result-bar-container">
            <div class="result-bar adult-bar" style="width: ${totalAgentsByType.adult > 0 ? Math.round((results.adult/totalAgentsByType.adult)*100) : 0}%"></div>
          </div>
          <div class="result-percentage">${totalAgentsByType.adult > 0 ? Math.round((results.adult/totalAgentsByType.adult)*100) : 0}%</div>
        </div>
        <div class="result-category">
          <div class="result-label">Elderly: ${results.elderly}/${totalAgentsByType.elderly || 0}</div>
          <div class="result-bar-container">
            <div class="result-bar elderly-bar" style="width: ${totalAgentsByType.elderly > 0 ? Math.round((results.elderly/totalAgentsByType.elderly)*100) : 0}%"></div>
          </div>
          <div class="result-percentage">${totalAgentsByType.elderly > 0 ? Math.round((results.elderly/totalAgentsByType.elderly)*100) : 0}%</div>
        </div>
        <div class="result-category">
          <div class="result-label">PWD: ${results.disabled}/${totalAgentsByType.disabled || 0}</div>
          <div class="result-bar-container">
            <div class="result-bar pwd-bar" style="width: ${totalAgentsByType.disabled > 0 ? Math.round((results.disabled/totalAgentsByType.disabled)*100) : 0}%"></div>
          </div>
          <div class="result-percentage">${totalAgentsByType.disabled > 0 ? Math.round((results.disabled/totalAgentsByType.disabled)*100) : 0}%</div>
        </div>
        <div class="result-divider"></div>
        <style>
          .result-category {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }
          .result-label {
            width: 120px;
            font-weight: 500;
          }
          .result-bar-container {
            flex-grow: 1;
            height: 18px;
            background-color: #f0f0f0;
            border-radius: 9px;
            margin: 0 15px;
            overflow: hidden;
          }
          .result-bar {
            height: 100%;
            border-radius: 9px;
          }
          .youth-bar {
            background-color: #ff6384;
          }
          .adult-bar {
            background-color: #ff9f40;
          }
          .elderly-bar {
            background-color: #4bc0c0;
          }
          .pwd-bar {
            background-color: #9966ff;
          }
          .total-bar {
            background-color: #36a2eb;
          }
          .result-percentage {
            width: 50px;
            text-align: right;
            font-weight: bold;
          }
          .result-divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 20px 0;
          }
          .total-result {
            font-size: 1.1em;
          }
        </style>
      `;
    
      // Add help type progress bars
      const packingPercentage = totalByHelpNeeded.packing > 0 ? 
        Math.round(savedByHelpType.packing/totalByHelpNeeded.packing*100) : 0;
      
      const firstAidPercentage = totalByHelpNeeded.first_aid > 0 ? 
        Math.round(savedByHelpType.first_aid/totalByHelpNeeded.first_aid*100) : 0;
    
      // modalHTML += `
      //   <div class="urgency-progress">
      //     <div>Packing Victims: ${savedByHelpType.packing}/${totalByHelpNeeded.packing} (${packingPercentage}%)</div>
      //     <div class="progress-bar">
      //       <div class="progress-fill" style="width: ${packingPercentage}%; background-color: rgba(54, 162, 235, 0.7);"></div>
      //     </div>
      //   </div>
      //   <div class="urgency-progress">
      //     <div>First Aid Victims: ${savedByHelpType.first_aid}/${totalByHelpNeeded.first_aid} (${firstAidPercentage}%)</div>
      //     <div class="progress-bar">
      //       <div class="progress-fill" style="width: ${firstAidPercentage}%; background-color: rgba(255, 99, 132, 0.7);"></div>
      //     </div>
      //   </div>
      //   <div class="result-divider"></div>
      // `;
    
      // Add total saved section
      const totalVictims = Object.values(totalAgentsByType).reduce((a, b) => a + b, 0);
      const totalSaved = Object.values(results).reduce((a, b) => a + b, 0) - results.helper;
      const totalPercentage = totalVictims > 0 ? Math.round((totalSaved/totalVictims)*100) : 0;
    
      modalHTML += `
        <div class="result-category total-result">
          <div class="result-label">Total Saved: ${totalSaved}/${totalVictims}</div>
          <div class="result-bar-container">
            <div class="result-bar total-bar" style="width: ${totalPercentage}%"></div>
          </div>
          <div class="result-percentage">${totalPercentage}%</div>
        </div>
        <button id="close-modal" class="btn btn-primary" style="margin-top:20px;">Close</button>
      `;
      
      modalContent.innerHTML = modalHTML;
      modalOverlay.appendChild(modalContent);
      document.body.appendChild(modalOverlay);
      
      document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
      });
    }
    
    // Update the startTimer function to use showResults instead of alert
    function startTimer() {
      let adjustedTimer = timer / speedMultiplier;
      
      countdownTimer = setInterval(() => {
        if (adjustedTimer > 0) {
          adjustedTimer--;
          timer = Math.ceil(adjustedTimer);
          updateCounters();
        } else {
          clearInterval(countdownTimer);
          isRunning = false;
          clearInterval(simTimer);
          
          // Show results with our new UI
          showResults();
        }
      }, 1000);
    }
    
    // Initialize the simulation when the page loads
    window.onload = setupCanvas;