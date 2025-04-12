// Core simulation variables
var isRunning = false;
var simulationTime = 0;
var maxSimulationTime = 7200; // 2 hours in seconds
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
var perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
var simTimer;
var countdownTimer;

var gridSize = 52; // Adjusted grid size for better scale
var goal = { row: gridSize/2, col: gridSize/2 }; // Center of grid
var agents = [];

// Priority bias - percentage of helpers to assign to high priority victims first (0-100)
var priorityBias = 99;

// Demographics 
var demographics = {
  youth: 3500,
  adult: 3940,
  elderly: 1160,
  disabled: 170
};

var totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;

// Ratio of victims to helpers
var victimToHelperRatio = 1.3;

// Adjusted movement speeds (cells per second)
var baseVictimSpeeds = {
  youth: 0.00603,  
  adult: 0.00598,  
  elderly: 0.00533, 
  disabled: 0.00518,
  packing: 0.00603,   // Same as youth
  first_aider: 0.00603 // Same as youth
};

// Simplified urgency levels - just High and Low
var urgencyLevels = {
  youth: 2,    // Low urgency
  adult: 2,    // Low urgency
  elderly: 1,  // High urgency
  disabled: 1  // High urgency
};

// Tracking variables
var totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

// Arrival threshold - when agent is considered to have reached goal
const arrivalThreshold = 0.1;

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 1;

let simulationResults = [];
let runCounter = 0;
let totalRuns = 10;

// Function to calculate distance between two agents
function calculateDistance(agent1, agent2) {
  return Math.sqrt(
    Math.pow(agent1.row - agent2.row, 2) + 
    Math.pow(agent1.col - agent2.col, 2)
  );
}

// Main function for handling simulation
function runSimulation(simulationSpeedMultiplier = 1000) {
  // Reset for this run
  resetSimulation();
  
  // Determine optimal time step based on agent count
  const timeStep = totalPopulation > 10000 ? 50 : 
                   totalPopulation > 1000 ? 10 : 0.1;
  
  simulationTime = 0;
  
  console.log(`Starting simulation run ${runCounter+1}...`);
  
  // Progress tracking
  let lastProgressReport = 0;
  
  // Run until simulation ends
  while (simulationTime < maxSimulationTime && !areAllVictimsEscorted()) {
    // Update all agents
    updateAgents(timeStep);
    
    // Check for helpers who can be reassigned
    reassignHelpers();
    
    // Increment simulation time
    simulationTime += timeStep;
    
    // Report progress every 10% of simulation
    const progressPercent = Math.floor((simulationTime / maxSimulationTime) * 10);
    if (progressPercent > lastProgressReport) {
      console.log(`Simulation run ${runCounter+1}: ${progressPercent*10}% complete`);
      lastProgressReport = progressPercent;
    }
  }
  
  console.log(`Simulation run ${runCounter+1} complete. Time: ${simulationTime.toFixed(1)}s, Saved: ${getSavedTotal()}`);
  
  // Calculate perished people
  calculatePerished();
  
  // Store results and continue to next run if needed
  storeResults(runCounter + 1);
  runCounter++;
  
  if (runCounter < totalRuns) {
    setTimeout(() => runSimulation(simulationSpeedMultiplier), 10);
  } else {
    displayResults();
    document.getElementById('start-button').disabled = false;
    document.getElementById('run-count').textContent = `All ${totalRuns} runs completed`;
  }
}

// Function to check if all victims are either escorted to safety or have no chance of being rescued
function areAllVictimsEscorted() {
  // All victims have reached the goal or all helpers are at the goal with no time to go back
  const allVictimsReachedGoal = agents.filter(a => a.isVictim).every(v => v.reachedGoal);
  
  // If all victims have reached the goal, we're done
  if (allVictimsReachedGoal) return true;
  
  // If there's not enough time left for helpers to go back out (less than 30 minutes)
  const timeLeft = maxSimulationTime - simulationTime;
  if (timeLeft < 1800) {
    // Check if there are any available helpers that can still be assigned
    const availableHelpers = agents.filter(a => a.isHelper && !a.permanentlyAtGoal && !a.assignedVictim);
    // If no helpers can be reassigned, and some victims haven't reached the goal, they're stranded
    return availableHelpers.length === 0;
  }
  
  return false;
}

// Function to reassign helpers who have completed their task
function reassignHelpers() {
  // If there's less than 30 minutes left, don't reassign
  if (maxSimulationTime - simulationTime < 1800) return;
  
  // Find helpers who have reached the goal but aren't permanently there
  const availableHelpers = agents.filter(a => 
    a.isHelper && a.reachedGoal && !a.permanentlyAtGoal && !a.assignedVictim);
  
  if (availableHelpers.length === 0) return;
  
  // Find victims who need help (not yet assigned and not at goal)
  const unassignedHighPriorityVictims = agents.filter(a => 
    a.isVictim && !a.assignedHelper && !a.reachedGoal && a.urgencyLevel === 1);
    
  const unassignedLowPriorityVictims = agents.filter(a => 
    a.isVictim && !a.assignedHelper && !a.reachedGoal && a.urgencyLevel === 2);
  
  // Assign based on priority, then proximity
  availableHelpers.forEach(helper => {
    // Reset helper's state for new assignment
    helper.reachedGoal = false;
    
    // Check high priority victims first
    if (unassignedHighPriorityVictims.length > 0) {
      assignHelperToClosestVictim(helper, unassignedHighPriorityVictims);
    } 
    // Then check low priority victims
    else if (unassignedLowPriorityVictims.length > 0) {
      assignHelperToClosestVictim(helper, unassignedLowPriorityVictims);
    }
  });
}

// Helper function to assign a helper to the closest victim from a list and remove that victim from the list
function assignHelperToClosestVictim(helper, victimsList) {
  // Calculate distances from this helper to all victims in the list
  const victimDistances = victimsList.map(victim => {
    return {
      victim: victim,
      distance: calculateDistance(helper, victim)
    };
  });
  
  // Sort by distance (closest first)
  victimDistances.sort((a, b) => a.distance - b.distance);
  
  // Assign helper to closest victim
  const closestVictim = victimDistances[0].victim;
  helper.assignedVictim = closestVictim;
  closestVictim.assignedHelper = helper;
  
  // Remove the assigned victim from the list
  const index = victimsList.indexOf(closestVictim);
  if (index > -1) {
    victimsList.splice(index, 1);
  }
  
  console.log(`Reassigned ${helper.type} helper to ${closestVictim.type} victim at distance ${victimDistances[0].distance.toFixed(2)}`);
}

function getSavedTotal() {
  return savedCount.youth + savedCount.adult + savedCount.elderly + savedCount.disabled;
}

function updateAgents(deltaTime) {
  const now = Date.now(); // Current time in milliseconds

  agents.forEach((agent) => {
    // Skip agents that have permanently reached the goal
    if (agent.permanentlyAtGoal) return;
    
    if (agent.isHelper) {
      // If the helper doesn't have an assigned victim, there's nothing to do
      if (!agent.assignedVictim) return;
      
      // Skip if victim already reached goal permanently
      if (agent.assignedVictim.permanentlyAtGoal) {
        agent.assignedVictim = null;
        return;
      }
      
      // Check if helper has reached their assigned victim
      const reachedVictim = Math.abs(agent.row - agent.assignedVictim.row) <= epsilon * 2 &&
                          Math.abs(agent.col - agent.assignedVictim.col) <= epsilon * 2;

      if (!reachedVictim) {
        // Helper is moving towards victim
        moveTowards(agent, agent.assignedVictim, deltaTime);
      } else {
        // Helper has reached victim - start/continue waiting if needed
        if (!agent.waitingSince) {
          agent.waitingSince = simulationTime;
        }

        let waitDuration = 0;
        if (agent.type === 'packing') {
          waitDuration = 120; // 2 minutes in seconds
        } else if (agent.type === 'first_aider') {
          waitDuration = 60; // 1 minute in seconds
        }

        if (simulationTime - agent.waitingSince >= waitDuration) {
          // Waiting is done, move toward goal
          moveToGoal(agent, agent.assignedVictim, deltaTime);
        }
      }
    }
    // Unassisted victims don't move on their own
  });
}

function moveTowards(agent, target, deltaTime) {
  let speed = baseVictimSpeeds[agent.type] || baseVictimSpeeds.adult;
  
  let colDiff = target.col - agent.col;
  let rowDiff = target.row - agent.row;

  // Check if already very close to target
  if (Math.abs(colDiff) <= epsilon && Math.abs(rowDiff) <= epsilon) {
    agent.col = target.col;
    agent.row = target.row;
    return;
  }
  
  // Calculate distance and direction vector
  let distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff);
  
  if (distance > 0) {
    // Normalize the direction vector
    let dirCol = colDiff / distance;
    let dirRow = rowDiff / distance;
    
    // Apply movement with delta time
    agent.col += dirCol * speed * deltaTime;
    agent.row += dirRow * speed * deltaTime;
  }
}

function moveToGoal(helper, victim, deltaTime) {
  // Check if already very close to goal - if so, snap to exact position and mark as reached
  let colDiff = goal.col - victim.col;
  let rowDiff = goal.row - victim.row;
  
  if (Math.abs(colDiff) <= arrivalThreshold && Math.abs(rowDiff) <= arrivalThreshold) {
    // Snap exactly to goal position
    victim.col = goal.col;
    victim.row = goal.row;
    helper.col = goal.col;
    helper.row = goal.row;
    
    // Mark victim as permanently at goal
    victim.reachedGoal = true;
    victim.permanentlyAtGoal = true;

    helper.victimsHelped++;
    
    // Mark helper as reached goal (but not permanently unless simulation is almost over)
    helper.reachedGoal = true;
    const timeLeft = maxSimulationTime - simulationTime;
    if (timeLeft < 1800) { // Less than 30 minutes left
      helper.permanentlyAtGoal = true;
    }
    
    // Update saved count if not already counted
    if (!victim.counted) {
      savedCount[victim.type]++;
      victim.counted = true;
      
      // Only count helper once when they're permanently at the goal
      if (helper.permanentlyAtGoal && !helper.counted) {
        savedCount[helper.type]++;
        helper.counted = true;
      }
    }
    
    // Clear the assignment and waiting state for the helper for potential reassignment
    helper.waitingSince = null;
    
    return;
  }
  
  let speed = baseVictimSpeeds[victim.type];
  
  // Calculate distance and direction vector
  let distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff);
  
  if (distance > 0) {
    // Normalize the direction vector
    let dirCol = colDiff / distance;
    let dirRow = rowDiff / distance;
    
    // Apply movement with delta time
    victim.col += dirCol * speed * deltaTime;
    victim.row += dirRow * speed * deltaTime;
    
    // Keep helper with victim
    helper.col = victim.col;
    helper.row = victim.row;
  }
}

function generateRandomAgents() {
  const agents = [];
  const maxCols = gridSize;
  const maxRows = gridSize;
  const minimumCellDistance = 30; // For 3.7km minimum distance
  const shelterRow = goal.row;
  const shelterCol = goal.col;
  
  // Calculate helper counts based on ratio
  const totalVictims = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;
  const totalHelpers = Math.floor(totalVictims / victimToHelperRatio);
  
  // Distribute helpers between packing and first_aider types
  const packingHelpers = Math.floor(totalHelpers / 2);
  const firstAidHelpers = totalHelpers - packingHelpers;
  
  console.log(`Generating ${totalVictims} victims and ${totalHelpers} helpers`);
  
  // Generate helper agents
  const helpers = [];
  for (let i = 0; i < totalHelpers; i++) {
    let row, col, distance;
    
    do {
      row = Math.floor(Math.random() * maxRows) + 1;
      col = Math.floor(Math.random() * maxCols) + 1;
      
      // Calculate distance in grid cells
      const rowDiff = row - shelterRow;
      const colDiff = col - shelterCol;
      distance = Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
    } while (distance < minimumCellDistance);
    
    const helperType = i < packingHelpers ? 'packing' : 'first_aider';
    
    const helper = {
      row: row,
      col: col,
      type: helperType,
      isHelper: true,
      reachedGoal: false,
      permanentlyAtGoal: false,
      counted: false,
      victimsHelped: 0
    };
    
    helpers.push(helper);
    agents.push(helper);
  }
  
  // Generate victims by demographic
  const victimGroups = [
    { type: 'youth', count: demographics.youth, urgencyLevel: urgencyLevels.youth },
    { type: 'adult', count: demographics.adult, urgencyLevel: urgencyLevels.adult },
    { type: 'elderly', count: demographics.elderly, urgencyLevel: urgencyLevels.elderly },
    { type: 'disabled', count: demographics.disabled, urgencyLevel: urgencyLevels.disabled },
  ];
  
  // Group to store victims by type for assignment
  const victimsByType = {
    youth: [],
    adult: [],
    disabled: [],
    elderly: []
  };
  
  // Generate all victims
  victimGroups.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      let row, col, distance;
      
      do {
        row = Math.floor(Math.random() * maxRows) + 1;
        col = Math.floor(Math.random() * maxCols) + 1;
        
        // Calculate distance in grid cells
        const rowDiff = row - shelterRow;
        const colDiff = col - shelterCol;
        distance = Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
      } while (distance < minimumCellDistance);
      
      const victim = {
        row: row,
        col: col,
        type: group.type,
        urgencyLevel: urgencyLevels[group.type],
        isVictim: true,
        reachedGoal: false,
        permanentlyAtGoal: false,
        counted: false,
        startDelay: Math.random() < 0.5 ? 1800 : 0, // 30 minutes in seconds for half of victims
        initialDistance: distance
      };
      
      victimsByType[group.type].push(victim);
      agents.push(victim);
    }
  });
  
  // Track total agents by type for calculations
  totalAgentsByType = {
    youth: demographics.youth,
    adult: demographics.adult,
    elderly: demographics.elderly,
    disabled: demographics.disabled
  };
  
  // Create a copy of helpers array to track available helpers
  const availableHelpers = [...helpers];
  
  const highPriorityVictims = [];
  const lowPriorityVictims = [];

  // Group victims by their actual urgency level
  Object.keys(victimsByType).forEach(type => {
    const urgencyLevel = urgencyLevels[type];
    const victims = victimsByType[type];
    
    if (urgencyLevel === 1) {
      highPriorityVictims.push(...victims);
    } else {
      lowPriorityVictims.push(...victims);
    }
  });

  console.log(`High priority victims: ${highPriorityVictims.length}, Low priority victims: ${lowPriorityVictims.length}`);
  
  // NEW PRIORITIZATION LOGIC WITH BIAS
  // Calculate how many helpers to assign to high priority victims
  const highPriorityHelperCount = Math.floor(availableHelpers.length * (priorityBias / 100));
  const lowPriorityHelperCount = availableHelpers.length - highPriorityHelperCount;

  console.log(`Assigning ${highPriorityHelperCount} helpers to high priority and ${lowPriorityHelperCount} to low priority victims`);

  // Split our helper pool based on the bias
  const highPriorityHelpers = availableHelpers.slice(0, highPriorityHelperCount);
  const lowPriorityHelpers = availableHelpers.slice(highPriorityHelperCount);

  // Assign high priority helpers to high priority victims first
  highPriorityHelpers.forEach(helper => {
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

  // Assign low priority helpers to low priority victims first
  lowPriorityHelpers.forEach(helper => {
    if (lowPriorityVictims.length === 0) {
      // If no low priority victims left, assign to high priority
      if (highPriorityVictims.length === 0) return;
      
      // Calculate distances to high priority victims
      const victimDistances = highPriorityVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign to closest high priority victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove victim from pool
      const index = highPriorityVictims.indexOf(closestVictim);
      if (index > -1) {
        highPriorityVictims.splice(index, 1);
      }
    } else {
      // Assign to low priority victim
      // Calculate distances to low priority victims
      const victimDistances = lowPriorityVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign to closest low priority victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove victim from pool
      const index = lowPriorityVictims.indexOf(closestVictim);
      if (index > -1) {
        lowPriorityVictims.splice(index, 1);
      }
    }
  });
  
  // Log assignment statistics
  console.log("AGENT ASSIGNMENTS:");
  const assignedVictims = agents.filter(a => a.isVictim && a.assignedHelper);
  console.log(`Assigned victims: ${assignedVictims.length}/${agents.filter(a => a.isVictim).length}`);
  
  return agents;
}

// Calculate perished people
function calculatePerished() {
  // Reset perished count
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  
  // Find all victims who didn't reach the goal
  agents.filter(a => a.isVictim && !a.permanentlyAtGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });
  
  // Add helpers who didn't reach the goal to adult perished count
  agents.filter(a => a.isHelper && !a.permanentlyAtGoal).forEach(helper => {
    perishedCount.adult++;
  });
  
  return perishedCount;
}

function resetSimulation() {
  simulationTime = 0;
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  agents = generateRandomAgents();
}

function storeResults(runNumber) {
  const result = {
    run: runNumber,
    youthSaved: savedCount.youth,
    adultSaved: savedCount.adult,
    elderlySaved: savedCount.elderly,
    disabledSaved: savedCount.disabled,
    packingSaved: savedCount.packing,
    firstAiderSaved: savedCount.first_aider,
    youthPerished: perishedCount.youth,
    adultPerished: perishedCount.adult,
    elderlyPerished: perishedCount.elderly,
    disabledPerished: perishedCount.disabled,
    totalSaved: getSavedTotal(),
    youthPercent: ((savedCount.youth / demographics.youth) * 100).toFixed(1),
    adultPercent: ((savedCount.adult / demographics.adult) * 100).toFixed(1),
    elderlyPercent: ((savedCount.elderly / demographics.elderly) * 100).toFixed(1),
    disabledPercent: ((savedCount.disabled / demographics.disabled) * 100).toFixed(1),
    totalPercent: ((getSavedTotal() / totalPopulation) * 100).toFixed(1)
  };
  simulationResults.push(result);
  
  // Update the UI with current results
  displayResults();
  document.getElementById('run-count').textContent = `Completed run ${runNumber} of ${totalRuns}`;
}

// Setup the page with UI elements
function setupPage() {
  const container = document.createElement('div');
  container.id = 'simulation-container';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.margin = '20px';
  document.body.appendChild(container);

  container.innerHTML = `
  <h2>Evacuation Simulation with Helpers and Priority-Based Rescue</h2>
  <p>Total Population: ${totalPopulation} (Youth: ${demographics.youth}, Adults: ${demographics.adult}, Elderly: ${demographics.elderly}, Disabled: ${demographics.disabled})</p>
  <div id="control-panel">
    <button id="start-button">Run ${totalRuns} Simulations</button>
    <p id="run-count">Click button to start simulations</p>
    <div id="progress-bar" style="height: 20px; width: 100%; background-color: #eee; margin-top: 10px; display: none;">
      <div id="progress" style="height: 100%; width: 0%; background-color: #4CAF50;"></div>
    </div>
  </div>
  <div id="simulation-results">
    <h3>Simulation Results:</h3>
    <div id="results-content">Results will appear here after running simulations.</div>
  </div>`;

  document.getElementById('start-button').addEventListener('click', function() {
    this.disabled = true;
    document.getElementById('run-count').textContent = `Starting run 1 of ${totalRuns}...`;
    runCounter = 0;
    simulationResults = [];
    runSimulation();
  });
}

// Add an option to customize demographics
function addDemographicsCustomization() {
  const controls = document.getElementById('control-panel');
  
  const demographicsForm = document.createElement('div');
  demographicsForm.innerHTML = `
    <h3>Customize Demographics</h3>
    <div style="display: grid; grid-template-columns: auto auto; gap: 10px; margin-bottom: 20px;">
      <label for="youth-input">Youth:</label>
      <input type="number" id="youth-input" value="${demographics.youth}" min="1">
      
      <label for="adult-input">Adults:</label>
      <input type="number" id="adult-input" value="${demographics.adult}" min="1">
      
      <label for="elderly-input">Elderly:</label>
      <input type="number" id="elderly-input" value="${demographics.elderly}" min="1">
      
      <label for="disabled-input">Disabled:</label>
      <input type="number" id="disabled-input" value="${demographics.disabled}" min="1">
      
      <label for="victim-helper-ratio">Victim to Helper Ratio:</label>
      <input type="number" id="victim-helper-ratio" value="${victimToHelperRatio}" min="1" max="10" step="0.5">
      
      <label for="runs-input">Number of Runs:</label>
      <input type="number" id="runs-input" value="${totalRuns}" min="1" max="50">
    </div>
    <button id="update-demographics">Update Demographics</button>
  `;
  
  controls.appendChild(demographicsForm);
  
  document.getElementById('update-demographics').addEventListener('click', function() {
    demographics.youth = parseInt(document.getElementById('youth-input').value) || 3500;
    demographics.adult = parseInt(document.getElementById('adult-input').value) || 3940;
    demographics.elderly = parseInt(document.getElementById('elderly-input').value) || 1160;
    demographics.disabled = parseInt(document.getElementById('disabled-input').value) || 170;
    victimToHelperRatio = parseFloat(document.getElementById('victim-helper-ratio').value) || 1.3;
    totalRuns = parseInt(document.getElementById('runs-input').value) || 10;
    
    totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;
    
    // Update UI to reflect changes
    document.querySelector('#simulation-container > p').textContent = 
      `Total Population: ${totalPopulation} (Youth: ${demographics.youth}, Adults: ${demographics.adult}, Elderly: ${demographics.elderly}, Disabled: ${demographics.disabled})`;
    
    document.getElementById('start-button').textContent = `Run ${totalRuns} Simulations`;
    
    alert('Demographics updated successfully!');
  });
}

// Advanced features - ability to modify speeds and shelter location
function addAdvancedSettings() {
  const advancedSection = document.createElement('div');
  advancedSection.innerHTML = `
    <h3>Advanced Settings</h3>
    <button id="toggle-advanced" style="margin-bottom: 10px;">Show Advanced Settings</button>
    <div id="advanced-settings" style="display: none; margin-bottom: 20px;">
      <h4>Movement Speeds (cells per second)</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px; margin-bottom: 10px;">
        <label for="youth-speed">Youth Speed:</label>
        <input type="number" id="youth-speed" value="${baseVictimSpeeds.youth}" step="0.0001" min="0.0001">
        
        <label for="adult-speed">Adult Speed:</label>
        <input type="number" id="adult-speed" value="${baseVictimSpeeds.adult}" step="0.0001" min="0.0001">
        
        <label for="elderly-speed">Elderly Speed:</label>
        <input type="number" id="elderly-speed" value="${baseVictimSpeeds.elderly}" step="0.0001" min="0.0001">
        
        <label for="disabled-speed">Disabled Speed:</label>
        <input type="number" id="disabled-speed" value="${baseVictimSpeeds.disabled}" step="0.0001" min="0.0001">
      </div>
      
      <h4>Urgency Levels (1-2, where 1 is high priority)</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px; margin-bottom: 10px;">
        <label for="youth-urgency">Youth Urgency:</label>
        <input type="number" id="youth-urgency" value="${urgencyLevels.youth}" min="1" max="2" step="1">
        
        <label for="adult-urgency">Adult Urgency:</label>
        <input type="number" id="adult-urgency" value="${urgencyLevels.adult}" min="1" max="2" step="1">
        
        <label for="elderly-urgency">Elderly Urgency:</label>
        <input type="number" id="elderly-urgency" value="${urgencyLevels.elderly}" min="1" max="2" step="1">
        
        <label for="disabled-urgency">Disabled Urgency:</label>
        <input type="number" id="disabled-urgency" value="${urgencyLevels.disabled}" min="1" max="2" step="1">
      </div>
      
      <h4>Priority Settings</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px; margin-bottom: 10px;">
        <label for="priority-bias">Priority Bias (% for high priority):</label>
        <input type="number" id="priority-bias" value="${priorityBias}" min="0" max="100" step="5">
      </div>

      <h4>Shelter Location</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px;">
        <label for="shelter-row">Shelter Row (1-${gridSize}):</label>
        <input type="number" id="shelter-row" value="${goal.row}" min="1" max="${gridSize}">
        
        <label for="shelter-col">Shelter Column (1-${gridSize}):</label>
        <input type="number" id="shelter-col" value="${goal.col}" min="1" max="${gridSize}">
      </div>
      
      <h4>Simulation Time</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px;">
        <label for="sim-time">Max Simulation Time (seconds):</label>
        <input type="number" id="sim-time" value="${maxSimulationTime}" min="600" step="600">
      </div>
      
      <button id="update-advanced" style="margin-top: 10px;">Update Advanced Settings</button>
    </div>
  `;
  
  document.getElementById('control-panel').appendChild(advancedSection);
  
  document.getElementById('toggle-advanced').addEventListener('click', function() {
    const advancedSettings = document.getElementById('advanced-settings');
    if (advancedSettings.style.display === 'none') {
      advancedSettings.style.display = 'block';
      this.textContent = 'Hide Advanced Settings';
    } else {
      advancedSettings.style.display = 'none';
      this.textContent = 'Show Advanced Settings';
    }
  });
  
  document.getElementById('update-advanced').addEventListener('click', function() {
    baseVictimSpeeds.youth = parseFloat(document.getElementById('youth-speed').value) || 0.00603;
    baseVictimSpeeds.adult = parseFloat(document.getElementById('adult-speed').value) || 0.00598;
    baseVictimSpeeds.elderly = parseFloat(document.getElementById('elderly-speed').value) || 0.00533;
    baseVictimSpeeds.disabled = parseFloat(document.getElementById('disabled-speed').value) || 0.00518;
    baseVictimSpeeds.packing = baseVictimSpeeds.youth;
    baseVictimSpeeds.first_aider = baseVictimSpeeds.youth;
    
    urgencyLevels.youth = parseInt(document.getElementById('youth-urgency').value) || 2;
    urgencyLevels.adult = parseInt(document.getElementById('adult-urgency').value) || 2;
    urgencyLevels.elderly = parseInt(document.getElementById('elderly-urgency').value) || 1;
    urgencyLevels.disabled = parseInt(document.getElementById('disabled-urgency').value) || 1;
    
    goal.row = parseInt(document.getElementById('shelter-row').value) || gridSize/2;
    goal.col = parseInt(document.getElementById('shelter-col').value) || gridSize/2;
    
    maxSimulationTime = parseInt(document.getElementById('sim-time').value) || 7200;
    priorityBias = parseInt(document.getElementById('priority-bias').value) || 99;
    
    alert('Advanced settings updated successfully!');
  });
}

function displayResults() {
  let resultText = '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
  resultText += `
    <tr>
      <th>Run</th>
      <th>Youth Saved</th>
      <th>Adults Saved</th>
      <th>Elderly Saved</th>
      <th>Disabled Saved</th>
      <th>Total Saved</th>
    </tr>`;
  
  // Individual run results
  simulationResults.forEach(result => {
    resultText += `
      <tr>
        <td>${result.run}</td>
        <td>${result.youthSaved} (${result.youthPercent}%)</td>
        <td>${result.adultSaved} (${result.adultPercent}%)</td>
        <td>${result.elderlySaved} (${result.elderlyPercent}%)</td>
        <td>${result.disabledSaved} (${result.disabledPercent}%)</td>
        <td>${result.totalSaved} (${result.totalPercent}%)</td>
      </tr>`;
  });
  
  // Calculate averages if we have multiple runs
  if (simulationResults.length > 1) {
    const avgYouthSaved = simulationResults.reduce((sum, r) => sum + r.youthSaved, 0) / simulationResults.length;
    const avgAdultSaved = simulationResults.reduce((sum, r) => sum + r.adultSaved, 0) / simulationResults.length;
    const avgElderlySaved = simulationResults.reduce((sum, r) => sum + r.elderlySaved, 0) / simulationResults.length;
    const avgDisabledSaved = simulationResults.reduce((sum, r) => sum + r.disabledSaved, 0) / simulationResults.length;
    const avgTotalSaved = simulationResults.reduce((sum, r) => sum + r.totalSaved, 0) / simulationResults.length;
    
    const avgYouthPercent = ((avgYouthSaved / demographics.youth) * 100).toFixed(1);
    const avgAdultPercent = ((avgAdultSaved / demographics.adult) * 100).toFixed(1);
    const avgElderlyPercent = ((avgElderlySaved / demographics.elderly) * 100).toFixed(1);
    const avgDisabledPercent = ((avgDisabledSaved / demographics.disabled) * 100).toFixed(1);
    const avgTotalPercent = ((avgTotalSaved / totalPopulation) * 100).toFixed(1);
    
    resultText += `
      <tr style="font-weight: bold; background-color: #f0f0f0;">
        <td>Average</td>
        <td>${avgYouthSaved.toFixed(1)} (${avgYouthPercent}%)</td>
        <td>${avgAdultSaved.toFixed(1)} (${avgAdultPercent}%)</td>
        <td>${avgElderlySaved.toFixed(1)} (${avgElderlyPercent}%)</td>
        <td>${avgDisabledSaved.toFixed(1)} (${avgDisabledPercent}%)</td>
        <td>${avgTotalSaved.toFixed(1)} (${avgTotalPercent}%)</td>
      </tr>`;
  }
  
  resultText += '</table>';
  
  document.getElementById('results-content').innerHTML = resultText;
}

// Initialize the page
window.onload = function() {
  setupPage();
  addDemographicsCustomization();
  addAdvancedSettings();
};
