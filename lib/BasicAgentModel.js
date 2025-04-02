var surface;
var cellSize = 40;
var victimImage = "images/People-Patient-Female-icon.png";
var doctorImage = "images/Doctor_Male.png";
var animationDelay = 200;
var simTimer;
var isRunning = true;

// Meeting point
var goal = { row: 5, col: 5 };

var victims = [];

function getPixelCoord(location) {
  return {
    x: (location.col - 1) * cellSize,
    y: (location.row - 1) * cellSize
  };
}

function renderVictims() {
  surface.selectAll("image.victim").remove();

  surface.selectAll("image.victim")
    .data(victims)
    .enter()
    .append("image")
    .attr("class", "victim")
    .attr("xlink:href", victimImage)
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => getPixelCoord(d).x)
    .attr("y", d => getPixelCoord(d).y);
}

function renderGoal() {
  surface.selectAll("image.goal").remove();

  surface.append("image")
    .attr("class", "goal")
    .attr("xlink:href", doctorImage)
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", getPixelCoord(goal).x)
    .attr("y", getPixelCoord(goal).y);
}

function updateVictims() {
  victims.forEach((v, index) => {
    // Move towards goal
    if (v.row < goal.row) v.row++;
    else if (v.row > goal.row) v.row--;
    else if (v.col < goal.col) v.col++;
    else if (v.col > goal.col) v.col--;

    // When a victim reaches the goal, spawn a new one at a random location
    if (v.row === goal.row && v.col === goal.col) {
      victims[index] = {
        row: Math.floor(Math.random() * 20) + 1,
        col: Math.floor(Math.random() * 30) + 1
      };
    }
  });
}

function simStep() {
  if (!isRunning) return;
  updateVictims();
  renderVictims();
  renderGoal();
}

function generateRandomVictims(count) {
  const maxCols = Math.floor((window.innerWidth - 40) / cellSize);
  const maxRows = Math.floor((window.innerHeight - 100) / cellSize);
  const positions = [];

  for (let i = 0; i < count; i++) {
    positions.push({
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1
    });
  }
  return positions;
}

function setupCanvas() {
  var w = window.innerWidth - 40;
  var h = window.innerHeight - 100;

  var svg = document.getElementById("surface");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);

  surface = d3.select("#surface");
  victims = generateRandomVictims(10);

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
    console.log("Simulation ended after 5 seconds.");
  }, 5000);  
}

function startSim() {
  clearInterval(simTimer);
  animationDelay = 550 - Number(document.getElementById("slider1").value);
  simTimer = setInterval(simStep, animationDelay);
}

window.onload = setupCanvas;
