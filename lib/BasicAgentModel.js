// Pure simulation without visualization
var isRunning = false;
var simulationTime = 0;
var maxSimulationTime = 7200; // 2 hours in seconds
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

var gridSize = 52; // Adjusted grid size for better scale
var goal = { row: gridSize/2, col: gridSize/2 }; // Center of grid
var victims = [];

var demographics = {
  youth: 35034,
  adult: 39448,
  elderly: 11669,
  disabled: 1759
};

var totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;

// Adjusted movement speeds (cells per second)
var baseVictimSpeeds = {
  youth: 0.00540,  
  adult: 0.00490,  
  elderly: 0.00460, 
  disabled: 0.00440 
};

let simulationResults = [];
let runCounter = 0;
let totalRuns = 100;

// Main function for handling simulation
function runSimulation(simulationSpeedMultiplier = 1000) {
  // Reset for this run
  resetSimulation();
  
  // Run the full simulation in one go (no animation frames)
  // For smaller simulations (< 1000 agents), use smaller timeStep
  // For larger simulations (> 10000 agents), use larger timeStep
  const timeStep = totalPopulation > 10000 ? 50 : 
                   totalPopulation > 1000 ? 10 : 0.1;
  
  simulationTime = 0;
  
  console.log(`Starting simulation run ${runCounter+1}...`);
  
  // Progress tracking
  let lastProgressReport = 0;
  
  // Run until simulation ends
  while (simulationTime < maxSimulationTime && !victims.every(v => v.saved)) {
    // Update all victims
    updateVictims(timeStep);
    
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

function updateVictims(deltaTime) {
  victims.forEach(v => {
    if (v.saved) return;
    
    if (v.startDelay > 0) {
      v.startDelay -= deltaTime;
      return;
    }

    let speed = baseVictimSpeeds[v.type];
    
    let colDiff = goal.col - v.col;
    let rowDiff = goal.row - v.row;

    // Arrival logic - when victim is close enough to goal
    const arrivalThreshold = 0.1;
    if (Math.abs(colDiff) <= arrivalThreshold && Math.abs(rowDiff) <= arrivalThreshold) {
      v.col = goal.col;
      v.row = goal.row;
      savedCount[v.type]++;
      v.saved = true;
      return;
    }
    
    // Calculate distance and direction vector
    let distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff);
    
    if (distance > 0) {
      // Normalize the direction vector
      let dirCol = colDiff / distance;
      let dirRow = rowDiff / distance;
      
      // Apply movement with delta time
      v.col += dirCol * speed * deltaTime;
      v.row += dirRow * speed * deltaTime;
    }
  });
}

function generateVictimsWithDemographics() {
  const maxCols = gridSize;
  const maxRows = gridSize;
  const positions = [];
  // For 3.7km minimum distance with 126m per cell
  const minimumCellDistance = 30; 
  const shelterRow = goal.row;
  const shelterCol = goal.col;

  const groups = [
    { type: 'youth', count: demographics.youth },
    { type: 'adult', count: demographics.adult },
    { type: 'elderly', count: demographics.elderly },
    { type: 'disabled', count: demographics.disabled },
  ];

  groups.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      let row, col, distance;
      
      // Keep generating positions until we find one that's at least 3.7km away
      do {
        row = Math.floor(Math.random() * maxRows) + 1;
        col = Math.floor(Math.random() * maxCols) + 1;
        
        // Calculate distance in grid cells
        const rowDiff = row - shelterRow;
        const colDiff = col - shelterCol;
        distance = Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
      } while (distance < minimumCellDistance);
      
      positions.push({
        row: row,
        col: col,
        type: group.type,
        saved: false,
        startDelay: Math.random() < 0.5 ? 900 : 0, // 15 minutes in seconds
        initialDistance: distance
      });
    }
  });

  return positions;
}

function setupPage() {
  const container = document.createElement('div');
  container.id = 'simulation-container';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.margin = '20px';
  document.body.appendChild(container);

  container.innerHTML = `
  <h2>Evacuation Simulation with Fixed Demographics</h2>
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

function resetSimulation() {
  simulationTime = 0;
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  victims = generateVictimsWithDemographics();
}

function storeResults(runNumber) {
  const result = {
    run: runNumber,
    youthSaved: savedCount.youth,
    adultSaved: savedCount.adult,
    elderlySaved: savedCount.elderly,
    disabledSaved: savedCount.disabled,
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
  
  // Add chart for demographic comparison if we have results
  if (simulationResults.length > 0) {
    const lastRun = simulationResults[simulationResults.length - 1];
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
      
      <label for="runs-input">Number of Runs:</label>
      <input type="number" id="runs-input" value="${totalRuns}" min="1" max="50">
    </div>
    <button id="update-demographics">Update Demographics</button>
  `;
  
  controls.appendChild(demographicsForm);
  
  document.getElementById('update-demographics').addEventListener('click', function() {
    demographics.youth = parseInt(document.getElementById('youth-input').value) || 350;
    demographics.adult = parseInt(document.getElementById('adult-input').value) || 390;
    demographics.elderly = parseInt(document.getElementById('elderly-input').value) || 110;
    demographics.disabled = parseInt(document.getElementById('disabled-input').value) || 10;
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
    baseVictimSpeeds.youth = parseFloat(document.getElementById('youth-speed').value) || 0.00530;
    baseVictimSpeeds.adult = parseFloat(document.getElementById('adult-speed').value) || 0.00480;
    baseVictimSpeeds.elderly = parseFloat(document.getElementById('elderly-speed').value) || 0.00450;
    baseVictimSpeeds.disabled = parseFloat(document.getElementById('disabled-speed').value) || 0.00430;
    
    goal.row = parseInt(document.getElementById('shelter-row').value) || gridSize/2;
    goal.col = parseInt(document.getElementById('shelter-col').value) || gridSize/2;
    
    maxSimulationTime = parseInt(document.getElementById('sim-time').value) || 7200;
    
    alert('Advanced settings updated successfully!');
  });
}

// Performance optimization for large simulations
function getOptimalTimeStep(agentCount) {
  if (agentCount > 50000) return 50;
  if (agentCount > 10000) return 30;
  if (agentCount > 1000) return 10;
  return 0.1;
}

// Initialize the page
window.onload = function() {
  setupPage();
  addDemographicsCustomization();
  addAdvancedSettings();
};