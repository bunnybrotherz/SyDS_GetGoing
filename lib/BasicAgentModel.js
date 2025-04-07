var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/bed-icon.png",
  adult: "images/People-Patient-Female-icon.png",
  elderly: "images/chair-icon.png",
  disabled: "images/pause.png",
  packing: "images/play.png",
  first_aider: "images/stop.png"
};

var simTimer;
var isRunning = false;  // Set isRunning to false initially, so the simulation won't run on load
var timer = 30;  // Timer duration in seconds
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var agents = [];  // All agents (victims + helpers)

// Ratio of victims to helpers (1:1 by default)
var victimToHelperRatio = 1; // Ratio (e.g., 1 for 1:1 ratio, 2 for 2:1 ratio, etc.)

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 1.0,
  adult: 1.0,
  elderly: 0.5,
  disabled: 0.25,
};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.1; // Small tolerance value

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

function renderAgents() {
  surface.selectAll("image.agent").remove();  // Remove previous images

  surface.selectAll("image.agent")
    .data(agents.filter(agent => !agent.reachedGoal))  // Only show agents that have not reached the goal yet
    .enter()
    .append("image")
    .attr("class", "agent")
    .attr("xlink:href", d => victimImages[d.type])  // Assuming `victimImages` is an object where types map to image URLs
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", function(d) {
      const pixelCoord = getPixelCoord(d);
      const x = pixelCoord.x;
      if (isNaN(x)) {
        console.error("Invalid x coordinate for agent:", d);
        return 0;  // Default to 0 if x is invalid
      }
      return x;
    })
    .attr("y", function(d) {
      const pixelCoord = getPixelCoord(d);
      const y = pixelCoord.y;
      if (isNaN(y)) {
        console.error("Invalid y coordinate for agent:", d);
        return 0;  // Default to 0 if y is invalid
      }
      return y;
    });
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

// Function to update the positions of the agents
function updateAgents() {
  const now = Date.now(); // Current time in milliseconds

  agents.forEach((a) => {
    if (a.assignedVictim && !a.reachedGoal && !a.assignedVictim.reachedGoal) {
      // Check if the helper has reached the victim
      const reachedVictim = Math.abs(a.row - a.assignedVictim.row) <= epsilon &&
                            Math.abs(a.col - a.assignedVictim.col) <= epsilon;

      if (!reachedVictim) {
        moveTowards(a, a.assignedVictim); // Move towards the victim
      } else {
        // Mark the time when the helper meets the victim
        if (!a.waitingSince) {
          a.waitingSince = now; // Start waiting
        }

        // Wait for 15 seconds before evacuation
        const waitDuration = 15000; // 15s in milliseconds
        if (now - a.waitingSince >= waitDuration) {
          moveToGoal(a, a.assignedVictim);

          // Check if both the helper and victim have reached the goal
          const reachedGoal = Math.abs(a.row - goal.row) < epsilon &&
                              Math.abs(a.col - goal.col) < epsilon;

          if (reachedGoal) {
            savedCount[a.type]++;
            savedCount[a.assignedVictim.type]++;
            a.reachedGoal = true;
            a.assignedVictim.reachedGoal = true;
          }
        }
      }
    }
  });
}




// Move agent towards the target (either a victim or goal)
function moveTowards(agent, target) {
  let speed = victimSpeeds[agent.type]; // Speed of the helper

  if (Math.abs(target.col - agent.col) > epsilon) {
    let moveX = Math.sign(target.col - agent.col) * speed;
    agent.col += moveX;
  }
  
  if (Math.abs(target.row - agent.row) > epsilon) {
    let moveY = Math.sign(target.row - agent.row) * speed;
    agent.row += moveY;
  }  
}

// Move both the helper and the victim to the goal at the victim's speed
function moveToGoal(helper, victim) {
  let speed = victimSpeeds[victim.type]; // Speed of the victim (which is the speed both will move towards the goal)

  // Move both helper and victim towards the goal
  if (Math.abs(goal.col - victim.col) > epsilon) {
    let moveX = Math.sign(goal.col - victim.col) * speed;
    victim.col += moveX;
    helper.col += moveX;
  }

  if (Math.abs(goal.row - victim.row) > epsilon) {
    let moveY = Math.sign(goal.row - victim.row) * speed;
    victim.row += moveY;
    helper.row += moveY;
  }
}

// Function to get random agent type (victims and helpers)
function getRandomAgentType() {
  const rand = Math.random();
  if (rand < (1 / (1 + victimToHelperRatio))) {
    return getRandomVictimType(); // Return a random victim type
  } else {
    return getRandomHelperType();  // Return a random helper type
  }
}

// Function to get random victim type based on the ratio
function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.99) return 'elderly';
  return 'disabled';
}

// Function to get random helper type
function getRandomHelperType() {
  const rand = Math.random();
  if (rand < 0.5) return 'packing';
  return 'first_aider';
}

// Function for simulation step (agents move towards goal)
function simStep() {
  if (!isRunning) return;
  updateAgents();
  renderAgents();
  renderGoal();
  updateCounters();
}

// Function to update the displayed counter values
function updateCounters() {
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `Disabled Saved: ${savedCount.disabled}`;
  document.getElementById('helper-count').textContent = `Helpers Saved: ${savedCount.helper}`;
  document.getElementById('timer-count').textContent = `Time Remaining: ${timer}s`;
}

// Function to generate random agents based on the defined ratio
function generateRandomAgents(count) {
  const maxCols = Math.floor((window.innerWidth - 40) / cellSize);
  const maxRows = Math.floor((window.innerHeight - 100) / cellSize);
  const positions = [];

  // Determine how many helpers and victims based on the defined ratio
  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;

  // Generate helpers
  for (let i = 0; i < helpersCount; i++) {
    positions.push({
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomHelperType()
    });
  }

  // Generate victims
  for (let i = 0; i < victimsCount; i++) {
    positions.push({
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomVictimType()
    });
  }

  // Assign helpers to victims
  for (let i = 0; i < helpersCount; i++) {
    positions[i].assignedVictim = positions[victimsCount + i];  // Assign a victim to the helper
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

  agents = generateRandomAgents(10);  // Generate 100 agents based on the ratio

  // Add a container for counters outside the field
  const counterContainer = document.createElement('div');
  counterContainer.id = 'counter-container';
  document.body.appendChild(counterContainer);

  counterContainer.innerHTML = `
    <p id="youth-count">Youth Saved: 0</p>
    <p id="adult-count">Adults Saved: 0</p>
    <p id="elderly-count">Elderly Saved: 0</p>
    <p id="disabled-count">Disabled Saved: 0</p>
    <p id="helper-count">Helpers Saved: 0</p>
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
    isRunning = true;
    startSim();
    startTimer();
  });
}

// Function to start the simulation
function startSim() {
  clearInterval(simTimer);

  // Adjust the simulation speed by changing the interval based on slider value
  let speedMap = [0.25, 0.5, 1, 2, 4];  // Corresponding time multipliers for 0.25x, 0.5x, 1x, 2x, and 4x speeds
  let selectedSpeed = speedMap[parseInt(document.getElementById("slider1").value)];

  // Adjust the animation delay based on the selected speed
  animationDelay = 550 / selectedSpeed;

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
      clearInterval(countdownTimer);
      isRunning = false;
      clearInterval(simTimer);
      alert(`Simulation ended!\nYouth: ${savedCount.youth}\nAdults: ${savedCount.adult}\nElderly: ${savedCount.elderly}\nDisabled: ${savedCount.disabled}\nHelpers: ${savedCount.helper}`);
    }
  }, 1000);
}

// Initialize the canvas when the window is loaded
window.onload = setupCanvas;
