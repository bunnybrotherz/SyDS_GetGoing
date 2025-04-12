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
  youth: 1.0,    // Young victims move at normal speed
  adult: 1.0,    // Adult victims move at normal speed
  elderly: 0.5,  // Elderly victims move at half speed
  disabled: 0.25, // Disabled victims move at quarter speed
  packing: 1.0,  // Helpers move at normal speed when alone
  first_aider: 1.0 // Helpers move at normal speed when alone
};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.1; // Small tolerance value

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

function renderAgents() {
  // Remove previous agent images
  surface.selectAll("image.agent").remove();  

  // Render the agents that haven't reached their goal yet
  surface.selectAll("image.agent")
    .data(agents.filter(agent => !agent.reachedGoal))  // Only show agents that have not reached the goal yet
    .enter()
    .append("image")
    .attr("class", "agent")
    .attr("xlink:href", d => victimImages[d.type])  // Assuming `victimImages` maps types to image URLs
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", function(d) {
      return d.col * cellSize;  // Positioning the image based on the column
    })
    .attr("y", function(d) {
      return d.row * cellSize;  // Positioning the image based on the row
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

  agents.forEach((agent) => {
    // Skip agents that have already reached the goal
    if (agent.reachedGoal) return;
    
    // We only update helpers with assigned victims
    if (agent.isHelper && agent.assignedVictim && !agent.assignedVictim.reachedGoal) {
      // Check if the helper has reached the victim
      const reachedVictim = Math.abs(agent.row - agent.assignedVictim.row) <= epsilon &&
                            Math.abs(agent.col - agent.assignedVictim.col) <= epsilon;

      if (!reachedVictim) {
        // Helper hasn't reached the victim yet, move towards them at helper speed
        moveTowards(agent, agent.assignedVictim);
      } else {
        // Helper has reached the victim
        // Mark the time when the helper meets the victim
        if (!agent.waitingSince) {
          agent.waitingSince = now; // Start waiting
          console.log(`Helper ${agent.type} reached victim ${agent.assignedVictim.type} and started waiting`);
        }

        // Determine wait duration based on helper type
        let waitDuration = 0;
        if (agent.type === 'packing') {
          waitDuration = 20000; // 20 seconds for packing helpers
        } else if (agent.type === 'first_aider') {
          waitDuration = 10000; // 10 seconds for first-aid helpers
        }

        // Check if we've waited long enough
        if (now - agent.waitingSince >= waitDuration) {
          // Time to move to goal - this will use the victim's speed
          moveToGoal(agent, agent.assignedVictim);
          
          // Check if both have reached the goal
          const reachedGoal = Math.abs(agent.assignedVictim.row - goal.row) <= epsilon &&
                             Math.abs(agent.assignedVictim.col - goal.col) <= epsilon;
          
          if (reachedGoal) {
            console.log(`Helper ${agent.type} and victim ${agent.assignedVictim.type} reached goal`);
            savedCount[agent.type]++;
            savedCount[agent.assignedVictim.type]++;
            agent.reachedGoal = true;
            agent.assignedVictim.reachedGoal = true;
          }
        }
      }
    }
  });
}

// Helper moves toward victim at helper's speed
function moveTowards(agent, target) {
  // Get the agent speed based on the type (helper's speed)
  let speed = victimSpeeds[agent.type] || 1.0;
  
  // Move in the x direction (horizontal)
  if (Math.abs(target.col - agent.col) > epsilon) {
    let moveX = Math.sign(target.col - agent.col) * speed;
    agent.col += moveX;
  }

  // Move in the y direction (vertical)
  if (Math.abs(target.row - agent.row) > epsilon) {
    let moveY = Math.sign(target.row - agent.row) * speed;
    agent.row += moveY;
  }
}

// Move both the helper and the victim to the goal at the victim's speed
function moveToGoal(helper, victim) {
  // IMPORTANT: Use victim's speed when moving to goal
  // This is what ensures different victim types move at different speeds
  let speed = victimSpeeds[victim.type];
  
  console.log(`Moving ${victim.type} victim to goal at speed ${speed}`);
  
  // Move both helper and victim towards the goal at victim's speed
  if (Math.abs(goal.col - victim.col) > epsilon) {
    let moveX = Math.sign(goal.col - victim.col) * speed;
    victim.col += moveX;
    helper.col = victim.col; // Keep helper with victim
  }

  if (Math.abs(goal.row - victim.row) > epsilon) {
    let moveY = Math.sign(goal.row - victim.row) * speed;
    victim.row += moveY;
    helper.row = victim.row; // Keep helper with victim
  }
}

// Function to get random agent type (victims and helpers)
function getRandomAgentType() {
  const rand = Math.random();
  if (rand < (1 / (1 + victimToHelperRatio))) {
    return getRandomHelperType();  // Return a random helper type
  } else {
    return getRandomVictimType(); // Return a random victim type
  }
}

// Function to get random victim type based on the ratio
function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.9) return 'elderly';
  return 'disabled';
}

// Function to get random helper type
function getRandomHelperType() {
  const rand = Math.random();
  if (rand < 0.5) return 'packing';
  return 'first_aider';
}

// Function to determine if a victim needs first aid or packing help
function determineVictimNeeds(victim) {
  const rand = Math.random();
  victim.needsFirstAid = rand < 0.5; // 50% chance of needing first aid
  victim.needsPacking = rand < 0.3; // 30% chance of needing packing help
  
  // Some victims might need both, some might need neither
  console.log(`Victim ${victim.type} needs: first aid=${victim.needsFirstAid}, packing=${victim.needsPacking}`);
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
  document.getElementById('packing-count').textContent = `Packing Helpers Saved: ${savedCount.packing}`;
  document.getElementById('first-aider-count').textContent = `First Aiders Saved: ${savedCount.first_aider}`;
  document.getElementById('timer-count').textContent = `Time Remaining: ${timer}s`;
}

// Function to generate random agents based on the defined ratio
function generateRandomAgents(count) {
  const maxCols = Math.floor((window.innerWidth - 40) / cellSize);
  const maxRows = Math.floor((window.innerHeight - 100) / cellSize);
  const agents = [];

  // Determine how many helpers and victims based on the defined ratio
  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;
  
  console.log(`Generating ${helpersCount} helpers and ${victimsCount} victims`);

  // Generate helpers
  const helpers = [];
  for (let i = 0; i < helpersCount; i++) {
    const helper = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    helpers.push(helper);
    agents.push(helper);
  }

  // Generate victims with different types and needs
  const victims = [];
  for (let i = 0; i < victimsCount; i++) {
    const victim = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomVictimType(),
      isVictim: true,
      reachedGoal: false
    };
    
    // Determine if this victim needs first aid or packing help
    determineVictimNeeds(victim);
    
    victims.push(victim);
    agents.push(victim);
  }

  // Assign helpers to victims based on their specialization
  assignHelpersToVictims(helpers, victims);

  return agents;
}

// Function to assign helpers to victims based on specialization
function assignHelpersToVictims(helpers, victims) {
  // First, separate helpers by type
  const firstAidHelpers = helpers.filter(h => h.type === 'first_aider');
  const packingHelpers = helpers.filter(h => h.type === 'packing');
  
  // First, assign first aid helpers to victims who need first aid
  // Find victims who need first aid
  const firstAidVictims = victims.filter(v => v.needsFirstAid && !v.assignedHelper);
  
  // Assign first aid helpers to victims needing first aid (prioritizing nearest)
  for (let helper of firstAidHelpers) {
    if (firstAidVictims.length > 0) {
      // Find the closest victim needing first aid
      let nearestVictim = null;
      let minDistance = Infinity;
      
      for (let victim of firstAidVictims) {
        const distance = Math.sqrt(
          Math.pow(victim.col - helper.col, 2) + 
          Math.pow(victim.row - helper.row, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestVictim = victim;
        }
      }
      
      // Assign the helper to this victim
      if (nearestVictim) {
        helper.assignedVictim = nearestVictim;
        nearestVictim.assignedHelper = helper;
        console.log(`Assigned ${helper.type} helper to ${nearestVictim.type} victim needing first aid`);
        
        // Remove this victim from the list so no other helper is assigned to them
        const index = firstAidVictims.indexOf(nearestVictim);
        if (index > -1) {
          firstAidVictims.splice(index, 1);
        }
      }
    }
  }
  
  // Now assign packing helpers to victims who need packing
  const packingVictims = victims.filter(v => v.needsPacking && !v.assignedHelper);
  
  // Assign packing helpers to victims needing packing help (prioritizing nearest)
  for (let helper of packingHelpers) {
    if (packingVictims.length > 0) {
      // Find the closest victim needing packing help
      let nearestVictim = null;
      let minDistance = Infinity;
      
      for (let victim of packingVictims) {
        const distance = Math.sqrt(
          Math.pow(victim.col - helper.col, 2) + 
          Math.pow(victim.row - helper.row, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestVictim = victim;
        }
      }
      
      // Assign the helper to this victim
      if (nearestVictim) {
        helper.assignedVictim = nearestVictim;
        nearestVictim.assignedHelper = helper;
        console.log(`Assigned ${helper.type} helper to ${nearestVictim.type} victim needing packing`);
        
        // Remove this victim from the list
        const index = packingVictims.indexOf(nearestVictim);
        if (index > -1) {
          packingVictims.splice(index, 1);
        }
      }
    }
  }
  
  // Now assign any remaining helpers to any unassigned victims
  const unassignedHelpers = helpers.filter(h => !h.assignedVictim);
  const unassignedVictims = victims.filter(v => !v.assignedHelper);
  
  // First, try to assign remaining first aid helpers to packing victims
  const remainingFirstAidHelpers = unassignedHelpers.filter(h => h.type === 'first_aider');
  const remainingPackingVictims = unassignedVictims.filter(v => v.needsPacking);
  
  // Assign remaining first aid helpers to victims needing packing
  for (let helper of remainingFirstAidHelpers) {
    if (remainingPackingVictims.length > 0) {
      // Find the closest victim needing packing help
      let nearestVictim = null;
      let minDistance = Infinity;
      
      for (let victim of remainingPackingVictims) {
        const distance = Math.sqrt(
          Math.pow(victim.col - helper.col, 2) + 
          Math.pow(victim.row - helper.row, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestVictim = victim;
        }
      }
      
      // Assign the helper to this victim
      if (nearestVictim) {
        helper.assignedVictim = nearestVictim;
        nearestVictim.assignedHelper = helper;
        console.log(`Assigned remaining ${helper.type} helper to ${nearestVictim.type} victim needing packing`);
        
        // Remove this victim from the list
        const index = remainingPackingVictims.indexOf(nearestVictim);
        if (index > -1) {
          remainingPackingVictims.splice(index, 1);
        }
      }
    }
  }
  
  
  // Finally, assign any remaining helpers to any remaining victims regardless of needs
  const finalUnassignedHelpers = helpers.filter(h => !h.assignedVictim);
  const finalUnassignedVictims = victims.filter(v => !v.assignedHelper);
  
  for (let helper of finalUnassignedHelpers) {
    if (finalUnassignedVictims.length > 0) {
      // Find the closest remaining victim
      let nearestVictim = null;
      let minDistance = Infinity;
      
      for (let victim of finalUnassignedVictims) {
        const distance = Math.sqrt(
          Math.pow(victim.col - helper.col, 2) + 
          Math.pow(victim.row - helper.row, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestVictim = victim;
        }
      }
      
      // Assign the helper to this victim
      if (nearestVictim) {
        helper.assignedVictim = nearestVictim;
        nearestVictim.assignedHelper = helper;
        console.log(`Assigned final ${helper.type} helper to ${nearestVictim.type} victim with no specific match`);
        
        // Remove this victim from the list
        const index = finalUnassignedVictims.indexOf(nearestVictim);
        if (index > -1) {
          finalUnassignedVictims.splice(index, 1);
        }
      }
    }
  }
}

// Function to initialize the canvas
function setupCanvas() {
  var w = window.innerWidth - 40;
  var h = window.innerHeight - 100;

  var svg = document.getElementById("surface");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);

  surface = d3.select("#surface");

  agents = generateRandomAgents(10);  // Generate 10 agents based on the ratio

  // Add a container for counters outside the field
  const counterContainer = document.createElement('div');
  counterContainer.id = 'counter-container';
  document.body.appendChild(counterContainer);

  counterContainer.innerHTML = `
    <p id="youth-count">Youth Saved: 0</p>
    <p id="adult-count">Adults Saved: 0</p>
    <p id="elderly-count">Elderly Saved: 0</p>
    <p id="disabled-count">Disabled Saved: 0</p>
    <p id="packing-count">Packing Helpers Saved: 0</p>
    <p id="first-aider-count">First Aiders Saved: 0</p>
    <p id="timer-count">Time Remaining: ${timer}s</p>
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
  
  // Initial render
  renderGoal();
  renderAgents();
}

// Function to start the simulation
function startSim() {
  clearInterval(simTimer);

  // Adjust the simulation speed by changing the interval based on slider value
  let speedMap = [0.25, 0.5, 1, 2, 4];  // Corresponding time multipliers for 0.25x, 0.5x, 1x, 2x, and 4x speeds
  let selectedSpeed = speedMap[parseInt(document.getElementById("slider1").value)];

  // Adjust the animation delay based on the selected speed
  animationDelay = 100 / selectedSpeed;  // Faster updates for smoother animation

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
      
      // Compile results
      const results = {
        youth: savedCount.youth,
        adult: savedCount.adult,
        elderly: savedCount.elderly,
        disabled: savedCount.disabled,
        packing: savedCount.packing,
        first_aider: savedCount.first_aider
      };
      
      alert(`Simulation ended!\nYouth: ${results.youth}\nAdults: ${results.adult}\nElderly: ${results.elderly}\nDisabled: ${results.disabled}\nPacking Helpers: ${results.packing}\nFirst Aiders: ${results.first_aider}`);
    }
  }, 1000);
}

// Initialize the canvas when the window is loaded
window.onload = setupCanvas;  