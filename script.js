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
    ROCK_COUNT: 30,
    SEED: Math.random() * 10000 // Random seed for map generation
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
        gives: { campfire: 1 },
        description: 'Provides warmth and light'
    },
    axe: {
        name: 'Stone Axe',
        requires: { wood: 3, stone: 5 },
        gives: { axe: 1 },
        description: 'Gather wood faster'
    },
    pickaxe: {
        name: 'Stone Pickaxe',
        requires: { wood: 2, stone: 6 },
        gives: { pickaxe: 1 },
        description: 'Gather stone faster'
    },
    shelter: {
        name: 'Basic Shelter',
        requires: { wood: 10, stone: 5 },
        gives: { shelter: 1 },
        description: 'A safe place to rest'
    },
    waterbottle: {
        name: 'Water Bottle',
        requires: { stone: 2 },
        gives: { waterbottle: 1 },
        description: 'Store water for later'
    },
    berries: {
        name: 'Berry Bush',
        requires: { wood: 3 },
        gives: { berries: 5 },
        description: 'Plant berries to harvest food'
    },
    cookedmeat: {
        name: 'Cook Meat',
        requires: { rawmeat: 1, campfire: 1 },
        gives: { cookedmeat: 1, campfire: 1 },
        description: 'Restores 30 hunger'
    },
    torch: {
        name: 'Torch',
        requires: { wood: 2, stone: 1 },
        gives: { torch: 3 },
        description: 'Light up the night'
    },
    wall: {
        name: 'Wooden Wall',
        requires: { wood: 8 },
        gives: { wall: 1 },
        description: 'Build protective walls'
    },
    workbench: {
        name: 'Workbench',
        requires: { wood: 15, stone: 10 },
        gives: { workbench: 1 },
        description: 'Unlock advanced crafting'
    },
    spear: {
        name: 'Wooden Spear',
        requires: { wood: 4, stone: 2 },
        gives: { spear: 1 },
        description: 'A basic weapon'
    },
    backpack: {
        name: 'Backpack',
        requires: { wood: 5, stone: 3 },
        gives: { backpack: 1 },
        description: 'Carry more items'
    }
};

// Three.js Setup
let scene, camera, renderer;
let controls = {};
let interactableObjects = [];
let raycaster, mouse;

// Seeded random number generator for consistent random maps
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }
}

const seededRandom = new SeededRandom(CONFIG.SEED);

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
    // Ground with varied height based on seed
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.TERRAIN_SIZE, CONFIG.TERRAIN_SIZE, 50, 50);
    
    // Add procedural height variation using seeded random
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = seededRandom.random() * 1.5 - 0.3;
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
    // Trees - using seeded random for consistent placement
    for (let i = 0; i < CONFIG.TREE_COUNT; i++) {
        createTree(
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9,
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9
        );
    }

    // Rocks - using seeded random
    for (let i = 0; i < CONFIG.ROCK_COUNT; i++) {
        createRock(
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9,
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9
        );
    }
    
    // Add some berry bushes
    for (let i = 0; i < 15; i++) {
        createBerryBush(
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9,
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9
        );
    }
    
    // Add animals for hunting
    for (let i = 0; i < 10; i++) {
        createAnimal(
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9,
            (seededRandom.random() - 0.5) * CONFIG.TERRAIN_SIZE * 0.9
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

function createBerryBush(x, z) {
    const bush = new THREE.Group();
    
    // Bush body
    const bushGeometry = new THREE.SphereGeometry(0.6, 8, 8);
    const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5016 });
    const bushMesh = new THREE.Mesh(bushGeometry, bushMaterial);
    bushMesh.position.y = 0.6;
    bushMesh.scale.set(1, 0.8, 1);
    bushMesh.castShadow = true;
    bush.add(bushMesh);
    
    // Berries (small red spheres)
    for (let i = 0; i < 5; i++) {
        const berryGeometry = new THREE.SphereGeometry(0.08, 6, 6);
        const berryMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const berry = new THREE.Mesh(berryGeometry, berryMaterial);
        berry.position.set(
            (Math.random() - 0.5) * 0.8,
            0.6 + (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.8
        );
        bush.add(berry);
    }
    
    bush.position.set(x, 0, z);
    bush.userData = { type: 'bush', resource: 'rawberries', amount: 3 };
    
    scene.add(bush);
    interactableObjects.push(bush);
}

function createAnimal(x, z) {
    const animal = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.5, 1.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    animal.add(body);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.6);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.set(0, 0.5, 0.9);
    head.castShadow = true;
    animal.add(head);
    
    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5);
    const positions = [
        [0.3, 0.25, 0.4],
        [-0.3, 0.25, 0.4],
        [0.3, 0.25, -0.4],
        [-0.3, 0.25, -0.4]
    ];
    
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, bodyMaterial);
        leg.position.set(...pos);
        leg.castShadow = true;
        animal.add(leg);
    });
    
    animal.position.set(x, 0, z);
    animal.rotation.y = Math.random() * Math.PI * 2;
    animal.userData = { type: 'animal', resource: 'rawmeat', amount: 2 };
    
    scene.add(animal);
    interactableObjects.push(animal);
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
        
        // Use consumable items with number keys
        if (e.key >= '1' && e.key <= '9') {
            useConsumable(parseInt(e.key));
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
let pitch = 0; // Up/down look (clamped to -90 to +90)
let yaw = 0;   // Left/right rotation

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
    
    // Initialize camera angles
    pitch = 0;
    yaw = 0;
    
    animate();
    updateSurvivalStats();
}

function updateCamera() {
    if (document.pointerLockElement === renderer.domElement) {
        // Update yaw (left/right) - can spin 360 degrees
        yaw -= mouseMovement.x * CONFIG.MOUSE_SENSITIVITY;
        
        // Update pitch (up/down) - clamped to -90 to +90 degrees
        pitch -= mouseMovement.y * CONFIG.MOUSE_SENSITIVITY;
        
        // Clamp pitch: -90 degrees (straight down at feet) to +90 degrees (straight up at sky)
        const maxPitch = Math.PI / 2 - 0.01; // Just before vertical
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
        
        mouseMovement.x = 0;
        mouseMovement.y = 0;
    }

    // Apply camera rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;

    // Movement direction based on where you're facing (yaw only, not pitch)
    const forward = new THREE.Vector3(
        Math.sin(yaw),
        0,
        Math.cos(yaw)
    );
    
    const right = new THREE.Vector3(
        Math.sin(yaw + Math.PI / 2),
        0,
        Math.cos(yaw + Math.PI / 2)
    );

    const moveVector = new THREE.Vector3();

    if (controls['w']) moveVector.add(forward);
    if (controls['s']) moveVector.sub(forward);
    if (controls['d']) moveVector.add(right);
    if (controls['a']) moveVector.sub(right);

    if (moveVector.length() > 0) {
        moveVector.normalize().multiplyScalar(CONFIG.MOVE_SPEED);
    }

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

    const consumables = ['rawberries', 'cookedmeat', 'waterbottle'];
    let slotNumber = 1;

    for (const [item, count] of Object.entries(gameState.inventory)) {
        if (count > 0) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            
            const isConsumable = consumables.includes(item);
            const slotDisplay = isConsumable ? `[${slotNumber}] ` : '';
            
            itemDiv.innerHTML = `
                <span>${slotDisplay}${item}</span>
                <span class="item-count">${count}</span>
            `;
            
            if (isConsumable) {
                itemDiv.style.background = 'rgba(100, 200, 100, 0.2)';
                slotNumber++;
            }
            
            container.appendChild(itemDiv);
        }
    }
}

function useConsumable(slotNumber) {
    const consumables = ['rawberries', 'cookedmeat', 'waterbottle'];
    const consumableItems = consumables.filter(item => (gameState.inventory[item] || 0) > 0);
    
    if (slotNumber <= consumableItems.length) {
        const item = consumableItems[slotNumber - 1];
        
        if (gameState.inventory[item] > 0) {
            gameState.inventory[item]--;
            
            // Apply effects
            switch(item) {
                case 'rawberries':
                    gameState.hunger = Math.min(100, gameState.hunger + 15);
                    showMessage('Ate berries (+15 hunger)');
                    break;
                case 'cookedmeat':
                    gameState.hunger = Math.min(100, gameState.hunger + 30);
                    gameState.health = Math.min(100, gameState.health + 5);
                    showMessage('Ate cooked meat (+30 hunger, +5 health)');
                    break;
                case 'waterbottle':
                    gameState.thirst = Math.min(100, gameState.thirst + 50);
                    showMessage('Drank water (+50 thirst)');
                    break;
            }
            
            updateInventoryDisplay();
            updateStatsDisplay();
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
            .map(([item, amount]) => {
                const has = gameState.inventory[item] || 0;
                const color = has >= amount ? '#4CAF50' : '#f44336';
                return `<span style="color: ${color}">${item}: ${has}/${amount}</span>`;
            })
            .join(', ');

        recipeDiv.innerHTML = `
            <div class="recipe-name">${recipe.name}</div>
            <div class="recipe-requirements">Requires: ${requirements}</div>
            <div class="recipe-requirements" style="margin-top: 5px; font-style: italic;">${recipe.description}</div>
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
