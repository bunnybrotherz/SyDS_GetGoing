var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/youth.png",
  adult: "images/adult.png",
  elderly: "images/elderly.png",
  disabled: "images/disabled.png",
  packing: "images/packing.png",
  first_aider: "images/first-aider.png"
};

var simTimer;
var countdownTimer;
var helperSpawnTimer; // New timer for spawning helpers
var isRunning = false;
var timer = 30;
var savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
var perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0 }; // Track perished people

// Add a global speed variable
var speedMultiplier = 1.0;

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var agents = [];

// Helper spawn rate (in seconds)
var helperSpawnRate = 5;

// Ratio of victims to helpers (1:1 by default)
var victimToHelperRatio = 2;

// Speed multipliers for different victim types - Made speed difference more pronounced
var victimSpeeds = {
  youth: 1.2,    // Faster than adults
  adult: 1.0,    // Normal speed
  elderly: 0.4,  // Much slower than before
  disabled: 0.3, // Even slower
  packing: 1.2,  // Helpers are fast
  first_aider: 1.2
};

// UPDATED: Changed urgency levels to prioritize elderly and disabled
var urgencyLevels = {
  youth: 2,    // Medium urgency (was 1)
  adult: 2,    // Medium urgency (was 1)
  elderly: 1,  // High urgency (was 2)
  disabled: 1  // High urgency (was 2)
};

// Add this to the top section where variables are defined
var totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };
//var efficiencyScore = 0;

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.2;

// Function to calculate distance between two agents
function calculateDistance(agent1, agent2) {
  return Math.sqrt(
    Math.pow(agent1.row - agent2.row, 2) + 
    Math.pow(agent1.col - agent2.col, 2)
  );
}

// Function to get pixel coordinates based on cell size
function getPixelCoord(location) {
  return { x: (location.col - 1) * cellSize, y: (location.row - 1) * cellSize };
}

// Function to render the goal point - UPDATED: removed green circle
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

// Also modify the updateAgents function to handle "counted" property correctly
function updateAgents() {
  const now = Date.now();

  agents.forEach((agent) => {
    if (agent.reachedGoal) return;
    
    if (agent.isHelper && agent.assignedVictim) {
      // Skip if victim already reached goal
      if (agent.assignedVictim.reachedGoal) {
        agent.reachedGoal = true;
        return;
      }
      
      const reachedVictim = Math.abs(agent.row - agent.assignedVictim.row) <= epsilon * 2 &&
                            Math.abs(agent.col - agent.assignedVictim.col) <= epsilon * 2;

      if (!reachedVictim) {
        moveTowards(agent, agent.assignedVictim);
      } else {
        if (!agent.waitingSince) {
          agent.waitingSince = now;
          console.log(`Helper ${agent.type} reached victim ${agent.assignedVictim.type} and started waiting`);
        }

        let waitDuration = 0;
        if (agent.type === 'packing') {
          waitDuration = 2000; // Reduced from 20000 for testing/demo purposes
        } else if (agent.type === 'first_aider') {
          waitDuration = 1000; // Reduced from 10000 for testing/demo purposes
        }

        if (now - agent.waitingSince >= waitDuration) {
          moveToGoal(agent, agent.assignedVictim);
        }
      }
    }
  });
}

function moveTowards(agent, target) {
  let speed = victimSpeeds[agent.type] || 1.0;
  
  // Apply global speed multiplier
  speed *= speedMultiplier;
  
  // Check if we're already very close to the target
  if (Math.abs(target.col - agent.col) <= epsilon * 2 && 
      Math.abs(target.row - agent.row) <= epsilon * 2) {
    // If very close, just snap directly to target position
    agent.col = target.col;
    agent.row = target.row;
    return;
  }
  
  // Otherwise, move toward the target
  if (Math.abs(target.col - agent.col) <= epsilon) {
    agent.col = target.col; // Snap to exact position
  } else {
    let moveX = Math.sign(target.col - agent.col) * speed * 0.1; // Reduce speed when approaching
    agent.col += moveX;
  }

  if (Math.abs(target.row - agent.row) <= epsilon) {
    agent.row = target.row; // Snap to exact position
  } else {
    let moveY = Math.sign(target.row - agent.row) * speed * 0.1; // Reduce speed when approaching
    agent.row += moveY;
  }
}

// In the moveToGoal function, make the agent stop completely once they're close enough
function moveToGoal(helper, victim) {
  // Check if already very close to goal - if so, snap to exact position and mark as reached
  if (Math.abs(goal.col - victim.col) <= epsilon && Math.abs(goal.row - victim.row) <= epsilon) {
    // Snap exactly to goal position
    victim.col = goal.col;
    victim.row = goal.row;
    helper.col = goal.col;
    helper.row = goal.row;
    
    // Mark both as having reached goal
    victim.reachedGoal = true;
    helper.reachedGoal = true;
    
    // Update saved count if not already counted
    if (!victim.counted) {
      savedCount[victim.type]++;
      savedCount[helper.type]++;
      victim.counted = true;
      helper.counted = true;
      console.log(`Helper ${helper.type} and victim ${victim.type} reached goal and were counted`);
    }
    
    return;
  }
  
  let speed = victimSpeeds[victim.type];
  
  // Apply global speed multiplier
  speed *= speedMultiplier;
  
  if (Math.abs(goal.col - victim.col) > epsilon) {
    let moveX = Math.sign(goal.col - victim.col) * speed * 0.1;
    victim.col += moveX;
    helper.col = victim.col;
  }

  if (Math.abs(goal.row - victim.row) > epsilon) {
    let moveY = Math.sign(goal.row - victim.row) * speed * 0.1;
    victim.row += moveY;
    helper.row = victim.row;
  }
}

function getRandomAgentType() {
  const rand = Math.random();
  if (rand < (1 / (1 + victimToHelperRatio))) {
    return getRandomHelperType();
  } else {
    return getRandomVictimType();
  }
}

function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.9) return 'elderly';
  return 'disabled';
}

function getRandomHelperType() {
  const rand = Math.random();
  if (rand < 0.5) return 'packing';
  return 'first_aider';
}

// Modified function to spawn a random number of helpers with more randomness
function spawnNewHelpers() {
  if (!isRunning) return;
  
  // More random: Generate helpers based on a probability distribution
  // 60% chance: 1 helper, 30% chance: 2 helpers, 10% chance: 3-4 helpers
  const rand = Math.random();
  let helpersToSpawn = 1; // Default
  
  if (rand > 0.6 && rand <= 0.9) {
    helpersToSpawn = 2;
  } else if (rand > 0.9) {
    helpersToSpawn = Math.floor(Math.random() * 2) + 3; // 3-4 helpers
  }
  
  console.log(`Spawning ${helpersToSpawn} new helpers`);
  
  // Also make timing more random by adjusting the next spawn interval
  const variableFactor = 0.5 + Math.random(); // Between 0.5 and 1.5
  const nextSpawnInterval = helperSpawnRate * 1000 / speedMultiplier * variableFactor;
  
  // Store the newly spawned helpers
  const newHelpers = [];
  
  // Get all unassigned victims once to optimize
  const unassignedVictims = agents.filter(a => 
    a.isVictim && !a.reachedGoal && !a.assignedHelper
  );
  
  // Create the requested number of helpers
  for (let i = 0; i < helpersToSpawn; i++) {
    const simulationSvg = document.getElementById("surface");
    const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
    const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
    
    // Randomize helper type following the same distribution logic
    const helper = {
      row: Math.floor(Math.random() * maxRows) + 1,
      col: Math.floor(Math.random() * maxCols) + 1,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    
    // Make sure helpers don't spawn on the goal
    if (helper.row === goal.row && helper.col === goal.col) {
      helper.row = helper.row > 1 ? helper.row - 1 : helper.row + 1;
    }
    
    newHelpers.push(helper);
  }
  
  // If we have unassigned victims, assign them to our new helpers using 
  // the same priority and distance logic from the original helper assignment
  if (unassignedVictims.length > 0) {
    // For each helper, find the best victim using urgency level and distance
    newHelpers.forEach(helper => {
      // Skip if no unassigned victims left
      if (unassignedVictims.length === 0) return;
      
      // Calculate distances and urgency for all remaining unassigned victims
      const potentialVictims = unassignedVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim),
          urgencyLevel: victim.urgencyLevel
        };
      });
      
      // Sort by urgency level (lower number = higher priority)
      // If same urgency, prioritize by distance (same as original logic)
      potentialVictims.sort((a, b) => {
        if (a.urgencyLevel !== b.urgencyLevel) {
          return a.urgencyLevel - b.urgencyLevel;
        }
        return a.distance - b.distance;
      });
      
      // Assign this helper to the highest priority victim
      const targetVictim = potentialVictims[0].victim;
      helper.assignedVictim = targetVictim;
      targetVictim.assignedHelper = helper;
      
      // Remove the assigned victim from the unassigned list
      const index = unassignedVictims.indexOf(targetVictim);
      if (index > -1) {
        unassignedVictims.splice(index, 1);
      }
      
      // Add helper to the agents array
      agents.push(helper);
      
      console.log(`New ${helper.type} helper spawned and assigned to ${targetVictim.type} victim (urgency: ${targetVictim.urgencyLevel}, distance: ${potentialVictims[0].distance.toFixed(2)})`);
    });
    
    // Re-render agents to show all the new helpers at once
    renderAgents();
  } else {
    console.log("No unassigned victims available for new helpers");
  }
  
  // Reset the timer with variable timing
  if (isRunning) {
    clearInterval(helperSpawnTimer);
    helperSpawnTimer = setTimeout(() => {
      spawnNewHelpers();
    }, nextSpawnInterval);
  }
}

// Modified function to start the helper spawn timer with initial random delay
function startHelperSpawnTimer() {
  // Initial random delay between 1-3 seconds (adjusted for speed)
  const initialDelay = (1000 + Math.random() * 2000) / speedMultiplier;
  
  helperSpawnTimer = setTimeout(() => {
    spawnNewHelpers(); // Initial call to the spawn function
  }, initialDelay);
}

// Start simulation function remains mostly the same
function startSim() {
  if (isRunning) {
    // Update based on speed - faster speed means more frequent updates
    const baseInterval = 100;
    const interval = baseInterval / speedMultiplier;
    simTimer = setInterval(simStep, interval);
    
    // Start spawning helpers with randomized timing
    startHelperSpawnTimer();
  }
}

// Also update the stop/cleanup function to handle setTimeout properly
function cleanupTimers() {
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  clearTimeout(helperSpawnTimer); // Changed from clearInterval to clearTimeout
  isRunning = false;
}

// Update the test button event listener to use 30 agents instead of 20
document.getElementById("start-button").addEventListener("click", () => {
  cleanupTimers();
  timer = 30;
  savedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 }; // Reset perished count
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 }; // Reset total count
  
  agents = generateRandomAgents(30);  // Changed from 20 to 30
  logAssignmentDetails();
  renderGoal();
  renderAgents();
  updateCounters();
});


function simStep() {
  if (!isRunning) return;
  updateAgents();
  renderAgents();
  renderGoal();
  updateCounters();
}

// Update the generateRandomAgents function to handle combined urgency
function generateRandomAgents(count) {
  // Use the simulation area dimensions instead of window dimensions
  const simulationArea = document.querySelector(".simulation-area");
  const simulationSvg = document.getElementById("surface");
  const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
  const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
  
  const agents = [];

  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;
  
  console.log(`Generating ${helpersCount} helpers and ${victimsCount} victims`);

  const helpers = [];
  for (let i = 0; i < helpersCount; i++) {
    let row = Math.floor(Math.random() * maxRows) + 1;
    let col = Math.floor(Math.random() * maxCols) + 1;
    
    // Make sure helpers don't spawn on the goal
    if (row === goal.row && col === goal.col) {
      row = row > 1 ? row - 1 : row + 1;
    }
    
    const helper = {
      row: row,
      col: col,
      type: getRandomHelperType(),
      isHelper: true,
      reachedGoal: false
    };
    helpers.push(helper);
    agents.push(helper);
  }
  // Reset total counts
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, disabled: 0 };

  const victims = [];
  for (let i = 0; i < victimsCount; i++) {
    const victimType = getRandomVictimType();
    totalAgentsByType[victimType]++;
    
    // Make sure victims don't spawn on the goal
    let row, col;
    do {
      row = Math.floor(Math.random() * maxRows) + 1;
      col = Math.floor(Math.random() * maxCols) + 1;
    } while (row === goal.row && col === goal.col);
    
    const victim = {
      row: row,
      col: col,
      type: victimType,
      urgencyLevel: urgencyLevels[victimType],
      isVictim: true,
      reachedGoal: false
    };
    victims.push(victim);
    agents.push(victim);
  }

  // Group victims by type
  const victimsByType = {
    youth: victims.filter(v => v.type === 'youth'),
    adult: victims.filter(v => v.type === 'adult'),
    disabled: victims.filter(v => v.type === 'disabled'),
    elderly: victims.filter(v => v.type === 'elderly')
  };
  
  console.log("=== VICTIM DISTRIBUTION ===");
  console.log(`Youth victims: ${victimsByType.youth.length}`);
  console.log(`Adult victims: ${victimsByType.adult.length}`);
  console.log(`Disabled victims: ${victimsByType.disabled.length}`);
  console.log(`Elderly victims: ${victimsByType.elderly.length}`);
  
  // Create a copy of helpers array to track available helpers
  const availableHelpers = [...helpers];
  
  // Create a combined array of high priority victims (elderly and disabled now)
  const highPriorityVictims = [...victimsByType.elderly, ...victimsByType.disabled];

  
  // For each helper, find the nearest high priority victim (youth or adult)
  availableHelpers.forEach(helper => {
    // Skip if no high priority victims available
    if (highPriorityVictims.length === 0) return;
    
    // Calculate distances from this helper to all high priority victims
    const victimDistances = highPriorityVictims.map(victim => {
      return {
        victim: victim,
        distance: calculateDistance(helper, victim)
      };
    });
    
    // Sort by distance (closest first)
    victimDistances.sort((a, b) => a.distance - b.distance);
    
    // Assign this helper to the closest high priority victim
    const closestVictim = victimDistances[0].victim;
    helper.assignedVictim = closestVictim;
    closestVictim.assignedHelper = helper;
    
    // Remove the assigned victim from the pool
    const index = highPriorityVictims.indexOf(closestVictim);
    if (index > -1) {
      highPriorityVictims.splice(index, 1);
    }
    
    console.log(`Assigned ${helper.type} helper to high-priority ${closestVictim.type} victim (distance: ${victimDistances[0].distance.toFixed(2)})`);
  });
  
  // If we still have helpers available after assigning to high priority victims
  // Get remaining unassigned helpers
  const remainingHelpers = availableHelpers.filter(helper => !helper.assignedVictim);
  
  if (remainingHelpers.length > 0 && highPriorityVictims.length === 0) {
    console.log("All high priority victims assigned, moving to medium priority victims (elderly & disabled)");
    
    // Create array of medium priority victims (youth and adults now)
    const mediumPriorityVictims = [...victimsByType.youth, ...victimsByType.adult];
    
    // For each remaining helper, find the nearest medium priority victim
    remainingHelpers.forEach(helper => {
      // Skip if no medium priority victims available or helper already assigned
      if (mediumPriorityVictims.length === 0 || helper.assignedVictim) return;
      
      // Calculate distances from this helper to all medium priority victims
      const victimDistances = mediumPriorityVictims.map(victim => {
        return {
          victim: victim,
          distance: calculateDistance(helper, victim)
        };
      });
      
      // Sort by distance (closest first)
      victimDistances.sort((a, b) => a.distance - b.distance);
      
      // Assign this helper to the closest medium priority victim
      const closestVictim = victimDistances[0].victim;
      helper.assignedVictim = closestVictim;
      closestVictim.assignedHelper = helper;
      
      // Remove the assigned victim from the pool
      const index = mediumPriorityVictims.indexOf(closestVictim);
      if (index > -1) {
        mediumPriorityVictims.splice(index, 1);
      }
      
      console.log(`Assigned ${helper.type} helper to medium-priority ${closestVictim.type} victim (distance: ${victimDistances[0].distance.toFixed(2)})`);
    });
  }

  return agents;
}

// Update the calculatePerished function to count helpers too
function calculatePerished() {
  // Reset perished count
  perishedCount = { youth: 0, adult: 0, elderly: 0, disabled: 0, packing: 0, first_aider: 0 };
  
  // Find all victims who didn't reach the goal
  agents.filter(a => a.isVictim && !a.reachedGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });

  // Also count helpers who didn't reach the goal
  agents.filter(a => a.isHelper && !a.reachedGoal).forEach(helper => {
    perishedCount[helper.type]++;
  });
  
  return perishedCount;
}

// Update calculateEfficiency to use combined urgency levels
//function calculateEfficiency() {
  // Calculate weighted score based on priorities
  //const weights = {
    //youth: 3,    // High priority
    //adult: 3,    // High priority
    //: 2, // Medium priority
    //elderly: 2   // Medium priority (now same as disabled)
  //};
  
  //let totalScore = 0;
  //let maxPossibleScore = 0;
  
  // Calculate actual score
  //Object.keys(savedCount).forEach(type => {
    //if (weights[type]) { // Only calculate for victim types
      //totalScore += savedCount[type] * weights[type];
   // }
 // });
  
  // Calculate maximum possible score (if all victims were saved)
 // Object.keys(totalAgentsByType).forEach(type => {
    //maxPossibleScore += totalAgentsByType[type] * weights[type];
 // });
  
  // Return efficiency as percentage
  //return maxPossibleScore > 0 ? (totalScore / maxPossibleScore * 100).toFixed(1) : 0;
//}

// Modify renderAgents function to use combined urgency level colors
function renderAgents() {
  surface.selectAll("image.agent").remove();
  surface.selectAll("circle.urgency").remove();
  surface.selectAll("line.assignment").remove();
  
  // Draw lines between helpers and their assigned victims (only for those still moving)
  surface.selectAll("line.assignment")
    .data(agents.filter(agent => agent.isHelper && !agent.reachedGoal && agent.assignedVictim && !agent.assignedVictim.reachedGoal))
    .enter()
    .append("line")
    .attr("class", "assignment")
    .attr("x1", d => (d.col - 0.5) * cellSize)
    .attr("y1", d => (d.row - 0.5) * cellSize)
    .attr("x2", d => (d.assignedVictim.col - 0.5) * cellSize)
    .attr("y2", d => (d.assignedVictim.row - 0.5) * cellSize)
    // Also update the line color logic:
    .attr("stroke", d => {
      // Color line based on victim's urgency level - only two levels now
      if (d.assignedVictim.urgencyLevel === 1) return "rgba(255, 99, 132, 0.7)";  // Now elderly and disabled
      else return "rgba(80, 255, 64, 0.72)"; // Now youth and adults
    })
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "5,3"); // Dashed line for better visibility
  
  // Only draw urgency circles for victims not yet reached goal
  surface.selectAll("circle.urgency")
    .data(agents.filter(agent => agent.isVictim && !agent.reachedGoal))
    .enter()
    .append("circle")
    .attr("class", "urgency")
    .attr("cx", d => (d.col - 0.5) * cellSize)
    .attr("cy", d => (d.row - 0.5) * cellSize)
    .attr("r", cellSize / 2)
    // In renderAgents function, update the color mapping:
    .attr("fill", d => {
      if (d.urgencyLevel === 1) return "rgba(255, 99, 132, 0.3)";  // Now elderly and disabled
      else return "rgba(255, 159, 64, 0.3)"; // Now youth and adults
    });



  // Rest of function remains unchanged
  // Render helpers first so they appear behind victims
  surface.selectAll("image.helper")
    .data(agents.filter(agent => agent.isHelper && !agent.reachedGoal))
    .enter()
    .append("image")
    .attr("class", "agent helper")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => (d.col - 1) * cellSize)
    .attr("y", d => (d.row - 1) * cellSize);
    
  // Then render victims on top
  surface.selectAll("image.victim")
    .data(agents.filter(agent => agent.isVictim && !agent.reachedGoal))
    .enter()
    .append("image")
    .attr("class", "agent victim")
    .attr("xlink:href", d => victimImages[d.type])
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => (d.col - 1) * cellSize)
    .attr("y", d => (d.row - 1) * cellSize);
}

// Update logAssignmentDetails to reflect new urgency grouping
function logAssignmentDetails() {
  const victimsByUrgency = {
    1: [],
    2: []
  };
  
  agents.filter(a => a.isVictim).forEach(victim => {
    victimsByUrgency[victim.urgencyLevel].push(victim);
  });
  
  console.log("=== URGENCY DISTRIBUTION ===");
  console.log(`High urgency victims: ${victimsByUrgency[1].length} (Elderly & Disabled)`);
  console.log(`Medium urgency victims: ${victimsByUrgency[2].length} (Youth & Adults)`);
  
  console.log("=== ASSIGNMENT ORDER ===");
  const helpers = agents.filter(a => a.isHelper);
  helpers.forEach((helper, index) => {
    if (helper.assignedVictim) {
      const distance = calculateDistance(helper, helper.assignedVictim).toFixed(2);
      console.log(`Helper ${index+1} (${helper.type}) → Victim type: ${helper.assignedVictim.type}, Urgency: ${helper.assignedVictim.urgencyLevel}, Distance: ${distance}`);
    } else {
      console.log(`Helper ${index+1} (${helper.type}) → No victim assigned`);
    }
  });
  
  // Also update the warning to check for high priority (elderly/disabled) victims without helpers
  const highUrgencyWithoutHelpers = victimsByUrgency[1].filter(v => !v.assignedHelper);
  if (highUrgencyWithoutHelpers.length > 0) {
    console.warn(`WARNING: ${highUrgencyWithoutHelpers.length} high urgency victims (elderly/disabled) don't have helpers!`);
  }
}


// Update the counters to use our new UI with combined elderly/disabled
function updateCounters() {
  const totalVictims = agents.filter(a => a.isVictim).length;
  const savedByUrgency = {
    1: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 1).length,
    2: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 2).length
  };
  
  const totalByUrgency = {
    1: agents.filter(a => a.isVictim && a.urgencyLevel === 1).length,
    2: agents.filter(a => a.isVictim && a.urgencyLevel === 2).length
  };
  
  // Update stat boxes with saved counts - match the HTML structure
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('disabled-count').textContent = `PWD Saved: ${savedCount.disabled}`;
  document.getElementById('packing-count').textContent = `Packing Helpers: ${savedCount.packing}`;
  document.getElementById('first-aider-count').textContent = `First Aiders: ${savedCount.first_aider}`;
  document.getElementById('timer-count').textContent = `Time: ${timer}s`;
  
  document.getElementById('urgency-stats').innerHTML = `
  <div class="urgency-progress">
    <div>High Priority (Elderly & PWD): ${savedByUrgency[1]}/${totalByUrgency[1]} (${totalByUrgency[1] > 0 ? Math.round(savedByUrgency[1]/totalByUrgency[1]*100) : 0}%)</div>
    <div class="progress-bar">
      <div class="progress-fill high-fill" style="width: ${totalByUrgency[1] > 0 ? Math.round(savedByUrgency[1]/totalByUrgency[1]*100) : 0}%"></div>
    </div>
  </div>
  <div class="urgency-progress">
    <div>Low Priority (Youth & Adults): ${savedByUrgency[2]}/${totalByUrgency[2]} (${totalByUrgency[2] > 0 ? Math.round(savedByUrgency[2]/totalByUrgency[2]*100) : 0}%)</div>
    <div class="progress-bar">
      <div class="progress-fill medium-fill" style="width: ${totalByUrgency[2] > 0 ? Math.round(savedByUrgency[2]/totalByUrgency[2]*100) : 0}%"></div>
    </div>
  </div>
`;
}


// Add a function to handle slider changes
function updateSpeed() {
  const speedMap = [0.25, 0.5, 1, 2, 4];
  speedMultiplier = speedMap[parseInt(document.getElementById("slider1").value)];
  
  // If simulation is already running, restart it with new speed
  if (isRunning) {
    clearInterval(simTimer);
    clearInterval(helperSpawnTimer);
    startSim();
  }
}

// Update the setupCanvas function to initialize with 30 agents instead of 10
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
    const simulationArea = document.querySelector(".simulation-area");
    
    surface = d3.select("#surface");

    agents = generateRandomAgents(30);  // Changed from 10 to 30
    
    logAssignmentDetails();
    
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
    renderAgents();
    updateCounters();
  } catch (error) {
    console.error('Error in setupCanvas:', error);
    const simulationArea = document.querySelector(".simulation-area");
    simulationArea.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
  }
}
// Update the showResults function to reflect combined urgency levels
function showResults() {
  cleanupTimers();
  
  // Calculate perished people and efficiency
  const perished = calculatePerished();
  //efficiencyScore = calculateEfficiency();
  
  const rescuedByPriority = {
    high: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 1).length,
    medium: agents.filter(a => a.isVictim && a.reachedGoal && a.urgencyLevel === 2).length
  };
  
  const totalByPriority = {
    high: agents.filter(a => a.isVictim && a.urgencyLevel === 1).length,
    medium: agents.filter(a => a.isVictim && a.urgencyLevel === 2).length
  };
  
  const results = {
    youth: savedCount.youth,
    adult: savedCount.adult,
    elderly: savedCount.elderly,
    disabled: savedCount.disabled,
    packing: savedCount.packing,
    first_aider: savedCount.first_aider
  };
  
  // Create modal as in original code
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
    
    <h3 style="color:#2c3e50;">Victims Helped by Type</h3>
    <div class="stat-box high-urgency">Youth: ${results.youth} (${totalAgentsByType.youth - results.youth} perished)</div>
    <div class="stat-box high-urgency">Adults: ${results.adult} (${totalAgentsByType.adult - results.adult} perished)</div>
    <div class="stat-box medium-urgency">Elderly: ${results.elderly} (${totalAgentsByType.elderly - results.elderly} perished)</div>
    <div class="stat-box medium-urgency">PWD: ${results.disabled} (${totalAgentsByType.disabled - results.disabled} perished)</div>
    <div>Total: ${perished.youth + perished.adult + perished.elderly + perished.disabled}</div>

    <h3 style="color:#2c3e50; margin-top:20px;">Victims Rescued by Priority</h3>
    <div class="urgency-progress">
      <div>High Priority (Elderly & PWD): ${rescuedByPriority.high}/${totalByPriority.high} (${totalByPriority.high > 0 ? Math.round(rescuedByPriority.high/totalByPriority.high*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill high-fill" style="width: ${totalByPriority.high > 0 ? Math.round(rescuedByPriority.high/totalByPriority.high*100) : 0}%"></div>
      </div>
    </div>
    <div class="urgency-progress">
      <div>Low Priority (Youth & Adults): ${rescuedByPriority.medium}/${totalByPriority.medium} (${totalByPriority.medium > 0 ? Math.round(rescuedByPriority.medium/totalByPriority.medium*100) : 0}%)</div>
      <div class="progress-bar">
        <div class="progress-fill medium-fill" style="width: ${totalByPriority.medium > 0 ? Math.round(rescuedByPriority.medium/totalByPriority.medium*100) : 0}%"></div>
      </div>
    </div>
    
    <div>Total: ${perished.youth + perished.adult + perished.elderly + perished.disabled}</div>
    
    <button id="close-modal" class="btn btn-primary" style="margin-top:20px;">Close</button>
  `;
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  document.getElementById('close-modal').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
}

// Update the startTimer function to use showResults instead of alert
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
      
      // Show results with our new UI
      showResults();
    }
  }, 1000);
}

// Initialize the simulation when the page loads
window.onload = setupCanvas;