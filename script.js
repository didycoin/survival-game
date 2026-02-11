// Game Configuration
const CONFIG = {
    FOV: 75,
    NEAR: 0.1,
    FAR: 1000,
    MOVE_SPEED: 0.15,
    JUMP_FORCE: 0.3,
    GRAVITY: 0.015,
    MOUSE_SENSITIVITY: 0.002,
    INTERACTION_DISTANCE: 5,
    TERRAIN_SIZE: 100,
    TREE_COUNT: 50,
    ROCK_COUNT: 30
};

// Game State
const gameState = {
    health: 100,
    hunger: 100,
    thirst: 100,
    inventory: {},
    time: 0, // 0 = midnight, 0.5 = noon, 1 = midnight
    day: 1,
    isJumping: false,
    velocity: new THREE.Vector3(),
    canInteract: false,
    nearestObject: null
};

// Crafting Recipes
const RECIPES = {
    campfire: {
        name: 'Campfire',
        requires: { wood: 5, stone: 3 },
        gives: { campfire: 1 }
    },
    axe: {
        name: 'Stone Axe',
        requires: { wood: 3, stone: 5 },
        gives: { axe: 1 }
    },
    shelter: {
        name: 'Basic Shelter',
        requires: { wood: 10, stone: 5 },
        gives: { shelter: 1 }
    },
    waterbottle: {
        name: 'Water Bottle',
        requires: { stone: 2 },
        gives: { waterbottle: 1 }
    }
};

// Three.js Setup
let scene, camera, renderer;
let controls = {};
let interactableObjects = [];
let raycaster, mouse;

// Initialize the game
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, CONFIG.FAR * 0.8);

    // Camera
    camera = new THREE.PerspectiveCamera(
        CONFIG.FOV,
        window.innerWidth / window.innerHeight,
        CONFIG.NEAR,
        CONFIG.FAR
    );
    camera.position.set(0, 2, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Raycaster for interactions
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Lighting
    createLighting();

    // Terrain
    createTerrain();

    // Environment
    createEnvironment();

    // Event Listeners
    setupEventListeners();

    // Start Screen
    document.getElementById('start-screen').addEventListener('click', startGame);
}

function createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(50, 50, 50);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    gameState.sunLight = sunLight;
    gameState.ambientLight = ambientLight;
}

function createTerrain() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.TERRAIN_SIZE, CONFIG.TERRAIN_SIZE, 50, 50);
    
    // Add some simple height variation
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = Math.random() * 0.5;
    }
    groundGeometry.attributes.position.needsUpdate = true;
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228B22,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

function createEnvironment() {
    // Trees
    for (let i = 0; i < CONFIG.TREE_COUNT; i++) {
        createTree(
            (Math.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9,
            (Math.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9
        );
    }

    // Rocks
    for (let i = 0; i < CONFIG.ROCK_COUNT; i++) {
        createRock(
            (Math.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9,
            (Math.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9
        );
    }
}

function createTree(x, z) {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage
    const foliageGeometry = new THREE.SphereGeometry(1.5, 8, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 3.5;
    foliage.castShadow = true;
    tree.add(foliage);

    tree.position.set(x, 0, z);
    tree.userData = { type: 'tree', resource: 'wood', amount: 3 };
    
    scene.add(tree);
    interactableObjects.push(tree);
}

function createRock(x, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(0.8, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        roughness: 0.9
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, 0.4, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.userData = { type: 'rock', resource: 'stone', amount: 2 };
    
    scene.add(rock);
    interactableObjects.push(rock);
}

function setupEventListeners() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        controls[e.key.toLowerCase()] = true;
        
        if (e.key.toLowerCase() === 'e' && gameState.canInteract && gameState.nearestObject) {
            interactWithObject(gameState.nearestObject);
        }
        
        if (e.key.toLowerCase() === 'c') {
            toggleCraftingMenu();
        }
        
        if (e.key === ' ' && !gameState.isJumping) {
            gameState.velocity.y = CONFIG.JUMP_FORCE;
            gameState.isJumping = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        controls[e.key.toLowerCase()] = false;
    });

    // Mouse movement
    document.addEventListener('mousemove', onMouseMove);

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Crafting menu
    document.getElementById('close-crafting').addEventListener('click', () => {
        document.getElementById('crafting-menu').style.display = 'none';
    });
}

let mouseMovement = { x: 0, y: 0 };

function onMouseMove(event) {
    if (document.pointerLockElement === renderer.domElement) {
        mouseMovement.x = event.movementX || 0;
        mouseMovement.y = event.movementY || 0;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    renderer.domElement.requestPointerLock();
    animate();
    updateSurvivalStats();
}

function updateCamera() {
    if (document.pointerLockElement === renderer.domElement) {
        // Rotate camera with mouse
        camera.rotation.y -= mouseMovement.x * CONFIG.MOUSE_SENSITIVITY;
        camera.rotation.x -= mouseMovement.y * CONFIG.MOUSE_SENSITIVITY;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        
        mouseMovement.x = 0;
        mouseMovement.y = 0;
    }

    // Movement
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    right.crossVectors(camera.up, direction).normalize();

    const moveVector = new THREE.Vector3();

    if (controls['w']) moveVector.add(direction);
    if (controls['s']) moveVector.sub(direction);
    if (controls['a']) moveVector.add(right);
    if (controls['d']) moveVector.sub(right);

    moveVector.normalize().multiplyScalar(CONFIG.MOVE_SPEED);

    // Apply gravity
    gameState.velocity.y -= CONFIG.GRAVITY;
    
    camera.position.x += moveVector.x;
    camera.position.z += moveVector.z;
    camera.position.y += gameState.velocity.y;

    // Ground collision
    if (camera.position.y <= 2) {
        camera.position.y = 2;
        gameState.velocity.y = 0;
        gameState.isJumping = false;
    }

    // Boundary check
    const boundary = CONFIG.TERRAIN_SIZE / 2 - 2;
    camera.position.x = Math.max(-boundary, Math.min(boundary, camera.position.x));
    camera.position.z = Math.max(-boundary, Math.min(boundary, camera.position.z));
}

function checkInteraction() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.type) {
            object = object.parent;
        }

        if (object.userData.type && intersects[0].distance < CONFIG.INTERACTION_DISTANCE) {
            gameState.canInteract = true;
            gameState.nearestObject = object;
            return;
        }
    }

    gameState.canInteract = false;
    gameState.nearestObject = null;
}

function interactWithObject(object) {
    if (!object.userData.type) return;

    const resource = object.userData.resource;
    const amount = object.userData.amount;

    // Add to inventory
    if (!gameState.inventory[resource]) {
        gameState.inventory[resource] = 0;
    }
    gameState.inventory[resource] += amount;

    showMessage(`+${amount} ${resource}`);
    updateInventoryDisplay();

    // Remove object
    scene.remove(object);
    const index = interactableObjects.indexOf(object);
    if (index > -1) {
        interactableObjects.splice(index, 1);
    }

    gameState.canInteract = false;
    gameState.nearestObject = null;
}

function updateInventoryDisplay() {
    const container = document.getElementById('inventory-items');
    container.innerHTML = '';

    for (const [item, count] of Object.entries(gameState.inventory)) {
        if (count > 0) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            itemDiv.innerHTML = `
                <span>${item}</span>
                <span class="item-count">${count}</span>
            `;
            container.appendChild(itemDiv);
        }
    }
}

function toggleCraftingMenu() {
    const menu = document.getElementById('crafting-menu');
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        updateCraftingDisplay();
    }
}

function updateCraftingDisplay() {
    const container = document.getElementById('crafting-recipes');
    container.innerHTML = '';

    for (const [id, recipe] of Object.entries(RECIPES)) {
        const canCraft = Object.entries(recipe.requires).every(
            ([item, amount]) => (gameState.inventory[item] || 0) >= amount
        );

        const recipeDiv = document.createElement('div');
        recipeDiv.className = `recipe-item ${canCraft ? '' : 'disabled'}`;
        
        const requirements = Object.entries(recipe.requires)
            .map(([item, amount]) => `${item}: ${amount}`)
            .join(', ');

        recipeDiv.innerHTML = `
            <div class="recipe-name">${recipe.name}</div>
            <div class="recipe-requirements">Requires: ${requirements}</div>
        `;

        if (canCraft) {
            recipeDiv.addEventListener('click', () => craftItem(id, recipe));
        }

        container.appendChild(recipeDiv);
    }
}

function craftItem(id, recipe) {
    // Check if can craft
    const canCraft = Object.entries(recipe.requires).every(
        ([item, amount]) => (gameState.inventory[item] || 0) >= amount
    );

    if (!canCraft) return;

    // Remove requirements
    for (const [item, amount] of Object.entries(recipe.requires)) {
        gameState.inventory[item] -= amount;
    }

    // Add crafted item
    for (const [item, amount] of Object.entries(recipe.gives)) {
        if (!gameState.inventory[item]) {
            gameState.inventory[item] = 0;
        }
        gameState.inventory[item] += amount;
    }

    showMessage(`Crafted ${recipe.name}!`);
    updateInventoryDisplay();
    updateCraftingDisplay();
}

function updateSurvivalStats() {
    setInterval(() => {
        // Decrease stats over time
        gameState.hunger = Math.max(0, gameState.hunger - 0.1);
        gameState.thirst = Math.max(0, gameState.thirst - 0.15);

        // Take damage if stats are low
        if (gameState.hunger === 0 || gameState.thirst === 0) {
            gameState.health = Math.max(0, gameState.health - 0.2);
        }

        // Update UI
        updateStatsDisplay();

        // Check game over
        if (gameState.health === 0) {
            gameOver();
        }
    }, 1000);
}

function updateStatsDisplay() {
    document.getElementById('health-bar').style.width = gameState.health + '%';
    document.getElementById('health-value').textContent = Math.round(gameState.health);
    
    document.getElementById('hunger-bar').style.width = gameState.hunger + '%';
    document.getElementById('hunger-value').textContent = Math.round(gameState.hunger);
    
    document.getElementById('thirst-bar').style.width = gameState.thirst + '%';
    document.getElementById('thirst-value').textContent = Math.round(gameState.thirst);
}

function updateDayNight() {
    gameState.time += 0.0001;
    if (gameState.time >= 1) {
        gameState.time = 0;
        gameState.day++;
    }

    // Update sun position and color
    const sunAngle = gameState.time * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * 50;
    const sunY = Math.sin(sunAngle) * 50;
    gameState.sunLight.position.set(sunX, Math.abs(sunY), 50);

    // Update lighting based on time
    const dayIntensity = Math.max(0.2, Math.sin(sunAngle));
    gameState.sunLight.intensity = dayIntensity * 0.8;
    gameState.ambientLight.intensity = dayIntensity * 0.4;

    // Update sky color
    if (sunY > 0) {
        scene.background.setHex(0x87CEEB); // Day
    } else {
        const nightness = Math.abs(sunY) / 50;
        const skyColor = Math.floor((1 - nightness) * 0x87CEEB);
        scene.background.setHex(Math.max(0x000022, skyColor));
    }

    // Update time display
    const hours = Math.floor(gameState.time * 24);
    const minutes = Math.floor((gameState.time * 24 * 60) % 60);
    document.getElementById('time-text').textContent = 
        `Day ${gameState.day} - ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function showMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'game-message';
    messageDiv.textContent = text;
    document.getElementById('message-display').appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function gameOver() {
    showMessage('Game Over - You survived ' + gameState.day + ' days!');
    setTimeout(() => {
        location.reload();
    }, 3000);
}

function animate() {
    requestAnimationFrame(animate);

    updateCamera();
    checkInteraction();
    updateDayNight();

    renderer.render(scene, camera);
}

// Initialize when page loads
window.addEventListener('load', init);
