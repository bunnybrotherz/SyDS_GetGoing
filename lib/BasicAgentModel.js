var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/youth.png",
  adult: "images/adult.png",
  elderly: "images/elderly.png",
  disabled: "images/disabled.png"
};

var simTimer;
var countdownTimer;
var isRunning = false;
var timer = 30;
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
var perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 }; 

// Add a global speed variable
var speedMultiplier = 1.0;

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var victims = [];

// Speed multipliers for different victim types
var victimSpeeds = {
  youth: 0.1,    // Faster than adults
  adult: 0.1,    // Normal speed
  elderly: 0.05,  // Much slower than before
  disabled: 0.04  // Even slower
};

// Urgency levels to maintain visual indicators
var urgencyLevels = {
  youth: 1,    // High urgency
  adult: 1,    // High urgency
  elderly: 2,  // Medium urgency
  disabled: 2  // Medium urgency
};

// Total victims by type for statistics
var totalVictimsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.2;

// Function to calculate distance between two points
function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.row - point2.row, 2) + 
    Math.pow(point1.col - point2.col, 2)
  );
}

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

// Function to render the goal point
function renderGoal() {
  surface.selectAll("image.goal").remove();
  
  surface.append("image")
    .attr("class", "goal")
    .attr("xlink:href", "images/floodshelter.png")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", getPixelCoord(goal).x)
    .attr("y", getPixelCoord(goal).y);
}

// Function to update victim positions
function updateVictims() {
  const now = Date.now();

  victims.forEach((victim) => {
    if (victim.reachedGoal) return;
    
    // Check if victim is in delay period
    if (victim.hasDelay && now - victim.spawnTime < 20000 / speedMultiplier) {
      return; // Skip movement for victims in delay period
    }
    
    // Move directly to goal
    moveToGoal(victim);
  });
}

// Function to move a victim toward the goal
function moveToGoal(victim) {
  // Check if already very close to goal - if so, snap to exact position and mark as reached
  if (Math.abs(goal.col - victim.col) <= epsilon && Math.abs(goal.row - victim.row) <= epsilon) {
    // Snap exactly to goal position
    victim.col = goal.col;
    victim.row = goal.row;
    
    // Mark as having reached goal
    victim.reachedGoal = true;
    
    // Update saved count if not already counted
    if (!victim.counted) {
      savedCount[victim.type]++;
      victim.counted = true;
      console.log(`Victim ${victim.type} reached goal and was counted`);
    }
    
    return;
  }
  
  let speed = victimSpeeds[victim.type];
  
  // Apply global speed multiplier
  speed *= speedMultiplier;
  
  // Calculate distance to goal for adaptive speed
  const distanceToGoal = calculateDistance(victim, goal);
  
  // Reduce speed as we get closer to the goal to prevent overshooting
  // The closer to the goal, the slower the movement
  const adaptiveSpeedFactor = Math.min(1.0, distanceToGoal / 2);
  
  if (Math.abs(goal.col - victim.col) > epsilon) {
    // If very close to target column, snap directly
    if (Math.abs(goal.col - victim.col) <= speed * 0.1) {
      victim.col = goal.col;
    } else {
      let moveX = Math.sign(goal.col - victim.col) * speed * 0.1 * adaptiveSpeedFactor;
      // Ensure minimum movement to prevent getting stuck
      moveX = (Math.abs(moveX) < 0.01) ? Math.sign(moveX) * 0.01 : moveX;
      victim.col += moveX;
    }
  }

  if (Math.abs(goal.row - victim.row) > epsilon) {
    // If very close to target row, snap directly
    if (Math.abs(goal.row - victim.row) <= speed * 0.1) {
      victim.row = goal.row;
    } else {
      let moveY = Math.sign(goal.row - victim.row) * speed * 0.1 * adaptiveSpeedFactor;
      // Ensure minimum movement to prevent getting stuck
      moveY = (Math.abs(moveY) < 0.01) ? Math.sign(moveY) * 0.01 : moveY;
      victim.row += moveY;
    }
  }
}

// Function to get a random victim type
function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.9) return 'elderly';
  return 'disabled';
}

function simStep() {
  if (!isRunning) return;
  updateVictims();
  renderVictims();
  renderGoal();
  updateCounters();
}

// Function to generate random victims
function generateRandomVictims(count) {
  // Use the simulation area dimensions
  const simulationSvg = document.getElementById("surface");
  const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
  const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
  
  const victims = [];
  
  // Reset total counts
  totalVictimsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

  for (let i = 0; i < count; i++) {
    const victimType = getRandomVictimType();
    totalVictimsByType[victimType]++;
    
    // Make sure victims don't spawn on the goal
    let row, col;
    do {
      row = Math.floor(Math.random() * maxRows) + 1;
      col = Math.floor(Math.random() * maxCols) + 1;
    } while (row === goal.row && col === goal.col);
    
    // Determine if this victim has a delay (50% chance)
    const hasDelay = Math.random() < 0.5;
    
    const victim = {
      row: row,
      col: col,
      type: victimType,
      urgencyLevel: urgencyLevels[victimType],
      reachedGoal: false,
      counted: false,
      hasDelay: hasDelay,
      spawnTime: Date.now() // Used to track delay time
    };
    
    victims.push(victim);
  }
  
  // Log victim distribution
  console.log("=== VICTIM DISTRIBUTION ===");
  console.log(`Youth victims: ${victims.filter(v => v.type === 'youth').length}`);
  console.log(`Adult victims: ${victims.filter(v => v.type === 'adult').length}`);
  console.log(`Disabled victims: ${victims.filter(v => v.type === 'disabled').length}`);
  console.log(`Elderly victims: ${victims.filter(v => v.type === 'elderly').length}`);
  console.log(`Victims with delay: ${victims.filter(v => v.hasDelay).length}`);

  return victims;
}

// Function to calculate perished victims
function calculatePerished() {
  // Reset perished count
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
  
  // Find all victims who didn't reach the goal
  victims.filter(v => !v.reachedGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });
  
  return perishedCount;
}

// Function to render victims
function renderVictims() {
  surface.selectAll("image.victim").remove();
  surface.selectAll("circle.urgency").remove();
  
  // Draw urgency circles for victims not yet reached goal
  surface.selectAll("circle.urgency")
    .data(victims.filter(victim => !victim.reachedGoal))
    .enter()
    .append("circle")
    .attr("class", "urgency")
    .attr("cx", d => (d.col - 0.5) * cellSize)
    .attr("cy", d => (d.row - 0.5) * cellSize)
    .attr("r", cellSize / 2)
    .attr("fill", d => {
      // Show delayed victims with a different visualization
      if (d.hasDelay && Date.now() - d.spawnTime < 10000 / speedMultiplier) {
        return "rgba(100, 100, 100, 0.5)"; // Gray for delayed victims
      } else if (d.urgencyLevel === 1) {
        return "rgba(255, 99, 132, 0.3)";  // Youth and adults
      } else {
        return "rgba(255, 159, 64, 0.3)"; // Elderly and Disabled
      }
    });

  // Render victims
  surface.selectAll("image.victim")
    .data(victims.filter(victim => !victim.reachedGoal))
    .enter()
    .append("image")
    .attr("class", "victim")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => (d.col - 1) * cellSize)
    .attr("y", d => (d.row - 1) * cellSize)
    .attr("opacity", d => {
      // Show delayed victims with reduced opacity
      return (d.hasDelay && Date.now() - d.spawnTime < 10000 / speedMultiplier) ? 0.5 : 1.0;
    });
}

// Function to update counters
function updateCounters() {
  const totalVictims = victims.length;
  const savedByUrgency = {
    1: victims.filter(v => v.reachedGoal && v.urgencyLevel === 1).length,
    2: victims.filter(v => v.reachedGoal && v.urgencyLevel === 2).length
  };
  
  const totalByUrgency = {
    1: victims.filter(v => v.urgencyLevel === 1).length,
    2: victims.filter(v => v.urgencyLevel === 2).length
  };
  
  // Update stat boxes with saved counts
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `PWD Saved: ${savedCount.disabled}`;
  document.getElementById('timer-count').textContent = `Time: ${timer}s`;
  
  // Calculate and display the number of victims currently delayed
  const currentlyDelayed = victims.filter(v => 
    !v.reachedGoal && v.hasDelay && (Date.now() - v.spawnTime < 20000 / speedMultiplier)
  ).length;
  
  // Display information about delayed victims
  const delayedElement = document.getElementById('delayed-count');
  if (delayedElement) {
    delayedElement.textContent = `Delayed Victims: ${currentlyDelayed}`;
  }
  
  // Update progress bars in the urgency stats section
  document.getElementById('urgency-stats').innerHTML = `
    <div class="urgency-progress">
      <div>High Priority (Youth & Adults): ${savedByUrgency[1]}/${totalByUrgency[1]} (${totalByUrgency[1] > 0 ? Math.round(savedByUrgency[1]/totalByUrgency[1]*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill high-fill" style="width: ${totalByUrgency[1] > 0 ? Math.round(savedByUrgency[1]/totalByUrgency[1]*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Low Priority (Elderly & PWD): ${savedByUrgency[2]}/${totalByUrgency[2]} (${totalByUrgency[2] > 0 ? Math.round(savedByUrgency[2]/totalByUrgency[2]*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill medium-fill" style="width: ${totalByUrgency[2] > 0 ? Math.round(savedByUrgency[2]/totalByUrgency[2]*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Delayed Victims: ${currentlyDelayed}/${victims.filter(v => v.hasDelay).length}</div>
      <div class="progress-bar">
        <div class="progress-fill delay-fill" style="width: ${victims.filter(v => v.hasDelay).length > 0 ? Math.round(currentlyDelayed/victims.filter(v => v.hasDelay).length*100) : 0}%"></div>
      </div>
    </div>
  `;
}

// Function to handle slider changes
function updateSpeed() {
  const speedMap = [0.25, 0.5, 1, 2, 4];
  speedMultiplier = speedMap[parseInt(document.getElementById("slider1").value)];
  
  // If simulation is already running, restart it with new speed
  if (isRunning) {
    clearInterval(simTimer);
    startSim();
  }
}

// Function to start simulation
function startSim() {
  if (isRunning) {
    // Update based on speed - faster speed means more frequent updates
    const baseInterval = 100;
    const interval = baseInterval / speedMultiplier;
    simTimer = setInterval(simStep, interval);
  }
}

// Function to cleanup timers
function cleanupTimers() {
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  isRunning = false;
}

// Function to setup canvas
function setupCanvas() {
  try {
    // Check if d3 is defined
    if (typeof d3 === 'undefined') {
      console.error('D3 library is not loaded. Please include the D3.js library in your HTML.');
      
      // Create a fallback error message
      const simulationArea = document.querySelector(".simulation-area");
      simulationArea.innerHTML = '<div style="color:red; padding:20px;">Error: D3.js library is not loaded. Please add <code>&lt;script src="https://d3js.org/d3.v7.min.js"&gt;&lt;/script&gt;</code> to your HTML before this script.</div>';
      return;
    }
    
    // Use dimensions from the SVG in the HTML structure
    const simulationSvg = document.getElementById("surface");
    surface = d3.select("#surface");

    // Generate 30 victims
    victims = generateRandomVictims(30);
    
    // Directly attach event listeners to HTML elements
    document.getElementById("slider1").addEventListener("input", updateSpeed);
    
    // Initialize speed multiplier
    updateSpeed();

    document.getElementById("start-button").addEventListener("click", () => {
      isRunning = true;
      startSim();
      startTimer();
    });
    
    renderGoal();
    renderVictims();
    updateCounters();
  } catch (error) {
    console.error('Error in setupCanvas:', error);
    const simulationArea = document.querySelector(".simulation-area");
    simulationArea.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
  }
}

// Function to show results
function showResults() {
  cleanupTimers();
  
  // Calculate perished people
  const perished = calculatePerished();
  
  const rescuedByPriority = {
    high: victims.filter(v => v.reachedGoal && v.urgencyLevel === 1).length,
    medium: victims.filter(v => v.reachedGoal && v.urgencyLevel === 2).length
  };
  
  const totalByPriority = {
    high: victims.filter(v => v.urgencyLevel === 1).length,
    medium: victims.filter(v => v.urgencyLevel === 2).length
  };
  
  const delayedVictims = victims.filter(v => v.hasDelay).length;
  const savedDelayed = victims.filter(v => v.hasDelay && v.reachedGoal).length;
  
  const results = {
    youth: savedCount.youth,
    adult: savedCount.adult,
    elderly: savedCount.elderly,
    disabled: savedCount.disabled
  };
  
  // Create modal
  const modalOverlay = document.createElement('div');
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = '0';
  modalOverlay.style.left = '0';
  modalOverlay.style.width = '100%';
  modalOverlay.style.height = '100%';
  modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modalOverlay.style.display = 'flex';
  modalOverlay.style.justifyContent = 'center';
  modalOverlay.style.alignItems = 'center';
  modalOverlay.style.zIndex = '1000';
  
  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = 'white';
  modalContent.style.padding = '30px';
  modalContent.style.borderRadius = '10px';
  modalContent.style.maxWidth = '500px';
  modalContent.style.width = '80%';
  modalContent.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
  modalContent.style.maxHeight = '80vh'; // Limit height
  modalContent.style.overflowY = 'auto'; // Enable vertical scroll
  
  modalContent.innerHTML = `
    <h2 style="color:#2c3e50; margin-top:0;">Simulation Results</h2>
    
    <h3 style="color:#2c3e50;">Victims Saved by Type</h3>
    <div class="stat-box high-urgency">Youth: ${results.youth} (${totalVictimsByType.youth - results.youth} perished)</div>
    <div class="stat-box high-urgency">Adults: ${results.adult} (${totalVictimsByType.adult - results.adult} perished)</div>
    <div class="stat-box medium-urgency">Elderly: ${results.elderly} (${totalVictimsByType.elderly - results.elderly} perished)</div>
    <div class="stat-box medium-urgency">PWD: ${results.disabled} (${totalVictimsByType.disabled - results.disabled} perished)</div>
    
    <h3 style="color:#2c3e50; margin-top:20px;">Victims Saved by Priority</h3>
    <div class="urgency-progress">
      <div>High Priority (Youth & Adults): ${rescuedByPriority.high}/${totalByPriority.high} (${totalByPriority.high > 0 ? Math.round(rescuedByPriority.high/totalByPriority.high*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill high-fill" style="width: ${totalByPriority.high > 0 ? Math.round(rescuedByPriority.high/totalByPriority.high*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Low Priority (Elderly & PWD): ${rescuedByPriority.medium}/${totalByPriority.medium} (${totalByPriority.medium > 0 ? Math.round(rescuedByPriority.medium/totalByPriority.medium*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill medium-fill" style="width: ${totalByPriority.medium > 0 ? Math.round(rescuedByPriority.medium/totalByPriority.medium*100) : 0}%"></div>
      </div>
    </div>
    
    <h3 style="color:#2c3e50; margin-top:20px;">Impact of Delay</h3>
    <div>Victims with delay: ${delayedVictims}</div>
    <div>Delayed victims saved: ${savedDelayed} (${delayedVictims > 0 ? Math.round(savedDelayed/delayedVictims*100) : 0}%)</div>
    <div>Victims without delay saved: ${victims.filter(v => !v.hasDelay && v.reachedGoal).length}/${victims.filter(v => !v.hasDelay).length} (${victims.filter(v => !v.hasDelay).length > 0 ? Math.round(victims.filter(v => !v.hasDelay && v.reachedGoal).length/victims.filter(v => !v.hasDelay).length*100) : 0}%)</div>
    
    <button id="close-modal" class="btn btn-primary" style="margin-top:20px;">Close</button>
  `;
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  document.getElementById('close-modal').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
}

// Function to start timer
function startTimer() {
  let adjustedTimer = timer / speedMultiplier;
  
  countdownTimer = setInterval(() => {
    if (adjustedTimer > 0) {
      adjustedTimer--;
      timer = Math.ceil(adjustedTimer);
      updateCounters();
    } else {
      clearInterval(countdownTimer);
      isRunning = false;
      clearInterval(simTimer);
      
      // Show results
      showResults();
    }
  }, 1000);
}

// Initialize the simulation when the page loads
window.onload = setupCanvas;