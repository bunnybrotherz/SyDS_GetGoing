// FOR FIRST AID: 75% PRIORITY BIAS
// FOR PACKING: 25% BIAS

// Core simulation variables
var isRunning = false;
var simulationTime = 0;
var maxSimulationTime = 7200; // 2 hours in seconds
var savedCount = { firstAid: 0, packing: 0, helper: 0 };
var perishedCount = { firstAid: 0, packing: 0 };
var simTimer;
var countdownTimer;

var gridSize = 52; // Adjusted grid size for better scale
var goal = { row: gridSize/2, col: gridSize/2 }; // Center of grid
var agents = [];

// Priority bias - percentage of helpers to assign to first aid victims first (0-100)
var priorityBias = 75; 

// Demographics 
var demographics = {
  youth: 3500,
  adult: 3940,
  elderly: 1160,
  disabled: 170
};

var totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;

// Percentage of adults that become helpers
var helperPercentage = 0.75; // 

// Adjusted movement speeds (cells per second)
var baseVictimSpeeds = {
  youth: 0.03618,    
  adult: 0.03588,    
  elderly: 0.03198,  
  disabled: 0.03108, 
  helper: 0.03618  // Same as youth
};

// Tracking variables
var totalAgentsByType = { firstAid: 0, packing: 0 };

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
  const unassignedFirstAidVictims = agents.filter(a => 
    a.isVictim && !a.assignedHelper && !a.reachedGoal && a.needsFirstAid);
    
  const unassignedPackingVictims = agents.filter(a => 
    a.isVictim && !a.assignedHelper && !a.reachedGoal && a.needsPacking);
  
  // Assign based on help type priority, then proximity
  availableHelpers.forEach(helper => {
    // Reset helper's state for new assignment
    helper.reachedGoal = false;
    
    // Check first aid victims first (high priority)
    if (unassignedFirstAidVictims.length > 0) {
      assignHelperToClosestVictim(helper, unassignedFirstAidVictims);
    } 
    // Then check packing victims (low priority)
    else if (unassignedPackingVictims.length > 0) {
      assignHelperToClosestVictim(helper, unassignedPackingVictims);
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
  
  console.log(`Reassigned helper to ${closestVictim.needsFirstAid ? 'First Aid' : 'Packing'} victim at distance ${victimDistances[0].distance.toFixed(2)}`);
}

function getSavedTotal() {
  return savedCount.firstAid + savedCount.packing;
}

function updateAgents(deltaTime) {
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
          
          // Determine wait duration based on victim's needs
          if (agent.assignedVictim.needsFirstAid) {
            agent.currentWaitDuration = window.firstAidWaitTime || 1200; // 20 minutes for first aid
          } else {
            agent.currentWaitDuration = window.packingWaitTime || 900; // 15 minutes for packing
          }
        }

        // Check if waiting is done
        if (simulationTime - agent.waitingSince >= agent.currentWaitDuration) {
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
      // Count by help type instead of age demographic
      if (victim.needsFirstAid) {
        savedCount.firstAid++;
      } else {
        savedCount.packing++;
      }
      victim.counted = true;
      
      // Only count helper once when they're permanently at the goal
      if (helper.permanentlyAtGoal && !helper.counted) {
        savedCount.helper++;
        helper.counted = true;
      }
    }
    
    // Clear the assignment and waiting state for the helper for potential reassignment
    helper.waitingSince = null;
    
    return;
  }
  
  // Get victim's speed based on their demographic
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
  
  // Calculate number of helpers from adult population
  const helperCount = Math.floor(demographics.adult * helperPercentage);
  // Update adult victims count
  const adultVictims = demographics.adult - helperCount;
  
  console.log(`Converting ${helperCount} adults to helpers, leaving ${adultVictims} adult victims`);
  
  // Get a completely random probability for first aid for this run
  const firstAidProbability = Math.random();
  console.log(`This run's probability of needing first aid: ${(firstAidProbability * 100).toFixed(1)}%`);
  
  // Generate helper agents (converted adults)
  const helpers = [];
  for (let i = 0; i < helperCount; i++) {
    let row, col, distance;
    
    do {
      row = Math.floor(Math.random() * maxRows) + 1;
      col = Math.floor(Math.random() * maxCols) + 1;
      
      // Calculate distance in grid cells
      const rowDiff = row - shelterRow;
      const colDiff = col - shelterCol;
      distance = Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
    } while (distance < minimumCellDistance);
    
    const helper = {
      row: row,
      col: col,
      type: 'helper',
      isHelper: true,
      reachedGoal: false,
      permanentlyAtGoal: false,
      counted: false,
      victimsHelped: 0
    };
    
    helpers.push(helper);
    agents.push(helper);
  }
  
  // Generate victims by demographic (with adjusted adult count)
  const victimGroups = [
    { type: 'youth', count: demographics.youth },
    { type: 'adult', count: adultVictims }, // Adjusted count
    { type: 'elderly', count: demographics.elderly },
    { type: 'disabled', count: demographics.disabled },
  ];
  
  // Group to store victims by help type for assignment
  const victimsByHelpType = {
    firstAid: [],
    packing: []
  };
  
  // Generate all victims
  let totalFirstAidVictims = 0;
  let totalPackingVictims = 0;
  
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
      
      // Randomly determine if victim needs first aid (using run's probability)
      const needsFirstAid = Math.random() < firstAidProbability;
      
      const victim = {
        row: row,
        col: col,
        type: group.type,
        isVictim: true,
        reachedGoal: false,
        permanentlyAtGoal: false,
        counted: false,
        initialDistance: distance,
        needsFirstAid: needsFirstAid,
        needsPacking: !needsFirstAid  // If they don't need first aid, they need packing
      };
      
      // Sort victim by help type for assignment
      if (victim.needsFirstAid) {
        victimsByHelpType.firstAid.push(victim);
        totalFirstAidVictims++;
      } else {
        victimsByHelpType.packing.push(victim);
        totalPackingVictims++;
      }
      
      agents.push(victim);
    }
  });
  
  // Track total agents by help type for calculations
  totalAgentsByType = {
    firstAid: totalFirstAidVictims,
    packing: totalPackingVictims,
    helper: helperCount
  };
  
  console.log(`Generated ${totalFirstAidVictims} first aid victims and ${totalPackingVictims} packing victims`);
  
  // Create a copy of helpers array to track available helpers
  const availableHelpers = [...helpers];
  
  // Calculate how many helpers to assign to first aid victims (high priority)
  const firstAidHelperCount = Math.floor(availableHelpers.length * (priorityBias / 100));
  const packingHelperCount = availableHelpers.length - firstAidHelperCount;

  console.log(`Assigning ${firstAidHelperCount} helpers to first aid victims and ${packingHelperCount} to packing victims`);

  // Split our helper pool based on the bias
  const firstAidHelpers = availableHelpers.slice(0, firstAidHelperCount);
  const packingHelpers = availableHelpers.slice(firstAidHelperCount);

  // Assign first aid helpers to first aid victims first
  firstAidHelpers.forEach(helper => {
    if (victimsByHelpType.firstAid.length === 0) return;
    
    // Calculate distances from this helper to all first aid victims
    const victimDistances = victimsByHelpType.firstAid.map(victim => {
      return {
        victim: victim,
        distance: calculateDistance(helper, victim)
      };
    });
    
    // Sort by distance (closest first)
    victimDistances.sort((a, b) => a.distance - b.distance);
    
    // Assign this helper to the closest first aid victim
    const closestVictim = victimDistances[0].victim;
    helper.assignedVictim = closestVictim;
    closestVictim.assignedHelper = helper;
    
    // Remove the assigned victim from the pool
    const index = victimsByHelpType.firstAid.indexOf(closestVictim);
    if (index > -1) {
      victimsByHelpType.firstAid.splice(index, 1);
    }
  });

  // Assign packing helpers to packing victims first
  packingHelpers.forEach(helper => {
    if (victimsByHelpType.packing.length === 0) {
      // If no packing victims left, assign to first aid victims
      if (victimsByHelpType.firstAid.length === 0) return;
      
      // Calculate distances to first aid victims
      const victimDistances = victimsByHelpType.firstAid.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign to closest first aid victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove victim from pool
      const index = victimsByHelpType.firstAid.indexOf(closestVictim);
      if (index > -1) {
        victimsByHelpType.firstAid.splice(index, 1);
      }
    } else {
      // Assign to packing victim
      // Calculate distances to packing victims
      const victimDistances = victimsByHelpType.packing.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign to closest packing victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove victim from pool
      const index = victimsByHelpType.packing.indexOf(closestVictim);
      if (index > -1) {
        victimsByHelpType.packing.splice(index, 1);
      }
    }
  });
  
  // Log assignment statistics
  console.log("AGENT ASSIGNMENTS:");
  const assignedVictims = agents.filter(a => a.isVictim && a.assignedHelper);
  console.log(`Assigned victims: ${assignedVictims.length}/${agents.filter(a => a.isVictim).length}`);
  console.log(`First Aid victims: ${totalFirstAidVictims}, Assigned: ${assignedVictims.filter(v => v.needsFirstAid).length}`);
  console.log(`Packing victims: ${totalPackingVictims}, Assigned: ${assignedVictims.filter(v => v.needsPacking).length}`);
  
  return agents;
}

// Calculate perished people
function calculatePerished() {
  // Reset perished count
  perishedCount = { firstAid: 0, packing: 0 };
  
  // Find all victims who didn't reach the goal
  agents.filter(a => a.isVictim && !a.permanentlyAtGoal).forEach(victim => {
    if (victim.needsFirstAid) {
      perishedCount.firstAid++;
    } else {
      perishedCount.packing++;
    }
  });
  
  return perishedCount;
}

function resetSimulation() {
  simulationTime = 0;
  savedCount = { firstAid: 0, packing: 0, helper: 0 };
  perishedCount = { firstAid: 0, packing: 0 };
  agents = generateRandomAgents();
}

function storeResults(runNumber) {
  // Calculate total victims by help type
  const totalFirstAidVictims = totalAgentsByType.firstAid;
  const totalPackingVictims = totalAgentsByType.packing;
  const totalVictims = totalFirstAidVictims + totalPackingVictims;
  
  const result = {
    run: runNumber,
    firstAidSaved: savedCount.firstAid,
    packingSaved: savedCount.packing,
    helperSaved: savedCount.helper,
    firstAidPerished: perishedCount.firstAid,
    packingPerished: perishedCount.packing,
    totalSaved: getSavedTotal(),
    // Calculate percentages
    firstAidPercent: ((savedCount.firstAid / totalFirstAidVictims) * 100).toFixed(1),
    packingPercent: ((savedCount.packing / totalPackingVictims) * 100).toFixed(1),
    totalPercent: ((getSavedTotal() / totalVictims) * 100).toFixed(1),
    // Add victim distribution statistics
    totalFirstAid: totalFirstAidVictims,
    totalPacking: totalPackingVictims,
    firstAidDistribution: ((totalFirstAidVictims / totalVictims) * 100).toFixed(1)
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

  // Calculate adjusted population for display
  const adultVictims = Math.floor(demographics.adult * (1 - helperPercentage));
  const totalVictims = demographics.youth + adultVictims + demographics.elderly + demographics.disabled;
  const helpers = Math.floor(demographics.adult * helperPercentage);

  container.innerHTML = `
  <h2>Evacuation Simulation with Help Type Priority</h2>
  <p>Total Population: ${totalPopulation} (Victims: ${totalVictims}, Helpers: ${helpers})</p>
  <p>Priority: ${priorityBias}% bias for First Aid victims over Packing victims</p>
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
      
      <label for="adult-input">Adults (Total):</label>
      <input type="number" id="adult-input" value="${demographics.adult}" min="1">
      
      <label for="elderly-input">Elderly:</label>
      <input type="number" id="elderly-input" value="${demographics.elderly}" min="1">
      
      <label for="disabled-input">Disabled:</label>
      <input type="number" id="disabled-input" value="${demographics.disabled}" min="1">
      
      <label for="helper-percentage">Helper Percentage (% of adults):</label>
      <input type="number" id="helper-percentage" value="${helperPercentage * 100}" min="0" max="100" step="5">
      
      <label for="priority-bias">First Aid Priority Bias (%):</label>
      <input type="number" id="priority-bias" value="${priorityBias}" min="0" max="100" step="5">
      
      <label for="runs-input">Number of Runs:</label>
      <input type="number" id="runs-input" value="${totalRuns}" min="1" max="50">
    </div>
    <button id="update-demographics">Update Settings</button>
  `;
  
  controls.appendChild(demographicsForm);
  
  document.getElementById('update-demographics').addEventListener('click', function() {
    demographics.youth = parseInt(document.getElementById('youth-input').value) || 3500;
    demographics.adult = parseInt(document.getElementById('adult-input').value) || 3940;
    demographics.elderly = parseInt(document.getElementById('elderly-input').value) || 1160;
    demographics.disabled = parseInt(document.getElementById('disabled-input').value) || 170;
    helperPercentage = parseFloat(document.getElementById('helper-percentage').value) / 100 || 0.75;
    priorityBias = parseInt(document.getElementById('priority-bias').value) || 75;
    totalRuns = parseInt(document.getElementById('runs-input').value) || 10;
    
    totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;
    
    // Calculate adjusted population for display
    const adultVictims = Math.floor(demographics.adult * (1 - helperPercentage));
    const totalVictims = demographics.youth + adultVictims + demographics.elderly + demographics.disabled;
    const helpers = Math.floor(demographics.adult * helperPercentage);
    
    // Update UI to reflect changes
    document.querySelector('#simulation-container > p:nth-child(2)').textContent = 
      `Total Population: ${totalPopulation} (Victims: ${totalVictims}, Helpers: ${helpers})`;
    document.querySelector('#simulation-container > p:nth-child(3)').textContent = 
      `Priority: ${priorityBias}% bias for First Aid victims over Packing victims`;
    
    document.getElementById('start-button').textContent = `Run ${totalRuns} Simulations`;
    
    alert('Settings updated successfully!');
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
        
        <label for="helper-speed">Helper Speed:</label>
        <input type="number" id="helper-speed" value="${baseVictimSpeeds.helper}" step="0.0001" min="0.0001">
      </div>
      
      <h4>Waiting Times</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px; margin-bottom: 10px;">
        <label for="first-aid-time">First Aid Wait Time (seconds):</label>
        <input type="number" id="first-aid-time" value="1200" min="0" step="60">
        
        <label for="packing-time">Packing Wait Time (seconds):</label>
        <input type="number" id="packing-time" value="900" min="0" step="60">
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
    baseVictimSpeeds.youth = parseFloat(document.getElementById('youth-speed').value) || 0.03618;
    baseVictimSpeeds.adult = parseFloat(document.getElementById('adult-speed').value) || 0.03588;
    baseVictimSpeeds.elderly = parseFloat(document.getElementById('elderly-speed').value) || 0.03198;
    baseVictimSpeeds.disabled = parseFloat(document.getElementById('disabled-speed').value) || 0.03108;
    baseVictimSpeeds.helper = parseFloat(document.getElementById('helper-speed').value) || 0.03618;
    
    goal.row = parseInt(document.getElementById('shelter-row').value) || gridSize/2;
    goal.col = parseInt(document.getElementById('shelter-col').value) || gridSize/2;
    
    maxSimulationTime = parseInt(document.getElementById('sim-time').value) || 7200;
    
    // Update the wait times
    const firstAidTime = parseInt(document.getElementById('first-aid-time').value) || 1200;
    const packingTime = parseInt(document.getElementById('packing-time').value) || 900;
    
    // Store these in global variables that can be accessed by updateAgents
    window.firstAidWaitTime = firstAidTime;
    window.packingWaitTime = packingTime;
    
    alert('Advanced settings updated successfully!');
  });
}

// Initialize the page
window.onload = function() {
  // Initialize default wait times
  window.firstAidWaitTime = 1200; // 20 minutes in seconds
  window.packingWaitTime = 900;   // 15 minutes in seconds
  
  setupPage();
  addDemographicsCustomization();
  addAdvancedSettings();
};

function displayResults() {
  let resultText = '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
  resultText += `
    <tr>
      <th>Run</th>
      <th>First Aid Distribution</th>
      <th>Packing Distribution</th>
      <th>First Aid Saved</th>
      <th>Packing Saved</th>
      <th>Total Saved</th>
    </tr>`;
  
  // Individual run results
  simulationResults.forEach(result => {
    resultText += `
      <tr>
        <td>${result.run}</td>
        <td>${result.totalFirstAid} (${result.firstAidDistribution}%)</td>
        <td>${result.totalPacking} (${(100 - parseFloat(result.firstAidDistribution)).toFixed(1)}%)</td>
        <td>${result.firstAidSaved} (${result.firstAidPercent}%)</td>
        <td>${result.packingSaved} (${result.packingPercent}%)</td>
        <td>${result.totalSaved} (${result.totalPercent}%)</td>
      </tr>`;
  });
  
  // Calculate averages if we have multiple runs
  if (simulationResults.length > 1) {
    const avgFirstAidSaved = simulationResults.reduce((sum, r) => sum + r.firstAidSaved, 0) / simulationResults.length;
    const avgPackingSaved = simulationResults.reduce((sum, r) => sum + r.packingSaved, 0) / simulationResults.length;
    const avgTotalSaved = simulationResults.reduce((sum, r) => sum + r.totalSaved, 0) / simulationResults.length;
    
    const avgFirstAidTotal = simulationResults.reduce((sum, r) => sum + r.totalFirstAid, 0) / simulationResults.length;
    const avgPackingTotal = simulationResults.reduce((sum, r) => sum + r.totalPacking, 0) / simulationResults.length;
    const avgFirstAidDist = simulationResults.reduce((sum, r) => sum + parseFloat(r.firstAidDistribution), 0) / simulationResults.length;
    
    // Calculate percentages
    const avgFirstAidPercent = simulationResults.reduce((sum, r) => sum + parseFloat(r.firstAidPercent), 0) / simulationResults.length;
    const avgPackingPercent = simulationResults.reduce((sum, r) => sum + parseFloat(r.packingPercent), 0) / simulationResults.length;
    const avgTotalPercent = simulationResults.reduce((sum, r) => sum + parseFloat(r.totalPercent), 0) / simulationResults.length;
    
    resultText += `
      <tr style="font-weight: bold; background-color: #f0f0f0;">
        <td>Average</td>
        <td>${avgFirstAidTotal.toFixed(1)} (${avgFirstAidDist.toFixed(1)}%)</td>
        <td>${avgPackingTotal.toFixed(1)} (${(100 - avgFirstAidDist).toFixed(1)}%)</td>
        <td>${avgFirstAidSaved.toFixed(1)} (${avgFirstAidPercent.toFixed(1)}%)</td>
        <td>${avgPackingSaved.toFixed(1)} (${avgPackingPercent.toFixed(1)}%)</td>
        <td>${avgTotalSaved.toFixed(1)} (${avgTotalPercent.toFixed(1)}%)</td>
      </tr>`;
  }
  
  resultText += '</table>';
  
  document.getElementById('results-content').innerHTML = resultText;
}