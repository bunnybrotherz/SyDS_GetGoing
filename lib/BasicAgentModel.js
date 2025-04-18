var surface;
var cellSize = 40;
var victimImages = {
  youth: "images/youth.png",
  adult: "images/adult.png",
  elderly: "images/elderly.png",
  PWD: "images/disabled.png",
  helper: "images/first-aider.png" // Single helper type
};

var simTimer;
var countdownTimer;
var isRunning = false;
var timer = 30;
var savedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };
var perishedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };

// Add bias configuration for different priority groups
var priorityBias = {
  highPriority1: 0.85,  // 75% bias for priority 1 (youth + adult)
  highPriority2: 0.99   // 75% bias for priority 2 (elderly + disabled)
};

// Global speed variable
var speedMultiplier = 1.0;

// Meeting point (goal)
var goal = { row: 5, col: 5 };
var agents = [];

// Helper spawn rate (in seconds)
var helperSpawnRate = 5;

// Ratio of victims to helpers
var victimToHelperRatio = 2.5;

// Speed multipliers for different victim types - Updated speeds
var victimSpeeds = {
  youth: 0.3,
  adult: 0.28,
  elderly: 0.22,
  PWD: 0.21,
  helper: 0.28
};

// CONFIGURABLE: Urgency levels (lower number = higher priority)
// Change these values to adjust priorities without modifying other code
var urgencyLevels = {
  youth: 1,    
  adult: 1,    
  elderly: 2,  
  PWD: 2  
};

// Tracking counts by type
var totalAgentsByType = { youth: 0, adult: 0, elderly: 0, PWD: 0 };

// Store the need type for victims (first_aid or packing)
var victimNeedType = {};

// Tolerance for reaching the goal (to prevent bouncing)
const epsilon = 0.2;

// Function to get all victim types with a given urgency level
function getVictimTypesByUrgencyLevel(level) {
  return Object.keys(urgencyLevels).filter(type => urgencyLevels[type] === level);
}

// Function to get a user-friendly label for a given urgency level
function getUrgencyLevelLabel(level) {
  const types = getVictimTypesByUrgencyLevel(level);
  const formattedTypes = types.map(type => 
    type.charAt(0).toUpperCase() + type.slice(1)
  ).join(' & ');
  
  return `Priority ${level} (${formattedTypes})`;
}

// Function to display priority groups at the top
function displayPriorityGroups() {
  // Get all unique priority levels
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  
  if (uniqueLevels.length === 2) {
    const highPriorityTypes = getVictimTypesByUrgencyLevel(uniqueLevels[0]);
    const lowPriorityTypes = getVictimTypesByUrgencyLevel(uniqueLevels[1]);
    
    // Format the types for display
    const formatTypes = types => types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ');
    
    const headerElement = document.getElementById('priority-header');
    if (headerElement) {
      headerElement.textContent = `Prioritising ${formatTypes(highPriorityTypes)} over ${formatTypes(lowPriorityTypes)}`;
    }
  }
}

// Function to get color for a specific urgency level
function getUrgencyColor(level) {
  // Define colors for different urgency levels
  const colors = [
    { fill: "rgba(255, 99, 132, 0.3)", stroke: "rgba(255, 99, 132, 0.7)" },  // Level 1 (highest) - Red
    { fill: "rgba(123, 255, 0, 0.3)", stroke: "rgba(123, 255, 0, 0.7)" },  // Level 2 - Green    
  ];
  
  // Adjust level to zero-based index and handle levels beyond our color array
  const index = Math.min(level - 1, colors.length - 1);
  return colors[index];
}

// Get CSS classes for different urgency levels
function getUrgencyClass(level) {
  const levelToClass = {
    1: "high-urgency",
    2: "medium-urgency",
    3: "low-urgency",
    4: "very-low-urgency"
  };
  
  return levelToClass[level] || "medium-urgency";
}

// Get fill class for progress bars
function getUrgencyFillClass(level) {
  const levelToClass = {
    1: "high-fill",
    2: "medium-fill",
    3: "low-fill",
    4: "very-low-fill"
  };
  
  return levelToClass[level] || "medium-fill";
}

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

// Function to display priority groups at the top
function displayPriorityGroups() {
  // Get all unique priority levels
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  
  if (uniqueLevels.length === 2) {
    const highPriorityTypes = getVictimTypesByUrgencyLevel(uniqueLevels[0]);
    const lowPriorityTypes = getVictimTypesByUrgencyLevel(uniqueLevels[1]);
    
    // Format the types for display
    const formatTypes = types => types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ');
    
    // Update the header element
    const headerElement = document.getElementById('priority-header');
    if (headerElement) {
      headerElement.textContent = `Prioritising ${formatTypes(highPriorityTypes)} over ${formatTypes(lowPriorityTypes)}`;
    }
  }
}

function updateAgents() {
  const now = Date.now();

  agents.forEach((agent) => {
    if (agent.reachedGoal) {
      // NEW: Check if helper can be redeployed
      if (agent.isHelper && !agent.stayingAtGoal) {
        // Check if less than 5 seconds remain
        if (timer <= 5) {
          agent.stayingAtGoal = true; // Helper stays at goal
          console.log(`Helper staying at goal - less than 5s remaining`);
        } else {
          // Find unassigned victims
          const unassignedVictims = agents.filter(a => 
            a.isVictim && !a.reachedGoal && !a.assignedHelper
          );
          
          if (unassignedVictims.length > 0) {
            // Reset helper's status
            agent.reachedGoal = false;
            agent.waitingSince = null;
            agent.counted = false;
            
            // Group victims by urgency level
            const victimsByUrgency = {};
            const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
            uniqueLevels.forEach(level => {
              victimsByUrgency[level] = unassignedVictims.filter(v => v.urgencyLevel === level);
            });
            
            // Determine which bias to use based on urgency levels present
            const highestPriority = Math.min(...uniqueLevels);
            const lowestPriority = Math.max(...uniqueLevels);
            
            // Get bias value based on which priority groups are present
            let biasValue;
            if (getVictimTypesByUrgencyLevel(highestPriority).includes('youth') || 
                getVictimTypesByUrgencyLevel(highestPriority).includes('adult')) {
              biasValue = priorityBias.highPriority1;
            } else {
              biasValue = priorityBias.highPriority2;
            }
            
            // Apply the bias
            const roll = Math.random();
            let targetLevel;
            
            if (roll < biasValue) {
              // Assign to high priority group
              targetLevel = highestPriority;
            } else {
              // Assign to low priority group
              targetLevel = lowestPriority;
            }
            
            // Check if there are victims at the target level
            if (victimsByUrgency[targetLevel].length === 0) {
              // If no victims at target level, take from the other level
              targetLevel = (targetLevel === highestPriority) ? lowestPriority : highestPriority;
              
              // If still no victims, skip redeployment
              if (victimsByUrgency[targetLevel].length === 0) {
                return;
              }
            }
            
            // Find closest victim at the target level
            const victimDistances = victimsByUrgency[targetLevel].map(victim => {
              return {
                victim: victim,
                distance: calculateDistance(agent, victim)
              };
            });
            
            // Sort by distance (closest first)
            victimDistances.sort((a, b) => a.distance - b.distance);
            
            // Assign this helper to the closest victim
            const closestVictim = victimDistances[0].victim;
            agent.assignedVictim = closestVictim;
            closestVictim.assignedHelper = agent;
            
            const victimTypes = getVictimTypesByUrgencyLevel(targetLevel);
            console.log(`Helper redeployed to ${closestVictim.type} victim (urgency ${targetLevel}: ${victimTypes.join(', ')}) for ${victimNeedType[closestVictim.id]} (distance: ${victimDistances[0].distance.toFixed(2)})`);
          }
        }
      }
      return;
    }
    
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
          console.log(`Helper reached victim ${agent.assignedVictim.type} and started ${victimNeedType[agent.assignedVictim.id]} process`);
        }

        // Different wait times based on the assigned victim's need type
        let waitDuration = 0;
        if (victimNeedType[agent.assignedVictim.id] === 'packing') {
          waitDuration = 2000; // Packing time
        } else { // first_aid
          waitDuration = 1000; // First aid time
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
      savedCount["helper"]++;
      victim.counted = true;
      helper.counted = true;
      console.log(`Helper and victim ${victim.type} reached goal and were counted`);
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
    return 'helper';
  } else {
    return getRandomVictimType();
  }
}

function getRandomVictimType() {
  const rand = Math.random();
  if (rand < 0.25) return 'youth';
  if (rand < 0.75) return 'adult';
  if (rand < 0.9) return 'elderly';
  return 'PWD';
}

// Generate dynamic urgency legend
function generateUrgencyLegend() {
  // Get unique urgency levels
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  
  let legendHTML = '';
  uniqueLevels.forEach(level => {
    const color = getUrgencyColor(level);
    legendHTML += `
      <div class="legend-item">
        <div class="legend-color" style="background-color: ${color.stroke};"></div>
        <span>${getUrgencyLevelLabel(level)}</span>
      </div>
    `;
  });
  
  document.getElementById('urgency-legend').innerHTML = legendHTML;
}

// Modified function to assign helpers to victims with bias
function assignHelpersWithBias(helpers, victims) {
  console.log("=== ASSIGNING HELPERS WITH BIAS ===");
  
  // Create a copy of helpers array to track available helpers
  const availableHelpers = [...helpers];
  
  // Group victims by urgency level
  const victimsByUrgency = {};
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  uniqueLevels.forEach(level => {
    victimsByUrgency[level] = victims.filter(v => v.urgencyLevel === level);
  });
  
  // Log the distribution
  uniqueLevels.forEach(level => {
    console.log(`Urgency level ${level} victims: ${victimsByUrgency[level].length}`);
  });
  
  // For each helper, apply bias-based assignment
  availableHelpers.forEach((helper, index) => {
    // If no victims left, skip assignment
    if (victims.length === 0) return;
    
    // Determine which bias to use based on urgency levels present
    const highestPriority = Math.min(...uniqueLevels);
    const lowestPriority = Math.max(...uniqueLevels);
    
    // Get bias value based on which priority groups are present
    let biasValue;
    
    // If priority 1 (youth + adult) is the highest priority
    if (getVictimTypesByUrgencyLevel(highestPriority).includes('youth') || 
        getVictimTypesByUrgencyLevel(highestPriority).includes('adult')) {
      biasValue = priorityBias.highPriority1;
    } else {
      // Otherwise priority 2 (elderly + disabled) is the highest priority
      biasValue = priorityBias.highPriority2;
    }
    
    // Apply the bias (random roll to determine if helper goes to high priority)
    const roll = Math.random();
    let targetLevel;
    
    if (roll < biasValue) {
      // Assign to high priority group (75% chance)
      targetLevel = highestPriority;
      console.log(`Helper ${index} assigned to high priority group (probability: ${biasValue})`);
    } else {
      // Assign to low priority group (25% chance)
      targetLevel = lowestPriority;
      console.log(`Helper ${index} assigned to low priority group (probability: ${1-biasValue})`);
    }
    
    // Check if there are victims at the target level
    if (victimsByUrgency[targetLevel].length === 0) {
      // If no victims at target level, take from the other level
      targetLevel = (targetLevel === highestPriority) ? lowestPriority : highestPriority;
      console.log(`No victims at originally chosen level, switching to level ${targetLevel}`);
      
      // If still no victims, skip assignment
      if (victimsByUrgency[targetLevel].length === 0) {
        console.log(`No victims available for helper ${index}`);
        return;
      }
    }
    
    // Find closest victim at the target level
    const victimDistances = victimsByUrgency[targetLevel].map(victim => {
      return {
        victim: victim,
        distance: calculateDistance(helper, victim)
      };
    });
    
    // Sort by distance (closest first)
    victimDistances.sort((a, b) => a.distance - b.distance);
    
    // Assign this helper to the closest victim
    const closestVictim = victimDistances[0].victim;
    helper.assignedVictim = closestVictim;
    closestVictim.assignedHelper = helper;
    
    // Remove the assigned victim from both the main pool and urgency level pool
    const indexInUrgencyPool = victimsByUrgency[targetLevel].indexOf(closestVictim);
    if (indexInUrgencyPool > -1) {
      victimsByUrgency[targetLevel].splice(indexInUrgencyPool, 1);
    }
    
    const indexInMainPool = victims.indexOf(closestVictim);
    if (indexInMainPool > -1) {
      victims.splice(indexInMainPool, 1);
    }
    
    const victimTypes = getVictimTypesByUrgencyLevel(targetLevel);
    console.log(`Assigned helper ${index} to ${closestVictim.type} victim (urgency ${targetLevel}: ${victimTypes.join(', ')}) for ${victimNeedType[closestVictim.id]} (distance: ${victimDistances[0].distance.toFixed(2)})`);
  });
}


// Start simulation
function startSim() {
  if (isRunning) {
    // Update based on speed
    const baseInterval = 100;
    const interval = baseInterval / speedMultiplier;
    simTimer = setInterval(simStep, interval);
  
  }
}

// Cleanup timers
function cleanupTimers() {
  clearInterval(simTimer);
  clearInterval(countdownTimer);
  isRunning = false;
}

// Start button event listener
document.getElementById("start-button").addEventListener("click", () => {
  cleanupTimers();
  timer = 30;
  savedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };
  perishedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, PWD: 0 };
  
  agents = generateRandomAgents(30);
  logAssignmentDetails();
  generateUrgencyLegend(); // Generate the legend dynamically
  displayPriorityGroups(); // Display priority groups at the top
  renderGoal();
  renderAgents();
  updateCounters();
  
  isRunning = true;
  startSim();
  startTimer();
});

function simStep() {
  if (!isRunning) return;
  updateAgents();
  renderAgents();
  renderGoal();
  updateCounters();
}

// Generate random agents with bias-based assignment
function generateRandomAgents(count) {
  const simulationSvg = document.getElementById("surface");
  const maxCols = Math.floor((simulationSvg.getBoundingClientRect().width - 40) / cellSize);
  const maxRows = Math.floor((simulationSvg.getBoundingClientRect().height - 40) / cellSize);
  
  const agents = [];
  victimNeedType = {}; // Reset need types

  const helpersCount = Math.floor(count / (1 + victimToHelperRatio));
  const victimsCount = count - helpersCount;
  
  console.log(`Generating ${helpersCount} helpers and ${victimsCount} victims`);

  // Generate helpers
  const helpers = [];
  for (let i = 0; i < helpersCount; i++) {
    let row = Math.floor(Math.random() * maxRows) + 1;
    let col = Math.floor(Math.random() * maxCols) + 1;
    
    // Make sure helpers don't spawn on the goal
    if (row === goal.row && col === goal.col) {
      row = row > 1 ? row - 1 : row + 1;
    }
    
    const helper = {
      id: `helper_${i}`,
      row: row,
      col: col,
      type: 'helper',
      isHelper: true,
      reachedGoal: false
    };
    helpers.push(helper);
    agents.push(helper);
  }
  
  // Reset total counts
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, PWD: 0 };

  // Generate victims
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
      id: `victim_${i}`,
      row: row,
      col: col,
      type: victimType,
      urgencyLevel: urgencyLevels[victimType], // Set urgency based on configuration
      isVictim: true,
      reachedGoal: false
    };
    
    // Randomly assign need type (first_aid or packing)
    victimNeedType[victim.id] = Math.random() < 0.5 ? 'first_aid' : 'packing';
    
    victims.push(victim);
    agents.push(victim);
  }

  // Group victims by type for logging
  const victimsByType = {
    youth: victims.filter(v => v.type === 'youth'),
    adult: victims.filter(v => v.type === 'adult'),
    PWD: victims.filter(v => v.type === 'PWD'),
    elderly: victims.filter(v => v.type === 'elderly')
  };
  
  console.log("=== VICTIM DISTRIBUTION ===");
  Object.keys(victimsByType).forEach(type => {
    console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} victims: ${victimsByType[type].length}`);
  });
  
  // Use bias-based assignment instead of strict priority-based assignment
  assignHelpersWithBias(helpers, [...victims]);

  return agents;
}

// Calculate perished agents
function calculatePerished() {
  // Reset perished count
  perishedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };
  
  // Find all victims who didn't reach the goal
  agents.filter(a => a.isVictim && !a.reachedGoal).forEach(victim => {
    perishedCount[victim.type]++;
  });

  // Also count helpers who didn't reach the goal
  agents.filter(a => a.isHelper && !a.reachedGoal).forEach(helper => {
    perishedCount.helper++;
  });
  
  return perishedCount;
}

// Render agents with dynamic coloring based on urgency levels
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
    .attr("stroke", d => {
      // Color line based on victim's urgency level
      return getUrgencyColor(d.assignedVictim.urgencyLevel).stroke;
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
    .attr("fill", d => getUrgencyColor(d.urgencyLevel).fill);

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

// Log assignment details with dynamic urgency information
function logAssignmentDetails() {
  // Group victims by urgency level
  const victimsByUrgency = {};
  
  // Initialize empty arrays for each urgency level
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  uniqueLevels.forEach(level => {
    victimsByUrgency[level] = [];
  });
  
  // Group victims by their urgency level
  agents.filter(a => a.isVictim).forEach(victim => {
    victimsByUrgency[victim.urgencyLevel].push(victim);
  });
  
  console.log("=== URGENCY DISTRIBUTION ===");
  uniqueLevels.forEach(level => {
    const types = getVictimTypesByUrgencyLevel(level);
    console.log(`Urgency level ${level} victims: ${victimsByUrgency[level].length} (${types.join(', ')})`);
  });
  
  console.log("=== ASSIGNMENT ORDER ===");
  const helpers = agents.filter(a => a.isHelper);
  helpers.forEach((helper, index) => {
    if (helper.assignedVictim) {
      const distance = calculateDistance(helper, helper.assignedVictim).toFixed(2);
      console.log(`Helper ${index+1} → Victim type: ${helper.assignedVictim.type}, Need: ${victimNeedType[helper.assignedVictim.id]}, Urgency: ${helper.assignedVictim.urgencyLevel}, Distance: ${distance}`);
    } else {
      console.log(`Helper ${index+1} → No victim assigned`);
    }
  });
  
  // Check for high priority victims without helpers
  const highestPriorityLevel = Math.min(...uniqueLevels);
  const highPriorityWithoutHelpers = victimsByUrgency[highestPriorityLevel].filter(v => !v.assignedHelper);
  
  if (highPriorityWithoutHelpers.length > 0) {
    const types = getVictimTypesByUrgencyLevel(highestPriorityLevel);
    console.warn(`WARNING: ${highPriorityWithoutHelpers.length} highest urgency victims (${types.join(', ')}) don't have helpers!`);
  }
}

// Update counters with dynamic urgency progress bars
function updateCounters() {
  // Update individual agent counts
  document.getElementById('youth-count').textContent = `Youth Saved: ${savedCount.youth}`;
  document.getElementById('adult-count').textContent = `Adults Saved: ${savedCount.adult}`;
  document.getElementById('elderly-count').textContent = `Elderly Saved: ${savedCount.elderly}`;
  document.getElementById('PWD-count').textContent = `PWD Saved: ${savedCount.PWD}`;
  document.getElementById('helper-count').textContent = `Helpers: ${savedCount.helper}`;
  document.getElementById('timer-count').textContent = `Time: ${timer}s`;
  
  // Get unique urgency levels and sort them
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  
  // Calculate saved and total by urgency level
  const savedByUrgency = {};
  const totalByUrgency = {};
  
  uniqueLevels.forEach(level => {
    savedByUrgency[level] = agents.filter(a => 
      a.isVictim && a.reachedGoal && a.urgencyLevel === level
    ).length;
    
    totalByUrgency[level] = agents.filter(a => 
      a.isVictim && a.urgencyLevel === level
    ).length;
  });
  
  // Generate HTML for urgency stats
  let urgencyStatsHTML = '';
  
  uniqueLevels.forEach(level => {
    const percentage = totalByUrgency[level] > 0 ? 
      Math.round(savedByUrgency[level]/totalByUrgency[level]*100) : 0;
      
    urgencyStatsHTML += `
      <div class="urgency-progress">
        <div>${getUrgencyLevelLabel(level)}: ${savedByUrgency[level]}/${totalByUrgency[level]} (${percentage}%)</div>
        <div class="progress-bar">
          <div class="progress-fill ${getUrgencyFillClass(level)}" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });
  
  document.getElementById('urgency-stats').innerHTML = urgencyStatsHTML;
}

// Add a function to handle slider changes
function updateSpeed() {
  const speedMap = [0.25, 0.5, 1, 2, 4];
  speedMultiplier = speedMap[parseInt(document.getElementById("slider1").value)];
  
  // If simulation is already running, restart it with new speed
  if (isRunning) {
    clearInterval(simTimer);
    startSim();
  }
}

// Update the setupCanvas function
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

    // Generate initial agents
    agents = generateRandomAgents(30);
    
    logAssignmentDetails();
    
    // Generate dynamic urgency legend
    generateUrgencyLegend();
    
    // Display priority groups at the top
    displayPriorityGroups();
    
    // Directly attach event listeners to HTML elements
    document.getElementById("slider1").addEventListener("input", updateSpeed);
    
    // Initialize speed multiplier
    updateSpeed();

    document.getElementById("start-button").addEventListener("click", startButtonHandler);
    
    renderGoal();
    renderAgents();
    updateCounters();
  } catch (error) {
    console.error('Error in setupCanvas:', error);
    const simulationArea = document.querySelector(".simulation-area");
    simulationArea.innerHTML = `<div style="color:red; padding:20px;">Error: ${error.message}</div>`;
  }
}

var resultsShown = false;

// Dynamic results modal with configurable urgency levels
function showResults() {
  if (resultsShown) return;
  resultsShown = true;

  cleanupTimers();

  // Remove any existing modals first
  const existingModals = document.querySelectorAll('.modal-overlay');
  existingModals.forEach(modal => {
    document.body.removeChild(modal);
  });

  // Calculate perished people
  const perished = calculatePerished();
  
  // Get unique urgency levels and sort them
  const uniqueLevels = [...new Set(Object.values(urgencyLevels))].sort();
  
  // Calculate saved by urgency level
  const rescuedByPriority = {};
  const totalByPriority = {};
  
  uniqueLevels.forEach(level => {
    rescuedByPriority[level] = agents.filter(a => 
      a.isVictim && a.reachedGoal && a.urgencyLevel === level
    ).length;
    
    totalByPriority[level] = agents.filter(a => 
      a.isVictim && a.urgencyLevel === level
    ).length;
  });
  
  const results = {
    youth: savedCount.youth,
    adult: savedCount.adult,
    elderly: savedCount.elderly,
    PWD: savedCount.PWD,
    helper: savedCount.helper
  };
  
  // Create modal
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
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
  
  
  // Near the top of showResults() function, after calculating perished victims
const totalVictimsByType = { ...totalAgentsByType };
  
  // Build modal content
// Replace the current modalHTML content with this:
let modalHTML = `
    <h2 style="color:#2c3e50; margin-top:0;">Simulation Results</h2>
    
    <h3 style="color:#2c3e50;">Victims Saved by Type</h3>
    
    <div class="result-category">
      <div class="result-label">Youth: ${results.youth}/${totalVictimsByType.youth || 0}</div>
      <div class="result-bar-container">
        <div class="result-bar youth-bar" style="width: ${totalVictimsByType.youth > 0 ? Math.round((results.youth/totalVictimsByType.youth)*100) : 0}%"></div>
      </div>
      <div class="result-percentage">${totalVictimsByType.youth > 0 ? Math.round((results.youth/totalVictimsByType.youth)*100) : 0}%</div>
    </div>
    
    <div class="result-category">
      <div class="result-label">Adults: ${results.adult}/${totalVictimsByType.adult || 0}</div>
      <div class="result-bar-container">
        <div class="result-bar adult-bar" style="width: ${totalVictimsByType.adult > 0 ? Math.round((results.adult/totalVictimsByType.adult)*100) : 0}%"></div>
      </div>
      <div class="result-percentage">${totalVictimsByType.adult > 0 ? Math.round((results.adult/totalVictimsByType.adult)*100) : 0}%</div>
    </div>
    
    <div class="result-category">
      <div class="result-label">Elderly: ${results.elderly}/${totalVictimsByType.elderly || 0}</div>
      <div class="result-bar-container">
        <div class="result-bar elderly-bar" style="width: ${totalVictimsByType.elderly > 0 ? Math.round((results.elderly/totalVictimsByType.elderly)*100) : 0}%"></div>
      </div>
      <div class="result-percentage">${totalVictimsByType.elderly > 0 ? Math.round((results.elderly/totalVictimsByType.elderly)*100) : 0}%</div>
    </div>
    
    <div class="result-category">
      <div class="result-label">PWD: ${results.PWD}/${totalVictimsByType.PWD || 0}</div>
      <div class="result-bar-container">
        <div class="result-bar pwd-bar" style="width: ${totalVictimsByType.PWD > 0 ? Math.round((results.PWD/totalVictimsByType.PWD)*100) : 0}%"></div>
      </div>
      <div class="result-percentage">${totalVictimsByType.PWD > 0 ? Math.round((results.PWD/totalVictimsByType.PWD)*100) : 0}%</div>
    </div>
    
    <div class="result-divider"></div>
        
    <style>
      .result-category {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
      .result-label {
        width: 120px;
        font-weight: 500;
      }
      .result-bar-container {
        flex-grow: 1;
        height: 18px;
        background-color: #f0f0f0;
        border-radius: 9px;
        margin: 0 15px;
        overflow: hidden;
      }
      .result-bar {
        height: 100%;
        border-radius: 9px;
      }
      .youth-bar {
        background-color: #ff6384;
      }
      .adult-bar {
        background-color: #ff9f40;
      }
      .elderly-bar {
        background-color: #4bc0c0;
      }
      .pwd-bar {
        background-color: #9966ff;
      }
      .total-bar {
        background-color: #36a2eb;
      }
      .result-percentage {
        width: 50px;
        text-align: right;
        font-weight: bold;
      }
      .result-divider {
        height: 1px;
        background-color: #e0e0e0;
        margin: 20px 0;
      }
      .total-result {
        font-size: 1.1em;
      }
    </style>
`;
  
  // Add urgency progress bars to modal
  uniqueLevels.forEach(level => {
    const percentage = totalByPriority[level] > 0 ? 
      Math.round(rescuedByPriority[level]/totalByPriority[level]*100) : 0;
      
    modalHTML += `
      <div class="urgency-progress">
        <div>${getUrgencyLevelLabel(level)}: ${rescuedByPriority[level]}/${totalByPriority[level]} (${percentage}%)</div>
        <div class="progress-bar">
          <div class="progress-fill ${getUrgencyFillClass(level)}" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });
  
  modalHTML += `
    <div class="result-divider"></div>


  <div class="result-category total-result">
      <div class="result-label">Total Saved: ${Object.values(results).reduce((a, b) => a + b, 0) - results.helper}/${Object.values(totalVictimsByType).reduce((a, b) => a + b, 0)}</div>
      <div class="result-bar-container">
        <div class="result-bar total-bar" style="width: ${Object.values(totalVictimsByType).reduce((a, b) => a + b, 0) > 0 ? Math.round(((Object.values(results).reduce((a, b) => a + b, 0) - results.helper)/Object.values(totalVictimsByType).reduce((a, b) => a + b, 0))*100) : 0}%"></div>
      </div>
      <div class="result-percentage">${Object.values(totalVictimsByType).reduce((a, b) => a + b, 0) > 0 ? Math.round(((Object.values(results).reduce((a, b) => a + b, 0) - results.helper)/Object.values(totalVictimsByType).reduce((a, b) => a + b, 0))*100) : 0}%</div>
    </div>


    <button id="close-modal" class="btn btn-primary" style="margin-top:20px;">Close</button>
  `;
  
  modalContent.innerHTML = modalHTML;
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  document.getElementById('close-modal').addEventListener('click', () => {
    try {
      document.body.removeChild(modalOverlay);
      // Keep the flag true - we've already shown results for this simulation
      resultsShown = true;
      // Make sure all timers are fully cleared
      clearInterval(simTimer);
      clearInterval(countdownTimer);
      clearTimeout(helperSpawnTimer);
      simTimer = null;
      countdownTimer = null;
      helperSpawnTimer = null;
      isRunning = false;
    } catch (e) {
      console.error('Error removing modal:', e);
      document.querySelectorAll('.modal-overlay').forEach(m => 
        document.body.removeChild(m));
    }
  });

  // document.getElementById("start-button").addEventListener("click", () => {
  //   cleanupTimers();
  //   resultsShown = false; // Reset the flag
  //   timer = 30;
  // });
}


// Define as a named function so we don't create multiple anonymous functions
function startButtonHandler() {
  cleanupTimers();
  resultsShown = false; // Reset the flag
  timer = 30;
  savedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };
  perishedCount = { youth: 0, adult: 0, elderly: 0, PWD: 0, helper: 0 };
  totalAgentsByType = { youth: 0, adult: 0, elderly: 0, PWD: 0 };
  
  agents = generateRandomAgents(30);
  logAssignmentDetails();
  generateUrgencyLegend();
  displayPriorityGroups();
  renderGoal();
  renderAgents();
  updateCounters();
  
  isRunning = true;
  startSim();
  startTimer();
}


// Start timer function
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