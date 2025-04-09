// Core simulation variables
var cellSize = 40;
var simTimer;
var countdownTimer;
var helperSpawnTimer; 
var isRunning = false;
var timer = 30;
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
var perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
var speedMultiplier = 1.0;

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var agents = [];

// Helper spawn rate (in seconds)
var helperSpawnRate = 5;

// Ratio of victims to helpers
var victimToHelperRatio = 2;

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 1.2,    // Faster than adults
  adult: 1.0,    // Normal speed
  elderly: 0.4,  // Much slower than before
  disabled: 0.3, // Even slower
  packing: 1.2,  // Helpers are fast
  first_aider: 1.2
};

// Urgency levels for prioritization
var urgencyLevels = {
  youth: 1,    // High urgency
  adult: 1,    // High urgency
  elderly: 3,  // Low urgency
  disabled: 2  // Medium urgency
};

// Tracking variables
var totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
var efficiencyScore = 0;

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.2;

// Function to calculate distance between two agents
function calculateDistance(agent1, agent2) {
  return Math.sqrt(
    Math.pow(agent1.row - agent2.row, 2) + 
    Math.pow(agent1.col - agent2.col, 2)
  );
}

// Function to update agent positions
function updateAgents() {
  const now = Date.now();

  agents.forEach((agent) => {
    if (agent.reachedGoal) return;
    
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
          console.log(`Helper ${agent.type} reached victim ${agent.assignedVictim.type} and started waiting`);
        }

        let waitDuration = 0;
        if (agent.type === 'packing') {
          waitDuration = 2000; // Reduced for testing/demo purposes
        } else if (agent.type === 'first_aider') {
          waitDuration = 1000; // Reduced for testing/demo purposes
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

// Move helper and victim to the goal
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
      savedCount[helper.type]++;
      victim.counted = true;
      helper.counted = true;
      console.log(`Helper ${helper.type} and victim ${victim.type} reached goal and were counted`);
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

// Function to spawn new helpers during simulation
function spawnNewHelpers() {
  if (!isRunning) return;
  
  // Generate random number of helpers
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
    const maxCols = 20; // Arbitrary values since we're not displaying
    const maxRows = 20;
    
    // Create a helper
    const helper = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    
    newHelpers.push(helper);
  }
  
  // If we have unassigned victims, assign them to our new helpers
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
      // If same urgency, prioritize by distance
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
    });
  }
  
  // Reset the timer with variable timing
  if (isRunning) {
    clearTimeout(helperSpawnTimer);
    helperSpawnTimer = setTimeout(() => {
      spawnNewHelpers();
    }, nextSpawnInterval);
  }
}

// Start the helper spawn timer with initial random delay
function startHelperSpawnTimer() {
  // Initial random delay between 1-3 seconds (adjusted for speed)
  const initialDelay = (1000 + Math.random() * 2000) / speedMultiplier;
  
  helperSpawnTimer = setTimeout(() => {
    spawnNewHelpers(); // Initial call to the spawn function
  }, initialDelay);
}

// Start simulation
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

// Cleanup function for timers
function cleanupTimers() {
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  clearTimeout(helperSpawnTimer);
  isRunning = false;
}

// Main simulation step
function simStep() {
  if (!isRunning) return;
  updateAgents();
  updateCounters();
}

// Generate random agents for the simulation
function generateRandomAgents(count) {
  const maxCols = 20; // Arbitrary values since we're not displaying
  const maxRows = 20;
  
  const agents = [];

  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;
  
  console.log(`Generating ${helpersCount} helpers and ${victimsCount} victims`);

  const helpers = [];
  for (let i = 0; i < helpersCount; i++) {
    let row = Math.floor(Math.random() * maxRows) + 1;
    let col = Math.floor(Math.random() * maxCols) + 1;
    
    const helper = {
      row: row,
      col: col,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    helpers.push(helper);
    agents.push(helper);
  }
  
  // Reset total counts
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

  const victims = [];
  for (let i = 0; i < victimsCount; i++) {
    const victimType = getRandomVictimType();
    totalAgentsByType[victimType]++;
    
    let row = Math.floor(Math.random() * maxRows) + 1;
    let col = Math.floor(Math.random() * maxCols) + 1;
    
    const victim = {
      row: row,
      col: col,
      type: victimType,
      urgencyLevel: urgencyLevels[victimType],
      isVictim: true,
      reachedGoal: false
    };
    victims.push(victim);
    agents.push(victim);
  }

  // Group victims by type
  const victimsByType = {
    youth: victims.filter(v => v.type === 'youth'),
    adult: victims.filter(v => v.type === 'adult'),
    disabled: victims.filter(v => v.type === 'disabled'),
    elderly: victims.filter(v => v.type === 'elderly')
  };
  
  console.log("=== VICTIM DISTRIBUTION ===");
  console.log(`Youth victims: ${victimsByType.youth.length}`);
  console.log(`Adult victims: ${victimsByType.adult.length}`);
  console.log(`Disabled victims: ${victimsByType.disabled.length}`);
  console.log(`Elderly victims: ${victimsByType.elderly.length}`);
  
  // Create a copy of helpers array to track available helpers
  const availableHelpers = [...helpers];
  
  // Create a combined array of high priority victims (youth and adults)
  // We'll sort this by distance for each helper
  const highPriorityVictims = [...victimsByType.youth, ...victimsByType.adult];
  
  // For each helper, find the nearest high priority victim (youth or adult)
  availableHelpers.forEach(helper => {
    // Skip if no high priority victims available
    if (highPriorityVictims.length === 0) return;
    
    // Calculate distances from this helper to all high priority victims
    const victimDistances = highPriorityVictims.map(victim => {
      return {
        victim: victim,
        distance: calculateDistance(helper, victim)
      };
    });
    
    // Sort by distance (closest first)
    victimDistances.sort((a, b) => a.distance - b.distance);
    
    // Assign this helper to the closest high priority victim
    const closestVictim = victimDistances[0].victim;
    helper.assignedVictim = closestVictim;
    closestVictim.assignedHelper = helper;
    
    // Remove the assigned victim from the pool
    const index = highPriorityVictims.indexOf(closestVictim);
    if (index > -1) {
      highPriorityVictims.splice(index, 1);
    }
  });
  
  // If we still have helpers available after assigning to high priority victims
  // Get remaining unassigned helpers
  const remainingHelpers = availableHelpers.filter(helper => !helper.assignedVictim);
  
  if (remainingHelpers.length > 0 && highPriorityVictims.length === 0) {
    console.log("All high priority victims assigned, moving to medium priority victims");
    
    // Create array of medium priority victims (disabled)
    const mediumPriorityVictims = [...victimsByType.disabled];
    
    // For each remaining helper, find the nearest medium priority victim
    remainingHelpers.forEach(helper => {
      // Skip if no medium priority victims available or helper already assigned
      if (mediumPriorityVictims.length === 0 || helper.assignedVictim) return;
      
      // Calculate distances from this helper to all medium priority victims
      const victimDistances = mediumPriorityVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance (closest first)
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign this helper to the closest medium priority victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove the assigned victim from the pool
      const index = mediumPriorityVictims.indexOf(closestVictim);
      if (index > -1) {
        mediumPriorityVictims.splice(index, 1);
      }
    });
  }
  
  // Finally, if we still have helpers available after assigning to high and medium priority victims
  const remainingHelpersForLowPriority = availableHelpers.filter(helper => !helper.assignedVictim);
  if (remainingHelpersForLowPriority.length > 0) {
    console.log("Moving to low priority victims (elderly)");
    
    // Create array of low priority victims (elderly)
    const lowPriorityVictims = [...victimsByType.elderly];
    
    // For each remaining helper, find the nearest low priority victim
    remainingHelpersForLowPriority.forEach(helper => {
      // Skip if no low priority victims available or helper already assigned
      if (lowPriorityVictims.length === 0 || helper.assignedVictim) return;
      
      // Calculate distances from this helper to all low priority victims
      const victimDistances = lowPriorityVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance (closest first)
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign this helper to the closest low priority victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove the assigned victim from the pool
      const index = lowPriorityVictims.indexOf(closestVictim);
      if (index > -1) {
        lowPriorityVictims.splice(index, 1);
      }
    });
  }

  return agents;
}

// Calculate perished people
function calculatePerished() {
  // Reset perished count
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  
  // Find all victims who didn't reach the goal
  agents.filter(a => a.isVictim && !a.reachedGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });
  
  return perishedCount;
}

// Calculate efficiency score
function calculateEfficiency() {
  // Calculate weighted score based on priorities
  const weights = {
    youth: 3,    // High priority
    adult: 3,    // High priority
    disabled: 2, // Medium priority
    elderly: 1   // Low priority
  };
  
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  // Calculate actual score
  Object.keys(savedCount).forEach(type => {
    if (weights[type]) { // Only calculate for victim types
      totalScore += savedCount[type] * weights[type];
    }
  });
  
  // Calculate maximum possible score (if all victims were saved)
  Object.keys(totalAgentsByType).forEach(type => {
    maxPossibleScore += totalAgentsByType[type] * weights[type];
  });
  
  // Return efficiency as percentage
  return maxPossibleScore > 0 ? (totalScore / maxPossibleScore * 100).toFixed(1) : 0;
}

// Simplified function to update counters (just for the console, no UI updates)
function updateCounters() {
  document.getElementById('timer-display').textContent = `Time: ${timer}s`;
}

// Show results in a simple table
function showResults() {
  cleanupTimers();
  
  // Calculate perished people and efficiency
  const perished = calculatePerished();
  efficiencyScore = calculateEfficiency();
  
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
  
  // Clear previous results if any
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.innerHTML = '';
  
  // Create results table
  const table = document.createElement('table');
  table.border = "1";
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.marginTop = "20px";
  
  // Add efficiency score row
  let row = table.insertRow();
  let cell1 = row.insertCell(0);
  let cell2 = row.insertCell(1);
  cell1.innerHTML = "<strong>Overall Efficiency</strong>";
  cell2.innerHTML = `${efficiencyScore}%`;
  cell1.style.padding = "8px";
  cell2.style.padding = "8px";
  
  // Add header for victims rescued
  row = table.insertRow();
  cell1 = row.insertCell(0);
  cell1.innerHTML = "<strong>Victims Rescued by Type</strong>";
  cell1.colSpan = "2";
  cell1.style.padding = "8px";
  
  // Add rows for each victim type
  const victimTypes = ['youth', 'adult', 'elderly', 'disabled'];
  victimTypes.forEach(type => {
    row = table.insertRow();
    cell1 = row.insertCell(0);
    cell2 = row.insertCell(1);
    cell1.innerHTML = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
    cell2.innerHTML = `${savedCount[type]} rescued, ${perishedCount[type]} perished`;
    cell1.style.padding = "8px";
    cell2.style.padding = "8px";
  });
  
  // Add header for priority stats
  row = table.insertRow();
  cell1 = row.insertCell(0);
  cell1.innerHTML = "<strong>Victims Rescued by Priority</strong>";
  cell1.colSpan = "2";
  cell1.style.padding = "8px";
  
  // Add rows for each priority level
  const priorityLabels = {
    high: "High Priority (Youth & Adults)",
    medium: "Medium Priority (Disabled)",
    low: "Low Priority (Elderly)"
  };
  
  Object.keys(priorityLabels).forEach(priority => {
    row = table.insertRow();
    cell1 = row.insertCell(0);
    cell2 = row.insertCell(1);
    cell1.innerHTML = priorityLabels[priority];
    const percentage = totalByPriority[priority] > 0 ? 
      Math.round(rescuedByPriority[priority]/totalByPriority[priority]*100) : 0;
    cell2.innerHTML = `${rescuedByPriority[priority]}/${totalByPriority[priority]} (${percentage}%)`;
    cell1.style.padding = "8px";
    cell2.style.padding = "8px";
  });
  
  // Add header for summary of perished
  row = table.insertRow();
  cell1 = row.insertCell(0);
  cell1.innerHTML = "<strong>Summary of Perished Victims</strong>";
  cell1.colSpan = "2";
  cell1.style.padding = "8px";
  
  // Add total perished row
  row = table.insertRow();
  cell1 = row.insertCell(0);
  cell2 = row.insertCell(1);
  cell1.innerHTML = "Total";
  cell2.innerHTML = `${perished.youth + perished.adult + perished.elderly + perished.disabled}`;
  cell1.style.padding = "8px";
  cell2.style.padding = "8px";
  
  // Add table to results container
  resultsContainer.appendChild(table);
}

// Start timer for simulation
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
      
      // Show results
      showResults();
    }
  }, 1000);
}

// Initialize the page
function setup() {
  // Create basic HTML structure
  document.body.innerHTML = `
    <div class="container" style="max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1>Flood Evacuation Simulation</h1>
      
      <div class="controls" style="margin-bottom: 20px;">
        <button id="start-button">Start Simulation</button>
        <button id="test-button">Generate New Agents</button>
        <div style="margin-top: 10px;">
          <label for="speed-slider">Simulation Speed: </label>
          <input type="range" id="speed-slider" min="0" max="4" value="2">
          <span id="timer-display">Time: 30s</span>
        </div>
      </div>
      
      <div id="results-container">
        <!-- Results will be displayed here -->
      </div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById("start-button").addEventListener("click", () => {
    isRunning = true;
    startSim();
    startTimer();
  });
  
  document.getElementById("test-button").addEventListener("click", () => {
    cleanupTimers();
    timer = 30;
    savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
    perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
    totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
    
    agents = generateRandomAgents(20);
    document.getElementById('timer-display').textContent = `Time: ${timer}s`;
    document.getElementById('results-container').innerHTML = '<p>Press "Start Simulation" to begin.</p>';
  });
  
  document.getElementById("speed-slider").addEventListener("input", function() {
    const speedMap = [0.25, 0.5, 1, 2, 4];
    speedMultiplier = speedMap[parseInt(this.value)];
    
    // If simulation is already running, restart it with new speed
    if (isRunning) {
      clearInterval(simTimer);
      clearTimeout(helperSpawnTimer);
      startSim();
    }
  });
  
  // Initialize with some agents
  agents = generateRandomAgents(20);
  document.getElementById('results-container').innerHTML = '<p>Press "Start Simulation" to begin.</p>';
}

// Run setup when page loads
window.onload = setup;