var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/bed-icon.png",
  adult: "images/People-Patient-Female-icon.png",
  elderly: "images/chair-icon.png",
  disabled: "images/pause.png"
};
var animationDelay = 200;
var simTimer;
var isRunning = true;

// Meeting point (goal)
var goal = { row: 5, col: 5 };

var victims = [];

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 1.0,    // Regular speed
  adult: 1.0,    // Regular speed
  elderly: 0.5,  // Slower
  disabled: 0.25 // Very slow
};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.1; // Small tolerance value

// Counter for victims saved
var savedCount = {
  youth: 0,
  adult: 0,
  elderly: 0,
  disabled: 0
};

// Timer for the simulation duration
var timer = 20; // 20 seconds

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return {
    x: (location.col - 1) * cellSize,
    y: (location.row - 1) * cellSize
  };
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
    .attr("xlink:href", "images/Doctor_Male.png") // Placeholder image for goal
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", getPixelCoord(goal).x)
    .attr("y", getPixelCoord(goal).y);
}

// Function to update the positions of the victims
function updateVictims() {
  victims.forEach((v, index) => {
    let speed = victimSpeeds[v.type];  // Get the speed for each victim type

    // Calculate horizontal movement (left or right)
    if (Math.abs(goal.col - v.col) > epsilon) {
      let moveX = Math.sign(goal.col - v.col) * speed;  // Move along X-axis
      v.col += moveX;
    }

    // Calculate vertical movement (up or down)
    if (Math.abs(goal.row - v.row) > epsilon) {
      let moveY = Math.sign(goal.row - v.row) * speed;  // Move along Y-axis
      v.row += moveY;
    }

    // Check if the victim is within tolerance of the larger goal
    if (Math.abs(v.row - goal.row) < epsilon && Math.abs(v.col - goal.col) < epsilon) {
      v.row = goal.row;
      v.col = goal.col;

      // Increment saved count for the victim's type
      savedCount[v.type]++;

      // When a victim reaches the goal, spawn a new one at a random location
      victims[index] = {
        row: Math.floor(Math.random() * 20) + 1, // Random row between 1 and 20
        col: Math.floor(Math.random() * 30) + 1, // Random col between 1 and 30
        type: getRandomVictimType() // Assign random type based on ratio
      };
    }
  });
}

// Function to get random victim type based on the ratio
function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';   // 25% chance for youth
  if (rand < 0.75) return 'adult';   // 50% chance for adult
  if (rand < 0.99) return 'elderly'; // 24% chance for elderly
  return 'disabled';                 // 1% chance for disabled
}

// Function for simulation step (victims move towards goal)
function simStep() {
  if (!isRunning) return;
  updateVictims();
  renderVictims();
  renderGoal();
  updateCounters();
}

// Function to update the displayed counter values
function updateCounters() {
  // Display the number of saved victims
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `Disabled Saved: ${savedCount.disabled}`;
  
}

// Function to generate random victims with the specified ratio
function generateRandomVictims(count) {
  const maxCols = Math.floor((window.innerWidth - 40) / cellSize);
  const maxRows = Math.floor((window.innerHeight - 100) / cellSize);
  const positions = [];

  for (let i = 0; i < count; i++) {
    positions.push({
      row: Math.floor(Math.random() * maxRows) + 1,  // Random row
      col: Math.floor(Math.random() * maxCols) + 1,  // Random column
      type: getRandomVictimType() // Assign random type based on ratio
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

  victims = generateRandomVictims(100);  // Generate 100 random victims based on the ratio

  // Add a container for counters outside the field
  const counterContainer = document.createElement('div');
  counterContainer.id = 'counter-container';
  document.body.appendChild(counterContainer);

  // Create counters for each victim type
  counterContainer.innerHTML = `
    <p id="youth-count">Youth Saved: 0</p>
    <p id="adult-count">Adults Saved: 0</p>
    <p id="elderly-count">Elderly Saved: 0</p>
    <p id="disabled-count">Disabled Saved: 0</p>
  `;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "1";
  slider.max = "500";
  slider.value = "300";
  slider.id = "slider1";
  document.body.appendChild(slider);

  renderVictims();
  renderGoal();

  startSim();
  slider.addEventListener("input", startSim);

  // Set timer to stop simulation after XX seconds
  setTimeout(() => {
    isRunning = false; // Stop simulation
    clearInterval(simTimer); // Stop the simulation step
    clearInterval(countdownTimer); // Stop the timer
    console.log("Simulation ended after 20 seconds.");
    alert(`Simulation ended!\nYouth: ${savedCount.youth}\nAdults: ${savedCount.adult}\nElderly: ${savedCount.elderly}\nDisabled: ${savedCount.disabled}`);
  }, 5000);  
}

// Function to start the simulation
function startSim() {
  clearInterval(simTimer);
  animationDelay = 550 - Number(document.getElementById("slider1").value);
  simTimer = setInterval(simStep, animationDelay);
}

// Initialize the canvas when the window is loaded
window.onload = setupCanvas;
