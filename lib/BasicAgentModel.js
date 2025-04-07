var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/bed-icon.png",
  adult: "images/People-Patient-Female-icon.png",
  elderly: "images/chair-icon.png",
  disabled: "images/pause.png"
};

var simTimer;
var countdownTimer;
var isRunning = false;  // Set isRunning to false initially, so the simulation won't run on load
var timer = 20;  // Timer duration in seconds
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var victims = []; // All victims (no regeneration)

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 1.0,
  adult: 1.0,
  elderly: 0.5,
  disabled: 0.25
};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.1; // Small tolerance value

// Create an array to store results
let simulationResults = [];
let runCounter = 0;  // Counter to track the current run number
let totalRuns = 5;   // Set the total number of runs

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

// Function to render victims
function renderVictims() {
  surface.selectAll("image.victim").remove();
  surface.selectAll("image.victim")
    .data(victims)
    .enter()
    .append("image")
    .attr("class", "victim")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => getPixelCoord(d).x)
    .attr("y", d => getPixelCoord(d).y);
}

// Function to render the goal point
function renderGoal() {
  surface.selectAll("image.goal").remove();
  surface.append("image")
    .attr("class", "goal")
    .attr("xlink:href", "images/Doctor_Male.png")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", getPixelCoord(goal).x)
    .attr("y", getPixelCoord(goal).y);
}

// Function to update the positions of the victims
function updateVictims() {
  victims.forEach((v, index) => {
    // Skip victims already saved
    if (v.saved) return;
    
    let speed = victimSpeeds[v.type];  // Get the speed for each victim type

    // Move the victim towards the goal
    if (Math.abs(goal.col - v.col) > epsilon) {
      let moveX = Math.sign(goal.col - v.col) * speed;
      v.col += moveX;
    }

    if (Math.abs(goal.row - v.row) > epsilon) {
      let moveY = Math.sign(goal.row - v.row) * speed;
      v.row += moveY;
    }

    // If the victim has reached the goal, increment the saved count
    if (Math.abs(v.row - goal.row) < epsilon && Math.abs(v.col - goal.col) < epsilon && !v.saved) {
      v.row = goal.row;
      v.col = goal.col;

      // Increment saved count for the victim's type
      savedCount[v.type]++;

      // Mark the victim as saved
      v.saved = true;  // Add the flag to prevent multiple increments
    }
  });
}

// Function to get random victim type based on the ratio
function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.99) return 'elderly';
  return 'disabled';
}

// Function for simulation step (victims move towards goal)
function simStep() {
  if (!isRunning) return;
  updateVictims();
  renderVictims();
  renderGoal();
  updateCounters();
  
  // Check if all victims are saved
  const allSaved = victims.every(v => v.saved);
  if (allSaved) {
    endSimulation();
  }
}

// Function to update the displayed counter values
function updateCounters() {
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `Disabled Saved: ${savedCount.disabled}`;
  document.getElementById('timer-count').textContent = `Time Remaining: ${timer}s`;
  document.getElementById('run-count').textContent = `Current Run: ${runCounter+1} of ${totalRuns}`;
}

// Function to generate random victims with the specified ratio
function generateRandomVictims(count) {
  const maxCols = Math.floor((window.innerWidth - 40) / cellSize);
  const maxRows = Math.floor((window.innerHeight - 100) / cellSize);
  const positions = [];

  for (let i = 0; i < count; i++) {
    positions.push({
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomVictimType(),
      saved: false
    });
  }
  return positions;
}

// Function to initialize the canvas
function setupCanvas() {
  var w = window.innerWidth - 40;
  var h = window.innerHeight - 100;

  var svg = document.getElementById("surface");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);

  surface = d3.select("#surface");

  // Add a container for counters outside the field
  const counterContainer = document.createElement('div');
  counterContainer.id = 'counter-container';
  document.body.appendChild(counterContainer);

  counterContainer.innerHTML = `
    <p id="youth-count">Youth Saved: 0</p>
    <p id="adult-count">Adults Saved: 0</p>
    <p id="elderly-count">Elderly Saved: 0</p>
    <p id="disabled-count">Disabled Saved: 0</p>
    <p id="timer-count">Time Remaining: ${timer}s</p>
    <p id="run-count">Current Run: 0 of ${totalRuns}</p>
  `;

  // Create a slider with 5 fixed values: 0.25, 0.5, 1, 2, 4
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "4";
  slider.step = "1";  // Only increments by 1
  slider.value = "2";  // Default value 1x
  slider.id = "slider1";
  document.body.appendChild(slider);

  // Create a start button
  const startButton = document.createElement("button");
  startButton.textContent = "Start Simulation";
  startButton.id = "start-button";
  document.body.appendChild(startButton);

  startButton.addEventListener("click", () => {
    // Reset run counter when starting manually
    runCounter = 0;
    simulationResults = [];
    startNextRun();
  });

  // Create a div to display the results
  const resultDiv = document.createElement('div');
  resultDiv.id = 'simulation-results';
  resultDiv.innerHTML = '<h3>Simulation Results:</h3><div id="results-content"></div>';
  document.body.appendChild(resultDiv);
}

// Function to start the simulation
function startSim() {
  clearInterval(simTimer);

  // Adjust the simulation speed by changing the interval based on slider value
  let speedMap = [0.25, 0.5, 1, 2, 4];  // Corresponding time multipliers for 0.25x, 0.5x, 1x, 2x, and 4x speeds
  let selectedSpeed = speedMap[parseInt(document.getElementById("slider1").value)];

  // Adjust the animation delay based on the selected speed
  let animationDelay = 550 / selectedSpeed;

  simTimer = setInterval(simStep, animationDelay);
}

// Function to start the countdown timer
function startTimer() {
  const speedMap = [0.25, 0.5, 1, 2, 4];  // Corresponding time multipliers for 0.25x, 0.5x, 1x, 2x, and 4x speeds
  const selectedSpeed = speedMap[parseInt(document.getElementById("slider1").value)];
  let adjustedTimer = timer / selectedSpeed;  // Adjust the timer based on the selected speed
  
  countdownTimer = setInterval(() => {
    if (adjustedTimer > 0) {
      adjustedTimer--;
      timer = Math.ceil(adjustedTimer);  // Update the timer display
      updateCounters();
    } else {
      endSimulation();
    }
  }, 1000);
}

// Function to end the current simulation and store results
function endSimulation() {
  clearInterval(countdownTimer);
  clearInterval(simTimer);
  isRunning = false;
  
  // Store results
  storeResults(runCounter + 1);
  
  // Start the next run or finish
  runCounter++;
  if (runCounter < totalRuns) {
    setTimeout(() => {
      startNextRun();
    }, 1000); // Short delay between runs
  } else {
    // All runs complete
    document.getElementById('run-count').textContent = `All ${totalRuns} runs completed`;
    displayResults();
  }
}

// Function to start a new simulation run
function startNextRun() {
  // Reset for a new run
  resetSimulation();
  
  // Start the new run
  isRunning = true;
  startSim();
  startTimer();
  updateCounters();
}

// Function to reset the simulation state for a new run
function resetSimulation() {
  // Reset timer
  timer = 20;
  
  // Reset saved counts
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  
  // Generate new victims
  victims = generateRandomVictims(90000);
  
  // Clear any existing timers
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  
  // Render initial state
  renderVictims();
  renderGoal();
}

// Function to store the results after each run
function storeResults(runNumber) {
  const result = {
    run: runNumber,
    youthSaved: savedCount.youth,
    adultSaved: savedCount.adult,
    elderlySaved: savedCount.elderly,
    disabledSaved: savedCount.disabled,
    totalSaved: savedCount.youth + savedCount.adult + savedCount.elderly + savedCount.disabled
  };

  // Push the result for this run into the array
  simulationResults.push(result);
  console.log("Simulation " + runNumber + " result:", result); // Print out the result
  
  // Update display after each run
  displayResults();
}

// Function to display the results in the div
function displayResults() {
  let resultText = '';
  simulationResults.forEach(result => {
    resultText += `
      <p>Run ${result.run}: 
        Youth Saved: ${result.youthSaved}, 
        Adults Saved: ${result.adultSaved}, 
        Elderly Saved: ${result.elderlySaved}, 
        Disabled Saved: ${result.disabledSaved}, 
        Total Saved: ${result.totalSaved}
      </p>`;
  });
  document.getElementById('results-content').innerHTML = resultText;
}

// Initialize the canvas when the window is loaded
window.onload = function() {
  setupCanvas();
};