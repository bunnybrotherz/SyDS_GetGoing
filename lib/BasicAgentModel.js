var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/youth.png",
  adult: "images/adult.png",
  elderly: "images/elderly.png",
  disabled: "images/disabled.png",
  packing: "images/packing.png",
  first_aider: "images/first-aider.png"
};

var simTimer;
var countdownTimer;
var helperSpawnTimer; // New timer for spawning helpers
var isRunning = false;
var timer = 30;
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };

// Add a global speed variable
var speedMultiplier = 1.0;

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var agents = [];

// Helper spawn rate (in seconds)
var helperSpawnRate = 5;

// Ratio of victims to helpers (1:1 by default)
var victimToHelperRatio = 2;

// Speed multipliers for different victim types - Made speed difference more pronounced
var victimSpeeds = {
  youth: 1.2,    // Faster than adults
  adult: 1.0,    // Normal speed
  elderly: 0.4,  // Much slower than before
  disabled: 0.3, // Even slower
  packing: 1.2,  // Helpers are fast
  first_aider: 1.2
};

// Add urgency levels to victim types
var urgencyLevels = {
  youth: 2,    // Medium urgency
  adult: 3,    // Low urgency
  elderly: 1,  // High urgency
  disabled: 1  // High urgency
};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.2;

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

// Function to update the positions of the agents
function updateAgents() {
  const now = Date.now();

  agents.forEach((agent) => {
    if (agent.reachedGoal) return;
    
    if (agent.isHelper && agent.assignedVictim && !agent.assignedVictim.reachedGoal) {
      const reachedVictim = Math.abs(agent.row - agent.assignedVictim.row) <= epsilon &&
                            Math.abs(agent.col - agent.assignedVictim.col) <= epsilon;

      if (!reachedVictim) {
        moveTowards(agent, agent.assignedVictim);
      } else {
        if (!agent.waitingSince) {
          agent.waitingSince = now;
          console.log(`Helper ${agent.type} reached victim ${agent.assignedVictim.type} and started waiting`);
        }

        let waitDuration = 0;
        if (agent.type === 'packing') {
          waitDuration = 20000;
        } else if (agent.type === 'first_aider') {
          waitDuration = 10000;
        }

        if (now - agent.waitingSince >= waitDuration) {
          moveToGoal(agent, agent.assignedVictim);
          
          const reachedGoal = Math.abs(agent.assignedVictim.row - goal.row) <= epsilon &&
                            Math.abs(agent.assignedVictim.col - goal.col) <= epsilon;
          
          if (reachedGoal) {
            console.log(`Helper ${agent.type} and victim ${agent.assignedVictim.type} reached goal`);
            savedCount[agent.type]++;
            savedCount[agent.assignedVictim.type]++;
            agent.reachedGoal = true;
            agent.assignedVictim.reachedGoal = true;
          }
        }
      }
    }
  });
}

function moveTowards(agent, target) {
  let speed = victimSpeeds[agent.type] || 1.0;
  
  // Apply global speed multiplier
  speed *= speedMultiplier;
  
  // Check if we're already very close to the target
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


function moveToGoal(helper, victim) {
  let speed = victimSpeeds[victim.type];
  
  console.log(`Moving ${victim.type} victim to goal at speed ${speed}`);
  
  if (Math.abs(goal.col - victim.col) > epsilon) {
    let moveX = Math.sign(goal.col - victim.col) * speed;
    victim.col += moveX;
    helper.col = victim.col;
  }

  if (Math.abs(goal.row - victim.row) > epsilon) {
    let moveY = Math.sign(goal.row - victim.row) * speed;
    victim.row += moveY;
    helper.row = victim.row;
  }
}

function getRandomAgentType() {
  const rand = Math.random();
  if (rand < (1 / (1 + victimToHelperRatio))) {
    return getRandomHelperType();
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

function getRandomHelperType() {
  const rand = Math.random();
  if (rand < 0.5) return 'packing';
  return 'first_aider';
}

// Modified function to spawn a random number of helpers with more randomness
function spawnNewHelpers() {
  if (!isRunning) return;
  
  // More random: Generate helpers based on a probability distribution
  // 60% chance: 1 helper, 30% chance: 2 helpers, 10% chance: 3-4 helpers
  const rand = Math.random();
  let helpersToSpawn = 1; // Default
  
  if (rand > 0.6 && rand <= 0.9) {
    helpersToSpawn = 2;
  } else if (rand > 0.9) {
    helpersToSpawn = Math.floor(Math.random() * 2) + 3; // 3-4 helpers
  }
  
  console.log(`Spawning ${helpersToSpawn} new helpers`);
  
  // Also make timing more random by adjusting the next spawn interval
  const variableFactor = 0.5 + Math.random(); // Between 0.5 and 1.5
  const nextSpawnInterval = helperSpawnRate * 1000 / speedMultiplier * variableFactor;
  
  // Store the newly spawned helpers
  const newHelpers = [];
  
  // Get all unassigned victims once to optimize
  const unassignedVictims = agents.filter(a => 
    a.isVictim && !a.reachedGoal && !a.assignedHelper
  );
  
  // Create the requested number of helpers
  for (let i = 0; i < helpersToSpawn; i++) {
    const simulationSvg = document.getElementById("surface");
    const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
    const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
    
    // Randomize helper type following the same distribution logic
    const helper = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    
    newHelpers.push(helper);
  }
  
  // If we have unassigned victims, assign them to our new helpers using 
  // the same priority and distance logic from the original helper assignment
  if (unassignedVictims.length > 0) {
    // For each helper, find the best victim using urgency level and distance
    newHelpers.forEach(helper => {
      // Skip if no unassigned victims left
      if (unassignedVictims.length === 0) return;
      
      // Calculate distances and urgency for all remaining unassigned victims
      const potentialVictims = unassignedVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim),
          urgencyLevel: victim.urgencyLevel
        };
      });
      
      // Sort by urgency level (lower number = higher priority)
      // If same urgency, prioritize by distance (same as original logic)
      potentialVictims.sort((a, b) => {
        if (a.urgencyLevel !== b.urgencyLevel) {
          return a.urgencyLevel - b.urgencyLevel;
        }
        return a.distance - b.distance;
      });
      
      // Assign this helper to the highest priority victim
      const targetVictim = potentialVictims[0].victim;
      helper.assignedVictim = targetVictim;
      targetVictim.assignedHelper = helper;
      
      // Remove the assigned victim from the unassigned list
      const index = unassignedVictims.indexOf(targetVictim);
      if (index > -1) {
        unassignedVictims.splice(index, 1);
      }
      
      // Add helper to the agents array
      agents.push(helper);
      
      console.log(`New ${helper.type} helper spawned and assigned to ${targetVictim.type} victim (urgency: ${targetVictim.urgencyLevel}, distance: ${potentialVictims[0].distance.toFixed(2)})`);
    });
    
    // Re-render agents to show all the new helpers at once
    renderAgents();
  } else {
    console.log("No unassigned victims available for new helpers");
  }
  
  // Reset the timer with variable timing
  if (isRunning) {
    clearInterval(helperSpawnTimer);
    helperSpawnTimer = setTimeout(() => {
      spawnNewHelpers();
    }, nextSpawnInterval);
  }
}

// Modified function to start the helper spawn timer with initial random delay
function startHelperSpawnTimer() {
  // Initial random delay between 1-3 seconds (adjusted for speed)
  const initialDelay = (1000 + Math.random() * 2000) / speedMultiplier;
  
  helperSpawnTimer = setTimeout(() => {
    spawnNewHelpers(); // Initial call to the spawn function
  }, initialDelay);
}

// Start simulation function remains mostly the same
function startSim() {
  if (isRunning) {
    // Update based on speed - faster speed means more frequent updates
    const baseInterval = 100;
    const interval = baseInterval / speedMultiplier;
    simTimer = setInterval(simStep, interval);
    
    // Start spawning helpers with randomized timing
    startHelperSpawnTimer();
  }
}

// Also update the stop/cleanup function to handle setTimeout properly
function cleanupTimers() {
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  clearTimeout(helperSpawnTimer); // Changed from clearInterval to clearTimeout
  isRunning = false;
}

// Update test button event listener to use cleanupTimers
document.getElementById("test-button").addEventListener("click", () => {
  cleanupTimers();
  timer = 30;
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
  
  agents = generateRandomAgents(20);
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

function generateRandomAgents(count) {
  // Use the simulation area's dimensions instead of window dimensions
  const simulationArea = document.querySelector('.simulation-area');
  const surfaceElement = document.getElementById('surface');
  
  // Get the computed dimensions of the SVG element
  const surfaceWidth = surfaceElement.clientWidth || 1000;
  const surfaceHeight = surfaceElement.clientHeight || 500;
  
  const maxCols = Math.floor(surfaceWidth / cellSize);
  const maxRows = Math.floor(surfaceHeight / cellSize);
  const agents = [];

  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;
  
  console.log(`Generating ${helpersCount} helpers and ${victimsCount} victims`);

  const helpers = [];
  for (let i = 0; i < helpersCount; i++) {
    const helper = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    helpers.push(helper);
    agents.push(helper);
  }

  const victims = [];
  for (let i = 0; i < victimsCount; i++) {
    const victimType = getRandomVictimType();
    const victim = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: victimType,
      urgencyLevel: urgencyLevels[victimType],
      isVictim: true,
      reachedGoal: false
    };
    victims.push(victim);
    agents.push(victim);
  }

  // Group victims by urgency level
  const victimsByUrgency = {
    1: [], // High urgency (elderly and disabled)
    2: [], // Medium urgency (youth)
    3: []  // Low urgency (adults)
  };
  
  victims.forEach(victim => {
    victimsByUrgency[victim.urgencyLevel].push(victim);
  });
  
  console.log("=== URGENCY DISTRIBUTION ===");
  console.log(`High urgency victims: ${victimsByUrgency[1].length}`);
  console.log(`Medium urgency victims: ${victimsByUrgency[2].length}`);
  console.log(`Low urgency victims: ${victimsByUrgency[3].length}`);
  
  // Create a copy of helpers array to track available helpers
  const availableHelpers = [...helpers];
  
  // First assign helpers to high urgency victims (elderly and disabled) based on proximity
  victimsByUrgency[1].forEach(victim => {
    if (availableHelpers.length === 0) return;
    
    // Find the closest helper to this high-priority victim
    let closestHelper = null;
    let shortestDistance = Infinity;
    let closestHelperIndex = -1;
    
    availableHelpers.forEach((helper, helperIndex) => {
      const distance = calculateDistance(helper, victim);
      if (distance < shortestDistance) {
        closestHelper = helper;
        shortestDistance = distance;
        closestHelperIndex = helperIndex;
      }
    });
    
    // Assign the closest helper to this victim
    if (closestHelper) {
      closestHelper.assignedVictim = victim;
      victim.assignedHelper = closestHelper;
      
      // Remove the assigned helper from available helpers
      availableHelpers.splice(closestHelperIndex, 1);
      
      console.log(`Assigned closest ${closestHelper.type} helper to high-priority ${victim.type} victim (distance: ${shortestDistance.toFixed(2)})`);
    }
  });
  
  // Then assign helpers to medium urgency victims (youth)
  victimsByUrgency[2].forEach(victim => {
    if (availableHelpers.length === 0) return;
    
    // Find the closest helper
    let closestHelper = null;
    let shortestDistance = Infinity;
    let closestHelperIndex = -1;
    
    availableHelpers.forEach((helper, helperIndex) => {
      const distance = calculateDistance(helper, victim);
      if (distance < shortestDistance) {
        closestHelper = helper;
        shortestDistance = distance;
        closestHelperIndex = helperIndex;
      }
    });
    
    // Assign the closest helper to this victim
    if (closestHelper) {
      closestHelper.assignedVictim = victim;
      victim.assignedHelper = closestHelper;
      
      // Remove the assigned helper from available helpers
      availableHelpers.splice(closestHelperIndex, 1);
      
      console.log(`Assigned ${closestHelper.type} helper to medium-priority ${victim.type} victim (distance: ${shortestDistance.toFixed(2)})`);
    }
  });
  
  // Finally assign remaining helpers to low urgency victims (adults)
  victimsByUrgency[3].forEach(victim => {
    if (availableHelpers.length === 0) return;
    
    // Get the next available helper
    const helper = availableHelpers.shift();
    
    helper.assignedVictim = victim;
    victim.assignedHelper = helper;
    
    console.log(`Assigned ${helper.type} helper to low-priority ${victim.type} victim`);
  });

  return agents;
}

function renderAgents() {
  surface.selectAll("image.agent").remove();
  surface.selectAll("circle.urgency").remove();
  surface.selectAll("line.assignment").remove();
  
  // Draw lines between helpers and their assigned victims
  surface.selectAll("line.assignment")
    .data(agents.filter(agent => agent.isHelper && !agent.reachedGoal && agent.assignedVictim))
    .enter()
    .append("line")
    .attr("class", "assignment")
    .attr("x1", d => (d.col - 0.5) * cellSize)
    .attr("y1", d => (d.row - 0.5) * cellSize)
    .attr("x2", d => (d.assignedVictim.col - 0.5) * cellSize)
    .attr("y2", d => (d.assignedVictim.row - 0.5) * cellSize)
    .attr("stroke", d => {
    // Color line based on victim's urgency level
      if (d.assignedVictim.urgencyLevel === 1) return "rgba(255, 99, 132, 0.7)";  // Youth and adults - Red
      else if (d.assignedVictim.urgencyLevel === 2) return "rgba(255, 159, 64, 0.7)"; // Disabled - Orange
      else return "rgba(75, 192, 192, 0.7)"; // Elderly - Teal
    })
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "5,3"); // Dashed line for better visibility
    
  // Only draw urgency circles for victims not yet reached goal
  surface.selectAll("circle.urgency")
    .data(agents.filter(agent => agent.isVictim && !agent.reachedGoal))
    .enter()
    .append("circle")
    .attr("class", "urgency")
    .attr("cx", d => (d.col - 0.5) * cellSize)
    .attr("cy", d => (d.row - 0.5) * cellSize)
    .attr("r", cellSize / 2)
    .attr("fill", d => {
      if (d.urgencyLevel === 1) return "rgba(255, 99, 132, 0.3)";  
      else if (d.urgencyLevel === 2) return "rgba(255, 159, 64, 0.3)"; 
      else return "rgba(75, 192, 192, 0.3)"; 
    });

  surface.selectAll("image.agent")
    .data(agents.filter(agent => !agent.reachedGoal))
    .enter()
    .append("image")
    .attr("class", "agent")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => (d.col - 1) * cellSize)
    .attr("y", d => (d.row - 1) * cellSize);
}

function logAssignmentDetails() {
  const victimsByUrgency = {
    1: [],
    2: [],
    3: []
  };
  
  agents.filter(a => a.isVictim).forEach(victim => {
    victimsByUrgency[victim.urgencyLevel].push(victim);
  });
  
  console.log("=== URGENCY DISTRIBUTION ===");
  console.log(`High urgency victims: ${victimsByUrgency[1].length}`);
  console.log(`Medium urgency victims: ${victimsByUrgency[2].length}`);
  console.log(`Low urgency victims: ${victimsByUrgency[3].length}`);
  
  console.log("=== ASSIGNMENT ORDER ===");
  const helpers = agents.filter(a => a.isHelper);
  helpers.forEach((helper, index) => {
    if (helper.assignedVictim) {
      const distance = calculateDistance(helper, helper.assignedVictim).toFixed(2);
      console.log(`Helper ${index+1} (${helper.type}) → Victim type: ${helper.assignedVictim.type}, Urgency: ${helper.assignedVictim.urgencyLevel}, Distance: ${distance}`);
    } else {
      console.log(`Helper ${index+1} (${helper.type}) → No victim assigned`);
    }
  });
  
  const highUrgencyWithoutHelpers = victimsByUrgency[1].filter(v => !v.assignedHelper);
  if (highUrgencyWithoutHelpers.length > 0) {
    console.warn(`WARNING: ${highUrgencyWithoutHelpers.length} high urgency victims don't have helpers!`);
  }
}

function updateCounters() {
  const totalVictims = agents.filter(a => a.isVictim).length;
  const savedByUrgency = {
    1: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 1).length,
    2: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 2).length,
    3: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 3).length
  };
  
  const totalByUrgency = {
    1: agents.filter(a => a.isVictim && a.urgencyLevel === 1).length,
    2: agents.filter(a => a.isVictim && a.urgencyLevel === 2).length,
    3: agents.filter(a => a.isVictim && a.urgencyLevel === 3).length
  };
  
  // Update the stat boxes with current values
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `Disabled Saved: ${savedCount.disabled}`;
  document.getElementById('packing-count').textContent = `Packing Helpers: ${savedCount.packing}`;
  document.getElementById('first-aider-count').textContent = `First Aiders: ${savedCount.first_aider}`;
  document.getElementById('timer-count').textContent = `Time: ${timer}s`;
  
  // Update the urgency stats with progress bars
  document.getElementById('urgency-stats').innerHTML = `
    <div class="urgency-progress">
      <div>High Priority: ${savedByUrgency[1]}/${totalByUrgency[1]} (${totalByUrgency[1] > 0 ? Math.round(savedByUrgency[1]/totalByUrgency[1]*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill high-fill" style="width: ${totalByUrgency[1] > 0 ? (savedByUrgency[1]/totalByUrgency[1]*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Medium Priority: ${savedByUrgency[2]}/${totalByUrgency[2]} (${totalByUrgency[2] > 0 ? Math.round(savedByUrgency[2]/totalByUrgency[2]*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill medium-fill" style="width: ${totalByUrgency[2] > 0 ? (savedByUrgency[2]/totalByUrgency[2]*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Low Priority: ${savedByUrgency[3]}/${totalByUrgency[3]} (${totalByUrgency[3] > 0 ? Math.round(savedByUrgency[3]/totalByUrgency[3]*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill low-fill" style="width: ${totalByUrgency[3] > 0 ? (savedByUrgency[3]/totalByUrgency[3]*100) : 0}%"></div>
      </div>
    </div>
  `;
}

function setupCanvas() {
  // Initialize the SVG surface
  surface = d3.select("#surface");
  
  // Generate initial set of agents
  agents = generateRandomAgents(10);
  
  // Log the assignment details for debugging
  logAssignmentDetails();

  // Set up event listeners for the buttons
  document.getElementById("start-button").addEventListener("click", () => {
    isRunning = true;
    startSim();
    startTimer();
  });
  
  document.getElementById("test-button").addEventListener("click", () => {
    clearInterval(simTimer);
    clearInterval(countdownTimer);
    isRunning = false;
    timer = 30;
    savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
    
    agents = generateRandomAgents(20);
    logAssignmentDetails();
    renderGoal();
    renderAgents();
    updateCounters();
  });
  
  // Initial render
  renderGoal();
  renderAgents();
  updateCounters();
}

// Also update showResults to clean up properly
function showResults() {
  cleanupTimers(); // Add this line to ensure all timers are cleared
  
  const rescuedByPriority = {
    high: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 1).length,
    medium: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 2).length,
    low: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 3).length
  };
  
  const totalByPriority = {
    high: agents.filter(a => a.isVictim && a.urgencyLevel === 1).length,
    medium: agents.filter(a => a.isVictim && a.urgencyLevel === 2).length,
    low: agents.filter(a => a.isVictim && a.urgencyLevel === 3).length
  };
  
  const results = {
    youth: savedCount.youth,
    adult: savedCount.adult,
    elderly: savedCount.elderly,
    disabled: savedCount.disabled,
    packing: savedCount.packing,
    first_aider: savedCount.first_aider
  };
  
  // Create a modal to display results instead of using alert
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
  
  modalContent.innerHTML = `
    <h2 style="color:#2c3e50; margin-top:0;">Simulation Results</h2>
    
    <h3 style="color:#2c3e50;">Victims Rescued by Type</h3>
    <div class="stat-box high-urgency">Youth: ${results.youth}</div>
    <div class="stat-box high-urgency">Adults: ${results.adult}</div>
    <div class="stat-box low-urgency">Elderly: ${results.elderly}</div>
    <div class="stat-box medium-urgency">Disabled: ${results.disabled}</div>
    
    <h3 style="color:#2c3e50; margin-top:20px;">Victims Rescued by Priority</h3>
    <div class="urgency-progress">
      <div>High Priority (Youth & Adults): ${rescuedByPriority.high}/${totalByPriority.high} (${totalByPriority.high > 0 ? Math.round(rescuedByPriority.high/totalByPriority.high*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill high-fill" style="width: ${totalByPriority.high > 0 ? Math.round(rescuedByPriority.high/totalByPriority.high*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Medium Priority (Disabled): ${rescuedByPriority.medium}/${totalByPriority.medium} (${totalByPriority.medium > 0 ? Math.round(rescuedByPriority.medium/totalByPriority.medium*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill medium-fill" style="width: ${totalByPriority.medium > 0 ? Math.round(rescuedByPriority.medium/totalByPriority.medium*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Low Priority (Elderly): ${rescuedByPriority.low}/${totalByPriority.low} (${totalByPriority.low > 0 ? Math.round(rescuedByPriority.low/totalByPriority.low*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill low-fill" style="width: ${totalByPriority.low > 0 ? Math.round(rescuedByPriority.low/totalByPriority.low*100) : 0}%"></div>
      </div>
    </div>
    
    <button id="close-modal" class="btn btn-primary" style="margin-top:20px;">Close</button>
  `;
  
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