// Add this at the top if not present
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
var isRunning = false;
var timer = 7200;  // Simulate 2 hours (7200 seconds)
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

var goal = { row: 5, col: 5 };
var victims = [];

var demographics = {
  youth: 35,
  adult: 394,
  elderly: 11,
  disabled: 1
  // youth: 3503,
  // adult: 3944,
  // elderly: 1166,
  // disabled: 175
};

var totalPopulation = demographics.youth + demographics.adult + demographics.elderly + demographics.disabled;

var baseVictimSpeeds = {
  youth: 0.75 / 300,
  adult: 1.0 / 300,
  elderly: 0.5 / 300,
  disabled: 0.25 / 300
};

var victimSpeeds = Object.assign({}, baseVictimSpeeds);

// const epsilon = 0.1; // Removed in favor of snap-to-goal logic
let simulationResults = [];
let runCounter = 0;
let totalRuns = 5;

function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

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

function updateVictims() {
  victims.forEach(v => {
    if (v.saved) return;

    if (v.startDelay > 0) {
      v.startDelay -= 1 / (1000 / window.simInterval);
      return;
    }

    let speed = victimSpeeds[v.type];

    let colDiff = goal.col - v.col;
let rowDiff = goal.row - v.row;

if (Math.abs(colDiff) <= speed && Math.abs(rowDiff) <= speed) {
  v.col = goal.col;
  v.row = goal.row;
  savedCount[v.type]++;
  v.saved = true;
  return;
}
if (Math.abs(colDiff) > speed) {
  v.col += Math.sign(colDiff) * speed;
}
if (Math.abs(rowDiff) > speed) {
  v.row += Math.sign(rowDiff) * speed;
}

    if (Math.abs(v.row - goal.row) < epsilon && Math.abs(v.col - goal.col) < epsilon && !v.saved) {
      v.row = goal.row;
      v.col = goal.col;
      savedCount[v.type]++;
      v.saved = true;
    }
  });
}

function simStep() {
  if (!isRunning) return;
  updateVictims();
  renderVictims();
  renderGoal();
  updateCounters(timer);

  if (victims.every(v => v.saved)) endSimulation();
}

function updateCounters(currentTime) {
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth} / ${demographics.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult} / ${demographics.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly} / ${demographics.elderly}`;
  document.getElementById('disabled-count').textContent = `Disabled Saved: ${savedCount.disabled} / ${demographics.disabled}`;
  document.getElementById('timer-count').textContent = `Time Remaining: ${currentTime}s`;
  document.getElementById('run-count').textContent = `Current Run: ${runCounter+1} of ${totalRuns}`;
}

function generateVictimsWithDemographics() {
  const maxCols = Math.floor((window.innerWidth - 40) / cellSize);
  const maxRows = Math.floor((window.innerHeight - 100) / cellSize);
  const positions = [];

  const groups = [
    { type: 'youth', count: demographics.youth },
    { type: 'adult', count: demographics.adult },
    { type: 'elderly', count: demographics.elderly },
    { type: 'disabled', count: demographics.disabled },
  ];

  groups.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      positions.push({
        row: Math.floor(Math.random() * maxRows) + 1,
        col: Math.floor(Math.random() * maxCols) + 1,
        type: group.type,
        saved: false,
        startDelay: Math.random() < 0.5 ? 900 : 0
      });
    }
  });

  return positions;
}

function setupCanvas() {
  var w = window.innerWidth - 40;
  var h = window.innerHeight - 100;
  var svg = document.getElementById("surface");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  surface = d3.select("#surface");

  const counterContainer = document.createElement('div');
  counterContainer.id = 'counter-container';
  counterContainer.style.fontFamily = 'Arial, sans-serif';
  counterContainer.style.marginBottom = '20px';
  document.body.appendChild(counterContainer);

  counterContainer.innerHTML = `
    <h3>Evacuation Simulation with Fixed Demographics</h3>
    <p>Total Population: ${totalPopulation}</p>
    <p id="youth-count"></p>
    <p id="adult-count"></p>
    <p id="elderly-count"></p>
    <p id="disabled-count"></p>
    <p id="timer-count"></p>
    <p id="run-count"></p>`;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "5";
  slider.step = "1";
  slider.value = "2";
  slider.id = "slider1";
  document.body.appendChild(slider);

  const sliderLabel = document.createElement("label");
  sliderLabel.htmlFor = "slider1";
  sliderLabel.textContent = "Simulation Speed";
  sliderLabel.style.marginRight = "10px";
  document.body.insertBefore(sliderLabel, slider);

  const startButton = document.createElement("button");
  startButton.textContent = "Start Simulation";
  startButton.id = "start-button";
  startButton.style.marginLeft = "20px";
  startButton.style.padding = "5px 15px";
  document.body.appendChild(startButton);

  startButton.addEventListener("click", () => {
    runCounter = 0;
    simulationResults = [];
    startNextRun();
  });

  const resultDiv = document.createElement('div');
  resultDiv.id = 'simulation-results';
  resultDiv.innerHTML = '<h3>Simulation Results:</h3><div id="results-content"></div>';
  resultDiv.style.fontFamily = 'Arial, sans-serif';
  resultDiv.style.marginTop = '20px';
  document.body.appendChild(resultDiv);
}

function startSim() {
  clearInterval(simTimer);
  let speedMap = [250, 500, 750, 1000, 1250, 1500];
  let selectedSpeed = speedMap[parseInt(document.getElementById("slider1").value)];
  let animationDelay = 1000 / selectedSpeed;
  window.simInterval = animationDelay;

  // Scale movement speed by selectedSpeed to reflect real-time acceleration
  victimSpeeds = {
    youth: baseVictimSpeeds.youth * selectedSpeed,
    adult: baseVictimSpeeds.adult * selectedSpeed,
    elderly: baseVictimSpeeds.elderly * selectedSpeed,
    disabled: baseVictimSpeeds.disabled * selectedSpeed
  };

  simTimer = setInterval(simStep, animationDelay);
}

function startTimer() {
  const speedMap = [250, 500, 750, 1000, 1250, 1500];
  const selectedSpeed = speedMap[parseInt(document.getElementById("slider1").value)];
  let adjustedTimer = 7200 / selectedSpeed;

  countdownTimer = setInterval(() => {
    if (adjustedTimer > 0) {
      adjustedTimer--;
      const simulatedTimeRemaining = Math.ceil(adjustedTimer * selectedSpeed);
      updateCounters(simulatedTimeRemaining);
    } else {
      endSimulation();
    }
  }, 1000);
}

function endSimulation() {
  clearInterval(countdownTimer);
  clearInterval(simTimer);
  isRunning = false;
  storeResults(runCounter + 1);
  runCounter++;
  if (runCounter < totalRuns) {
    setTimeout(() => { startNextRun(); }, 1000);
  } else {
    document.getElementById('run-count').textContent = `All ${totalRuns} runs completed`;
    displayResults();
  }
}

function startNextRun() {
  resetSimulation();
  isRunning = true;
  startSim();
  startTimer();
  updateCounters(timer);
}

function resetSimulation() {
  timer = 7200;
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  victims = generateVictimsWithDemographics();
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  renderVictims();
  renderGoal();
}

function storeResults(runNumber) {
  const result = {
    run: runNumber,
    youthSaved: savedCount.youth,
    adultSaved: savedCount.adult,
    elderlySaved: savedCount.elderly,
    disabledSaved: savedCount.disabled,
    totalSaved: savedCount.youth + savedCount.adult + savedCount.elderly + savedCount.disabled,
    youthPercent: ((savedCount.youth / demographics.youth) * 100).toFixed(1),
    adultPercent: ((savedCount.adult / demographics.adult) * 100).toFixed(1),
    elderlyPercent: ((savedCount.elderly / demographics.elderly) * 100).toFixed(1),
    disabledPercent: ((savedCount.disabled / demographics.disabled) * 100).toFixed(1)
  };
  simulationResults.push(result);
  displayResults();
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
  simulationResults.forEach(result => {
    resultText += `
      <tr>
        <td>${result.run}</td>
        <td>${result.youthSaved} (${result.youthPercent}%)</td>
        <td>${result.adultSaved} (${result.adultPercent}%)</td>
        <td>${result.elderlySaved} (${result.elderlyPercent}%)</td>
        <td>${result.disabledSaved} (${result.disabledPercent}%)</td>
        <td>${result.totalSaved}</td>
      </tr>`;
  });
  resultText += '</table>';
  document.getElementById('results-content').innerHTML = resultText;
}

window.onload = function() {
  setupCanvas();
};
