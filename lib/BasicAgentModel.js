var surface;
var cellSize = 40;
var victimImages = {
  youth: "image/play.png",
  adult: "images/People-Patient-Female-icon.png",
  elderly: "images/next.png",
  disabled: "images/pause.png"
};
var animationDelay = 200;
var simTimer;
var isRunning = true;

// Meeting point
var goal = { row: 5, col: 5 };

var victims = [];

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
    .attr("xlink:href", "images/Doctor_Male.png")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", getPixelCoord(goal).x)
    .attr("y", getPixelCoord(goal).y);
}

// Function to update the positions of the victims
function updateVictims() {
  victims.forEach((v, index) => {
    if (v.row < goal.row) v.row++;
    else if (v.row > goal.row) v.row--;
    else if (v.col < goal.col) v.col++;
    else if (v.col > goal.col) v.col--;

    // When a victim reaches the goal, spawn a new one at a random location
    if (v.row === goal.row && v.col === goal.col) {
      victims[index] = {
        row: Math.floor(Math.random() * 20) + 1,
        col: Math.floor(Math.random() * 30) + 1,
        type: getRandomVictimType()
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
      type: getRandomVictimType() // Assign type when generating victims
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

  victims = generateRandomVictims(50);  // Generate 10 random victims based on the ratio

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

  // Set timeout to stop the simulation after 20 seconds
  setTimeout(() => {
    isRunning = false; // Stop simulation
    clearInterval(simTimer); // Clear the interval to stop simStep from running
    console.log("Simulation ended after 20 seconds.");
  }, 20000);  // 20000ms = 20 seconds
}


// Function to start the simulation
function startSim() {
  clearInterval(simTimer);
  animationDelay = 550 - Number(document.getElementById("slider1").value);
  simTimer = setInterval(simStep, animationDelay);
}

// Initialize the canvas when the window is loaded
window.onload = setupCanvas;
