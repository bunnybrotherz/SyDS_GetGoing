var surface;
var cellSize = 40;
var victimImage = "images/People-Patient-Female-icon.png";
var doctorImage = "images/Doctor_Male.png";
var animationDelay = 200;
var simTimer;

// Meeting point
var goal = { row: 5, col: 5 };

var victims = [
  { row: 3, col: 2 },
  { row: 5, col: 8 },
  { row: 7, col: 15 },
  { row: 9, col: 4 },
  { row: 6, col: 20 },
  { row: 12, col: 25 },
  { row: 14, col: 6 },
  { row: 11, col: 18 },
  { row: 16, col: 10 },
  { row: 17, col: 28 }
];

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
  victims.forEach((v) => {
    if (v.row < goal.row) v.row++;
    else if (v.row > goal.row) v.row--;
    else if (v.col < goal.col) v.col++;
    else if (v.col > goal.col) v.col--;
    // stops when v.row === goal.row && v.col === goal.col
  });
}

function simStep() {
  updateVictims();
  renderVictims();
  renderGoal();
}

function setupCanvas() {
  var w = window.innerWidth - 40;
  var h = window.innerHeight - 100;

  var svg = document.getElementById("surface");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);

  surface = d3.select("#surface");

  // Add slider
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "1";
  slider.max = "500";
  slider.value = "300";
  slider.id = "slider1";
  document.body.appendChild(slider);

  // Initial render
  renderVictims();
  renderGoal();

  function startSim() {
    clearInterval(simTimer);
    animationDelay = 550 - Number(slider.value);
    simTimer = setInterval(simStep, animationDelay);
  }

  startSim();

  slider.addEventListener("input", startSim);
}

window.onload = setupCanvas;
