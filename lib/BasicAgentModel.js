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

// Demographics 
var demographics = {
  youth: 35034,
  adult: 39448,
  elderly: 11669,
  disabled: 1759
};

var totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;

// Ratio of victims to helpers
var victimToHelperRatio = 2;

// Adjusted movement speeds (cells per second)
var baseVictimSpeeds = {
  youth: 0.00603,  
  adult: 0.00598,  
  elderly: 0.00533, 
  disabled: 0.00518,
  packing: 0.00603,   // Same as youth
  first_aider: 0.00603 // Same as youth
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
  while (simulationTime < maxSimulationTime && !agents.every(a => a.reachedGoal)) {
    // Update all agents
    updateAgents(timeStep);
    
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
  
  // Calculate perished people and efficiency
  calculatePerished();
  efficiencyScore = calculateEfficiency();
  
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

function getSavedTotal() {
  return savedCount.youth + savedCount.adult + savedCount.elderly + savedCount.disabled;
}

function updateAgents(deltaTime) {
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
        moveTowards(agent, agent.assignedVictim, deltaTime);
      } else {
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
          moveToGoal(agent, agent.assignedVictim, deltaTime);
        }
      }
    } else if (agent.isVictim && !agent.assignedHelper) {
      // Direct movement to goal for victims without helpers
      moveTowardsGoal(agent, deltaTime);
    }
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

function moveTowardsGoal(agent, deltaTime) {
  let speed = baseVictimSpeeds[agent.type] || baseVictimSpeeds.adult;
  
  let colDiff = goal.col - agent.col;
  let rowDiff = goal.row - agent.row;

  // Arrival logic - when agent is close enough to goal
  if (Math.abs(colDiff) <= arrivalThreshold && Math.abs(rowDiff) <= arrivalThreshold) {
    agent.col = goal.col;
    agent.row = goal.row;
    agent.reachedGoal = true;
    
    // Update saved count if not already counted
    if (!agent.counted) {
      savedCount[agent.type]++;
      agent.counted = true;
    }
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

// Move helper and victim to the goal
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
    
    // Mark both as having reached goal
    victim.reachedGoal = true;
    helper.reachedGoal = true;
    
    // Update saved count if not already counted
    if (!victim.counted) {
      savedCount[victim.type]++;
      savedCount[helper.type]++;
      victim.counted = true;
      helper.counted = true;
    }
    
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
      counted: false
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
        urgencyLevel: group.urgencyLevel,
        isVictim: true,
        reachedGoal: false,
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
  agents.filter(a => a.isVictim && !a.reachedGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });
  
  // Add helpers who didn't reach the goal to adult perished count
  agents.filter(a => a.isHelper && !a.reachedGoal).forEach(helper => {
    perishedCount.adult++;
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
    efficiency: efficiencyScore,
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
    demographics.youth = parseInt(document.getElementById('youth-input').value) || 35034;
    demographics.adult = parseInt(document.getElementById('adult-input').value) || 39448;
    demographics.elderly = parseInt(document.getElementById('elderly-input').value) || 11669;
    demographics.disabled = parseInt(document.getElementById('disabled-input').value) || 1759;
    victimToHelperRatio = parseFloat(document.getElementById('victim-helper-ratio').value) || 2;
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
      
      <h4>Urgency Levels (1-3, where 1 is highest priority)</h4>
      <div style="display: grid; grid-template-columns: auto auto; gap: 10px; margin-bottom: 10px;">
        <label for="youth-urgency">Youth Urgency:</label>
        <input type="number" id="youth-urgency" value="${urgencyLevels.youth}" min="1" max="3" step="1">
        
        <label for="adult-urgency">Adult Urgency:</label>
        <input type="number" id="adult-urgency" value="${urgencyLevels.adult}" min="1" max="3" step="1">
        
        <label for="elderly-urgency">Elderly Urgency:</label>
        <input type="number" id="elderly-urgency" value="${urgencyLevels.elderly}" min="1" max="3" step="1">
        
        <label for="disabled-urgency">Disabled Urgency:</label>
        <input type="number" id="disabled-urgency" value="${urgencyLevels.disabled}" min="1" max="3" step="1">
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
    
    urgencyLevels.youth = parseInt(document.getElementById('youth-urgency').value) || 1;
    urgencyLevels.adult = parseInt(document.getElementById('adult-urgency').value) || 1;
    urgencyLevels.elderly = parseInt(document.getElementById('elderly-urgency').value) || 3;
    urgencyLevels.disabled = parseInt(document.getElementById('disabled-urgency').value) || 2;
    
    goal.row = parseInt(document.getElementById('shelter-row').value) || gridSize/2;
    goal.col = parseInt(document.getElementById('shelter-col').value) || gridSize/2;
    
    maxSimulationTime = parseInt(document.getElementById('sim-time').value) || 7200;
    
    alert('Advanced settings updated successfully!');
  });
}

// Initialize the page
window.onload = function() {
  setupPage();
  addDemographicsCustomization();
  addAdvancedSettings();
};

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
      <th>Efficiency</th>
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
        <td>${result.efficiency}%</td>
      </tr>`;
  });
  
  // Calculate averages if we have multiple runs
  if (simulationResults.length > 1) {
    const avgYouthSaved = simulationResults.reduce((sum, r) => sum + r.youthSaved, 0) / simulationResults.length;
    const avgAdultSaved = simulationResults.reduce((sum, r) => sum + r.adultSaved, 0) / simulationResults.length;
    const avgElderlySaved = simulationResults.reduce((sum, r) => sum + r.elderlySaved, 0) / simulationResults.length;
    const avgDisabledSaved = simulationResults.reduce((sum, r) => sum + r.disabledSaved, 0) / simulationResults.length;
    const avgTotalSaved = simulationResults.reduce((sum, r) => sum + r.totalSaved, 0) / simulationResults.length;
    const avgEfficiency = simulationResults.reduce((sum, r) => sum + parseFloat(r.efficiency), 0) / simulationResults.length;
    
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
        <td>${avgEfficiency.toFixed(1)}%</td>
      </tr>`;
  }
  
  resultText += '</table>';
  
  // Add detailed results for the last run
  if (simulationResults.length > 0) {
    const lastRun = simulationResults[simulationResults.length - 1];
    
    // Add priority-based results
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
    
    resultText += `
    <h3>Last Run Details</h3>
    <div style="display: flex; flex-wrap: wrap; margin-top: 20px;">
      <div style="flex: 1; min-width: 300px;">
        <h4>Victims Rescued by Priority</h4>
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
          <tr>
            <th>Priority Level</th>
            <th>Rescued</th>
            <th>Percentage</th>
          </tr>
          <tr>
            <td>High Priority (Youth & Adults)</td>
            <td>${rescuedByPriority.high}/${totalByPriority.high}</td>
            <td>${totalByPriority.high > 0 ? (rescuedByPriority.high/totalByPriority.high*100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td>Medium Priority (Disabled)</td>
            <td>${rescuedByPriority.medium}/${totalByPriority.medium}</td>
            <td>${totalByPriority.medium > 0 ? (rescuedByPriority.medium/totalByPriority.medium*100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td>Low Priority (Elderly)</td>
            <td>${rescuedByPriority.low}/${totalByPriority.low}</td>
            <td>${totalByPriority.low > 0 ? (rescuedByPriority.low/totalByPriority.low*100).toFixed(1) : 0}%</td>
          </tr>
        </table>
      </div>
      <div style="flex: 1; min-width: 300px;">
        <h4>Helper Performance</h4>
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
          <tr>
            <th>Helper Type</th>
            <th>Saved Count</th>
          </tr>
          <tr>
            <td>Packing Helpers</td>
            <td>${lastRun.packingSaved}</td>
          </tr>
          <tr>
            <td>First Aid Helpers</td>
            <td>${lastRun.firstAiderSaved}</td>
          </tr>
        </table>
      </div>
    </div>`;
    
    // Add chart for demographic comparison
    resultText += `
    <h3>Last Run Demographic Comparison</h3>
    <div style="display: flex; height: 300px; margin-top: 20px;">
      <div style="flex: 1; text-align: center;">
        <div style="font-weight: bold;">Saved Percentage by Demographic</div>
        <div style="display: flex; height: 250px; align-items: flex-end; justify-content: space-around; margin-top: 10px;">
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="height: ${lastRun.youthPercent * 2}px; width: 50px; background-color: #4CAF50;"></div>
            <div>Youth<br>${lastRun.youthPercent}%</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="height: ${lastRun.adultPercent * 2}px; width: 50px; background-color: #2196F3;"></div>
            <div>Adults<br>${lastRun.adultPercent}%</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="height: ${lastRun.elderlyPercent * 2}px; width: 50px; background-color: #FFC107;"></div>
            <div>Elderly<br>${lastRun.elderlyPercent}%</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="height: ${lastRun.disabledPercent * 2}px; width: 50px; background-color: #F44336;"></div>
            <div>Disabled<br>${lastRun.disabledPercent}%</div>
          </div>
        </div>
      </div>
    </div>`;
  }
  
  document.getElementById('results-content').innerHTML = resultText;
}