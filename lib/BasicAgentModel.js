var surface;
var cellSize = 40;
var victimImages = {
  youth: "image/bed-icon.png",
  adult: "images/People-Patient-Female-icon.png",
  elderly: "images/chair-icon.png",
  disabled: "images/pause.png"
};
var animationDelay = 200;
var simTimer;
var isRunning = true;

// Meeting point
var goal = { row: 5, col: 5 };

var victims = [];

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 1.0,    // 1.5 times faster than adults
  adult: 1.0,    // Regular speed
  elderly: 0.5,  // Slower
  disabled: 0.25 // Very slow
};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.1; // Small tolerance value

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

    // Calculate movement towards the goal
    let moveX = Math.sign(goal.col - v.col) * speed;  // Move along X-axis
    let moveY = Math.sign(goal.row - v.row) * speed;  // Move along Y-axis

    // Update position
    v.col += moveX;
    v.row += moveY;

    // Stop victim if it is within tolerance of the goal (goal reached)
    if (Math.abs(v.row - goal.row) < epsilon && Math.abs(v.col - goal.col) < epsilon) {
      v.row = goal.row;
      v.col = goal.col;

      // When a victim reaches the goal, spawn a new one at a random location
      victims[index] = {
        row: Math.floor(Math.random() * 20) + 1, // Random row between 1 and 20
        col: Math.floor(Math.random() * 30) + 1, // Random col between 1 and 30
        type: getRandomVictimType() // Assign random type based on ratio
      };
    }
  });
}

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

  victims = generateRandomVictims(100);  // Generate 10 random victims based on the ratio

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
}

// Function to start the simulation
function startSim() {
  clearInterval(simTimer);
  animationDelay = 550 - Number(document.getElementById("slider1").value);
  simTimer = setInterval(simStep, animationDelay);
}

// Initialize the canvas when the window is loaded
window.onload = setupCanvas;
