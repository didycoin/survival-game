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
    CHUNK_SIZE: 50, // Size of each terrain chunk
    RENDER_DISTANCE: 3, // How many chunks to render around player
    TREE_COUNT: 50,
    ROCK_COUNT: 30,
    SEED: Math.random() * 10000 // Random seed for map generation
};

// Game State
const gameState = {
    health: 100,
    hunger: 100,
    thirst: 100,
    inventory: { rock: 1 }, // Start with a rock
    time: 0, // 0 = midnight, 0.5 = noon, 1 = midnight
    day: 1,
    isJumping: false,
    velocity: new THREE.Vector3(),
    canInteract: false,
    nearestObject: null,
    buildMode: false,
    buildingPreview: null,
    buildingType: null,
    placedBuildings: [],
    chunks: {}, // For terrain generation
    lastChunkX: 0,
    lastChunkZ: 0,
    selectedCraftIndex: 0,
    selectedBuildIndex: 0,
    equippedItem: 'rock', // Start with rock equipped
    handModel: null // Visual hand/tool model
};

// Crafting Recipes
const RECIPES = {
    stoneaxe: {
        name: 'Stone Axe',
        requires: { wood: 5, rock: 3 },
        gives: { stoneaxe: 1 },
        description: 'Chop trees faster (+3 wood per tree)'
    },
    stonepickaxe: {
        name: 'Stone Pickaxe',
        requires: { wood: 3, rock: 5 },
        gives: { stonepickaxe: 1 },
        description: 'Mine rocks faster (+3 stone per rock)'
    },
    spear: {
        name: 'Wooden Spear',
        requires: { wood: 4, rock: 2 },
        gives: { spear: 1 },
        description: 'Hunt animals (+2 meat)'
    },
    torch: {
        name: 'Torch',
        requires: { wood: 2, rock: 1 },
        gives: { torch: 1 },
        description: 'Light source'
    },
    campfire: {
        name: 'Campfire',
        requires: { wood: 5, rock: 3 },
        gives: { campfire: 1 },
        description: 'Cook food and stay warm'
    },
    buildingplan: {
        name: 'Building Plan',
        requires: { wood: 5 },
        gives: { buildingplan: 1 },
        description: 'Required to build structures'
    },
    cookedmeat: {
        name: 'Cook Meat',
        requires: { rawmeat: 1, campfire: 1 },
        gives: { cookedmeat: 1, campfire: 1 },
        description: 'Restores 30 hunger'
    },
    waterbottle: {
        name: 'Water Bottle',
        requires: { rock: 2 },
        gives: { waterbottle: 1 },
        description: 'Store water (+50 thirst)'
    },
    workbench: {
        name: 'Workbench',
        requires: { wood: 15, rock: 10 },
        gives: { workbench: 1 },
        description: 'Unlock advanced crafting'
    }
};

// Building structures (require building plan)
const BUILDINGS = {
    foundation: {
        name: 'Foundation',
        requires: { wood: 10, buildingplan: 1 },
        returnsPlan: true,
        description: 'Base for structures'
    },
    wall: {
        name: 'Wall',
        requires: { wood: 8, buildingplan: 1 },
        returnsPlan: true,
        description: 'Wooden wall'
    },
    doorway: {
        name: 'Doorway',
        requires: { wood: 6, buildingplan: 1 },
        returnsPlan: true,
        description: 'Wall with door opening'
    },
    floor: {
        name: 'Floor',
        requires: { wood: 8, buildingplan: 1 },
        returnsPlan: true,
        description: 'Floor piece'
    },
    stairs: {
        name: 'Stairs',
        requires: { wood: 12, buildingplan: 1 },
        returnsPlan: true,
        description: 'Wooden stairs'
    },
    roof: {
        name: 'Roof',
        requires: { wood: 6, buildingplan: 1 },
        returnsPlan: true,
        description: 'Slanted roof piece'
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
    scene.fog = new THREE.Fog(0x87CEEB, 100, 300); // Increased fog distance

    // Camera
    camera = new THREE.PerspectiveCamera(
        CONFIG.FOV,
        window.innerWidth / window.innerHeight,
        CONFIG.NEAR,
        CONFIG.FAR
    );
    camera.position.set(0, 2, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Better quality on high-DPI screens
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better colors
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    // Raycaster for interactions
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Lighting
    createLighting();

    // Terrain chunks (infinite generation)
    createTerrain();

    // Event Listeners
    setupEventListeners();

    // Start Screen
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.addEventListener('click', () => {
            console.log('Start screen clicked!');
            startGame();
        });
        console.log('Start screen listener added');
    }
}

function createLighting() {
    // Ambient light - softer
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Directional light (sun) - stronger and better positioned
    const sunLight = new THREE.DirectionalLight(0xfff4e6, 1.2);
    sunLight.position.set(50, 60, 30);
    sunLight.castShadow = true;
    
    // Better shadow quality
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);
    
    // Add hemisphere light for more natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x5a4a3a, 0.4);
    scene.add(hemisphereLight);
    
    gameState.sunLight = sunLight;
    gameState.ambientLight = ambientLight;
    gameState.hemisphereLight = hemisphereLight;
}

function createTerrain() {
    // Initial chunks around spawn
    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
            generateChunk(x, z);
        }
    }
}

function generateChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Don't generate if already exists
    if (gameState.chunks[chunkKey]) return;
    
    const chunk = {
        x: chunkX,
        z: chunkZ,
        objects: []
    };
    
    // Ground - positioned at chunk origin, no gaps
    const segments = 25; // Higher resolution for smoother terrain
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.CHUNK_SIZE, CONFIG.CHUNK_SIZE, segments, segments);
    
    const vertices = groundGeometry.attributes.position.array;
    
    // Use world coordinates for vertex heights to ensure seamless chunk borders
    for (let i = 0; i < vertices.length; i += 3) {
        const localX = vertices[i];
        const localZ = vertices[i + 1];
        
        // Calculate world position for this vertex
        const worldX = chunkX * CONFIG.CHUNK_SIZE + localX;
        const worldZ = chunkZ * CONFIG.CHUNK_SIZE + localZ;
        
        // Use world position for consistent height across chunk boundaries
        const heightSeed = CONFIG.SEED + Math.floor(worldX * 10) + Math.floor(worldZ * 10) * 1000;
        const heightRandom = new SeededRandom(heightSeed);
        
        vertices[i + 2] = heightRandom.random() * 1.5 - 0.3;
    }
    groundGeometry.attributes.position.needsUpdate = true;
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3a5f3a, // Richer green
        roughness: 0.9,
        metalness: 0.0,
        flatShading: false
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    // Position at exact chunk coordinates - no offset
    ground.position.x = chunkX * CONFIG.CHUNK_SIZE;
    ground.position.y = 0;
    ground.position.z = chunkZ * CONFIG.CHUNK_SIZE;
    ground.receiveShadow = true;
    
    scene.add(ground);
    chunk.objects.push(ground);
    
    // Create random generator for object placement in this chunk
    const chunkSeed = CONFIG.SEED + chunkX * 1000 + chunkZ;
    const chunkRandom = new SeededRandom(chunkSeed);
    
    // Add trees to chunk
    const treesPerChunk = Math.floor(CONFIG.TREE_COUNT / 9); // Distribute trees
    for (let i = 0; i < treesPerChunk; i++) {
        const x = chunkX * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const z = chunkZ * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const tree = createTree(x, z);
        chunk.objects.push(tree);
    }
    
    // Add rocks to chunk
    const rocksPerChunk = Math.floor(CONFIG.ROCK_COUNT / 9);
    for (let i = 0; i < rocksPerChunk; i++) {
        const x = chunkX * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const z = chunkZ * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const rock = createRock(x, z);
        chunk.objects.push(rock);
    }
    
    // Add berry bushes
    const bushesPerChunk = 3;
    for (let i = 0; i < bushesPerChunk; i++) {
        const x = chunkX * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const z = chunkZ * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const bush = createBerryBush(x, z);
        chunk.objects.push(bush);
    }
    
    // Add animals
    const animalsPerChunk = 2;
    for (let i = 0; i < animalsPerChunk; i++) {
        const x = chunkX * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const z = chunkZ * CONFIG.CHUNK_SIZE + (chunkRandom.random() - 0.5) * CONFIG.CHUNK_SIZE * 0.8;
        const animal = createAnimal(x, z);
        chunk.objects.push(animal);
    }
    
    gameState.chunks[chunkKey] = chunk;
}

function updateChunks() {
    // Get player's chunk position
    const playerChunkX = Math.floor(camera.position.x / CONFIG.CHUNK_SIZE);
    const playerChunkZ = Math.floor(camera.position.z / CONFIG.CHUNK_SIZE);
    
    // Only update if player moved to new chunk
    if (playerChunkX !== gameState.lastChunkX || playerChunkZ !== gameState.lastChunkZ) {
        gameState.lastChunkX = playerChunkX;
        gameState.lastChunkZ = playerChunkZ;
        
        // Generate chunks around player
        for (let x = -CONFIG.RENDER_DISTANCE; x <= CONFIG.RENDER_DISTANCE; x++) {
            for (let z = -CONFIG.RENDER_DISTANCE; z <= CONFIG.RENDER_DISTANCE; z++) {
                generateChunk(playerChunkX + x, playerChunkZ + z);
            }
        }
        
        // Remove far chunks to save memory
        const chunksToRemove = [];
        for (const chunkKey in gameState.chunks) {
            const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
            const distX = Math.abs(chunkX - playerChunkX);
            const distZ = Math.abs(chunkZ - playerChunkZ);
            
            if (distX > CONFIG.RENDER_DISTANCE + 1 || distZ > CONFIG.RENDER_DISTANCE + 1) {
                chunksToRemove.push(chunkKey);
            }
        }
        
        // Remove chunks
        for (const chunkKey of chunksToRemove) {
            const chunk = gameState.chunks[chunkKey];
            for (const obj of chunk.objects) {
                scene.remove(obj);
                const index = interactableObjects.indexOf(obj);
                if (index > -1) {
                    interactableObjects.splice(index, 1);
                }
            }
            delete gameState.chunks[chunkKey];
        }
    }
}

function createTree(x, z) {
    const tree = new THREE.Group();

    // Trunk - more realistic brown
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a3426,
        roughness: 0.9,
        metalness: 0.0
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Foliage - deeper green with multiple layers
    const foliageGeometry = new THREE.SphereGeometry(1.5, 8, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a5f1a,
        roughness: 0.8,
        metalness: 0.0
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 3.5;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);
    
    // Second foliage layer for depth
    const foliage2 = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage2.position.y = 4.2;
    foliage2.scale.set(0.7, 0.7, 0.7);
    foliage2.castShadow = true;
    tree.add(foliage2);

    tree.position.set(x, 0, z);
    tree.userData = { type: 'tree', resource: 'wood', amount: 3 };
    
    scene.add(tree);
    interactableObjects.push(tree);
    
    return tree;
}

function createRock(x, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(0.8, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x6b6b6b,
        roughness: 0.95,
        metalness: 0.1
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, 0.4, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.userData = { type: 'rock', resource: 'rock', amount: 2 };
    
    scene.add(rock);
    interactableObjects.push(rock);
    
    return rock;
}

function createBerryBush(x, z) {
    const bush = new THREE.Group();
    
    // Bush body - darker green
    const bushGeometry = new THREE.SphereGeometry(0.6, 8, 8);
    const bushMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1f3d0f,
        roughness: 0.9
    });
    const bushMesh = new THREE.Mesh(bushGeometry, bushMaterial);
    bushMesh.position.y = 0.6;
    bushMesh.scale.set(1, 0.8, 1);
    bushMesh.castShadow = true;
    bushMesh.receiveShadow = true;
    bush.add(bushMesh);
    
    // Berries - shinier red spheres
    for (let i = 0; i < 5; i++) {
        const berryGeometry = new THREE.SphereGeometry(0.08, 6, 6);
        const berryMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xcc0000,
            roughness: 0.3,
            metalness: 0.1
        });
        const berry = new THREE.Mesh(berryGeometry, berryMaterial);
        berry.position.set(
            (Math.random() - 0.5) * 0.8,
            0.6 + (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.8
        );
        berry.castShadow = true;
        bush.add(berry);
    }
    
    bush.position.set(x, 0, z);
    bush.userData = { type: 'bush', resource: 'rawberries', amount: 3 };
    
    scene.add(bush);
    interactableObjects.push(bush);
    
    return bush;
}

function createAnimal(x, z) {
    const animal = new THREE.Group();
    
    // Body - more realistic brown
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.5, 1.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x6b4423,
        roughness: 0.8
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    animal.add(body);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.6);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.set(0, 0.5, 0.9);
    head.castShadow = true;
    head.receiveShadow = true;
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
    
    return animal;
}

function setupEventListeners() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        // Don't process keys until game has started
        const startScreen = document.getElementById('start-screen');
        if (startScreen.style.display !== 'none') {
            return;
        }
        
        controls[e.key.toLowerCase()] = true;
        
        // Menu navigation
        const inventoryMenu = document.getElementById('inventory-menu');
        const buildMenu = document.getElementById('build-menu');
        const isInventoryOpen = inventoryMenu.style.display !== 'none';
        const isBuildOpen = buildMenu.style.display !== 'none';
        
        // Handle Tab for inventory (like Rust)
        if (e.key === 'Tab') {
            e.preventDefault();
            const inventoryMenu = document.getElementById('inventory-menu');
            const isBuildOpen = buildMenu.style.display !== 'none';
            
            // Toggle inventory
            if (inventoryMenu.style.display !== 'none') {
                inventoryMenu.style.display = 'none';
            } else {
                inventoryMenu.style.display = 'block';
                gameState.selectedCraftIndex = 0;
                updateCraftingDisplay();
            }
            
            // Close build menu if open
            if (isBuildOpen) {
                buildMenu.style.display = 'none';
                if (gameState.buildMode) {
                    gameState.buildMode = false;
                    if (gameState.buildingPreview) {
                        scene.remove(gameState.buildingPreview);
                        gameState.buildingPreview = null;
                    }
                }
            }
            return;
        }
        
        if (e.key.toLowerCase() === 'b') {
            e.preventDefault();
            // Close crafting menu if open
            if (isCraftingOpen) {
                craftingMenu.style.display = 'none';
            }
            // Toggle build menu
            if (isBuildOpen) {
                buildMenu.style.display = 'none';
                if (gameState.buildMode) {
                    gameState.buildMode = false;
                    if (gameState.buildingPreview) {
                        scene.remove(gameState.buildingPreview);
                        gameState.buildingPreview = null;
                    }
                }
            } else {
                // Check if player has building plan
                if (!gameState.inventory['buildingplan'] || gameState.inventory['buildingplan'] < 1) {
                    showMessage('You need a Building Plan to build! (Craft one first)');
                } else {
                    buildMenu.style.display = 'block';
                    gameState.selectedBuildIndex = 0;
                    updateBuildingDisplay();
                }
            }
            return;
        }
        
        // Arrow key navigation only when a menu is actually open
        if (isInventoryOpen || isBuildOpen) {
            const recipes = isInventoryOpen ? Object.keys(RECIPES) : Object.keys(BUILDINGS);
            const maxIndex = recipes.length - 1;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (isInventoryOpen) {
                    gameState.selectedCraftIndex = Math.min(gameState.selectedCraftIndex + 1, maxIndex);
                    updateCraftingDisplay();
                    scrollToSelected('crafting-recipes');
                } else {
                    gameState.selectedBuildIndex = Math.min(gameState.selectedBuildIndex + 1, maxIndex);
                    updateBuildingDisplay();
                    scrollToSelected('building-options');
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (isInventoryOpen) {
                    gameState.selectedCraftIndex = Math.max(gameState.selectedCraftIndex - 1, 0);
                    updateCraftingDisplay();
                    scrollToSelected('crafting-recipes');
                } else {
                    gameState.selectedBuildIndex = Math.max(gameState.selectedBuildIndex - 1, 0);
                    updateBuildingDisplay();
                    scrollToSelected('building-options');
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (isInventoryOpen) {
                    const recipeId = recipes[gameState.selectedCraftIndex];
                    const recipe = RECIPES[recipeId];
                    craftItem(recipeId, recipe);
                } else {
                    const buildId = recipes[gameState.selectedBuildIndex];
                    const building = BUILDINGS[buildId];
                    enterBuildMode(buildId, building);
                }
            }
            return; // Don't process other keys when menu is open
        }
        
        if (e.key.toLowerCase() === 'e' && gameState.canInteract && gameState.nearestObject) {
            interactWithObject(gameState.nearestObject);
        }
        
        if (e.key.toLowerCase() === 'q' && gameState.buildMode) {
            rotateBuildingPreview();
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

    // Mouse click for building
    document.addEventListener('click', () => {
        if (gameState.buildMode && gameState.buildingPreview) {
            placeBuilding();
        }
    });

    // Mouse movement
    document.addEventListener('mousemove', onMouseMove);

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Crafting menu
    document.getElementById('close-crafting').addEventListener('click', () => {
        document.getElementById('crafting-menu').style.display = 'none';
    });
    
    // Build menu
    document.getElementById('close-build').addEventListener('click', () => {
        document.getElementById('build-menu').style.display = 'none';
        // Exit build mode
        if (gameState.buildMode) {
            gameState.buildMode = false;
            if (gameState.buildingPreview) {
                scene.remove(gameState.buildingPreview);
                gameState.buildingPreview = null;
            }
        }
    });
    
    // Inventory menu
    document.getElementById('close-inventory').addEventListener('click', () => {
        document.getElementById('inventory-menu').style.display = 'none';
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
    
    // Create initial hand model
    createHandModel();
    updateHandModel();
    
    animate();
    updateSurvivalStats();
}

function createHandModel() {
    // Remove old hand if exists
    if (gameState.handModel) {
        camera.remove(gameState.handModel);
    }
    
    const handGroup = new THREE.Group();
    
    // Right hand (box shape)
    const handGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.08);
    const handMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xd4a574,
        roughness: 0.8
    });
    const rightHand = new THREE.Mesh(handGeometry, handMaterial);
    rightHand.position.set(0.3, -0.2, -0.4);
    handGroup.add(rightHand);
    
    // Left hand
    const leftHand = new THREE.Mesh(handGeometry, handMaterial);
    leftHand.position.set(-0.3, -0.2, -0.4);
    handGroup.add(leftHand);
    
    gameState.handModel = handGroup;
    camera.add(handGroup);
}

function updateHandModel() {
    if (!gameState.handModel) return;
    
    // Remove old tool model
    const oldTool = gameState.handModel.getObjectByName('tool');
    if (oldTool) {
        gameState.handModel.remove(oldTool);
    }
    
    // Add tool model based on equipped item
    if (gameState.equippedItem && gameState.equippedItem !== 'none') {
        const toolGroup = new THREE.Group();
        toolGroup.name = 'tool';
        
        switch(gameState.equippedItem) {
            case 'rock':
                const rockGeom = new THREE.DodecahedronGeometry(0.08, 0);
                const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });
                const rockMesh = new THREE.Mesh(rockGeom, rockMat);
                rockMesh.position.set(0.35, -0.15, -0.35);
                toolGroup.add(rockMesh);
                break;
                
            case 'stoneaxe':
                // Axe handle
                const handleGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
                const handleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const handle = new THREE.Mesh(handleGeom, handleMat);
                handle.position.set(0.3, -0.1, -0.4);
                handle.rotation.z = Math.PI / 4;
                toolGroup.add(handle);
                
                // Axe head
                const axeHeadGeom = new THREE.BoxGeometry(0.15, 0.08, 0.05);
                const axeHeadMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });
                const axeHead = new THREE.Mesh(axeHeadGeom, axeHeadMat);
                axeHead.position.set(0.45, 0.05, -0.4);
                toolGroup.add(axeHead);
                break;
                
            case 'stonepickaxe':
                // Pickaxe handle
                const pickHandleGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
                const pickHandleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const pickHandle = new THREE.Mesh(pickHandleGeom, pickHandleMat);
                pickHandle.position.set(0.3, -0.1, -0.4);
                pickHandle.rotation.z = Math.PI / 4;
                toolGroup.add(pickHandle);
                
                // Pick head
                const pickHeadGeom = new THREE.BoxGeometry(0.2, 0.05, 0.05);
                const pickHeadMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });
                const pickHead = new THREE.Mesh(pickHeadGeom, pickHeadMat);
                pickHead.position.set(0.45, 0.05, -0.4);
                toolGroup.add(pickHead);
                break;
                
            case 'spear':
                // Spear shaft
                const spearShaftGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.6);
                const spearShaftMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const spearShaft = new THREE.Mesh(spearShaftGeom, spearShaftMat);
                spearShaft.position.set(0.3, -0.05, -0.5);
                spearShaft.rotation.z = Math.PI / 6;
                toolGroup.add(spearShaft);
                
                // Spear tip
                const spearTipGeom = new THREE.ConeGeometry(0.04, 0.1, 4);
                const spearTipMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });
                const spearTip = new THREE.Mesh(spearTipGeom, spearTipMat);
                spearTip.position.set(0.5, 0.2, -0.5);
                spearTip.rotation.z = -Math.PI / 2;
                toolGroup.add(spearTip);
                break;
                
            case 'torch':
                // Torch handle
                const torchHandleGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
                const torchHandleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const torchHandle = new THREE.Mesh(torchHandleGeom, torchHandleMat);
                torchHandle.position.set(0.3, -0.1, -0.4);
                torchHandle.rotation.z = Math.PI / 6;
                toolGroup.add(torchHandle);
                
                // Torch flame
                const flameGeom = new THREE.SphereGeometry(0.06, 8, 8);
                const flameMat = new THREE.MeshStandardMaterial({ 
                    color: 0xff6600,
                    emissive: 0xff6600,
                    emissiveIntensity: 1
                });
                const flame = new THREE.Mesh(flameGeom, flameMat);
                flame.position.set(0.38, 0.05, -0.4);
                toolGroup.add(flame);
                break;
        }
        
        gameState.handModel.add(toolGroup);
    }
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
        -Math.sin(yaw),
        0,
        -Math.cos(yaw)
    );
    
    const right = new THREE.Vector3(
        -Math.sin(yaw - Math.PI / 2),
        0,
        -Math.cos(yaw - Math.PI / 2)
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
    
    // No boundaries - infinite world!
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
    let amount = object.userData.amount;
    
    // Equipped tools give bonus resources
    if (gameState.equippedItem === 'stoneaxe' && object.userData.type === 'tree') {
        amount += 3; // Stone axe gives +3 wood
        showMessage(`Stone Axe bonus! +${amount} ${resource}`);
    } else if (gameState.equippedItem === 'stonepickaxe' && object.userData.type === 'rock') {
        amount += 3; // Stone pickaxe gives +3 rock
        showMessage(`Stone Pickaxe bonus! +${amount} ${resource}`);
    } else if (gameState.equippedItem === 'spear' && object.userData.type === 'animal') {
        amount += 2; // Spear gives +2 meat
        showMessage(`Spear bonus! +${amount} ${resource}`);
    } else if (gameState.equippedItem === 'rock') {
        // Rock can gather everything but slowly
        showMessage(`+${amount} ${resource}`);
    } else {
        showMessage(`+${amount} ${resource}`);
    }

    // Add to inventory
    if (!gameState.inventory[resource]) {
        gameState.inventory[resource] = 0;
    }
    gameState.inventory[resource] += amount;

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
    const container = document.getElementById('inventory-grid');
    if (!container) return;
    
    container.innerHTML = '';

    const consumables = ['rawberries', 'cookedmeat', 'waterbottle'];
    const equipables = ['rock', 'stoneaxe', 'stonepickaxe', 'spear', 'torch'];

    for (const [item, count] of Object.entries(gameState.inventory)) {
        if (count > 0) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            
            const isConsumable = consumables.includes(item);
            const isEquipable = equipables.includes(item);
            const isEquipped = gameState.equippedItem === item;
            
            if (isEquipped) itemDiv.classList.add('equipped');
            if (isEquipable) itemDiv.classList.add('equipable');
            if (isConsumable) itemDiv.classList.add('consumable');
            
            const equippedDisplay = isEquipped ? '⚔' : '';
            
            itemDiv.innerHTML = `
                <div style="font-size: 1.1em; font-weight: bold;">${item} ${equippedDisplay}</div>
                <div class="item-count">${count}</div>
            `;
            
            // Click to equip/unequip
            if (isEquipable) {
                itemDiv.style.cursor = 'pointer';
                itemDiv.addEventListener('click', () => {
                    if (gameState.equippedItem === item) {
                        gameState.equippedItem = null;
                        showMessage(`Unequipped ${item}`);
                    } else {
                        gameState.equippedItem = item;
                        showMessage(`Equipped ${item}`);
                        updateHandModel();
                    }
                    updateInventoryDisplay();
                });
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
        gameState.selectedCraftIndex = 0;
        updateCraftingDisplay();
    }
}

function scrollToSelected(containerId) {
    const container = document.getElementById(containerId);
    const selected = container.querySelector('.recipe-item.selected');
    
    if (selected) {
        selected.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

function toggleBuildMenu() {
    // Check if player has building plan
    if (!gameState.inventory['buildingplan'] || gameState.inventory['buildingplan'] < 1) {
        showMessage('You need a Building Plan to build! (Craft one first)');
        return;
    }
    
    const menu = document.getElementById('build-menu');
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        gameState.selectedBuildIndex = 0;
        updateBuildingDisplay();
    }
}

function updateBuildingDisplay() {
    const container = document.getElementById('building-options');
    container.innerHTML = '';

    const buildingEntries = Object.entries(BUILDINGS);
    
    buildingEntries.forEach(([id, building], index) => {
        const canBuild = Object.entries(building.requires).every(
            ([item, amount]) => (gameState.inventory[item] || 0) >= amount
        );

        const buildDiv = document.createElement('div');
        const isSelected = index === gameState.selectedBuildIndex;
        buildDiv.className = `recipe-item ${canBuild ? '' : 'disabled'} ${isSelected ? 'selected' : ''}`;
        
        const requirements = Object.entries(building.requires)
            .map(([item, amount]) => {
                const has = gameState.inventory[item] || 0;
                const color = has >= amount ? '#4CAF50' : '#f44336';
                return `<span style="color: ${color}">${item}: ${has}/${amount}</span>`;
            })
            .join(', ');

        buildDiv.innerHTML = `
            <div class="recipe-name">${building.name}</div>
            <div class="recipe-requirements">Requires: ${requirements}</div>
            <div class="recipe-requirements" style="margin-top: 5px; font-style: italic;">${building.description}</div>
        `;

        if (canBuild) {
            buildDiv.addEventListener('click', () => {
                gameState.selectedBuildIndex = index;
                enterBuildMode(id, building);
            });
        }

        container.appendChild(buildDiv);
    });
}

function enterBuildMode(buildingType, building) {
    gameState.buildMode = true;
    gameState.buildingType = buildingType;
    
    // Close build menu
    document.getElementById('build-menu').style.display = 'none';
    
    // Create preview
    createBuildingPreview(buildingType);
    
    showMessage(`Build Mode: ${building.name} (Click to place, Q to rotate, B to cancel)`);
}

function createBuildingPreview(type) {
    // Remove old preview if exists
    if (gameState.buildingPreview) {
        scene.remove(gameState.buildingPreview);
    }
    
    const preview = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.5,
        wireframe: false
    });
    
    let geometry;
    
    switch(type) {
        case 'foundation':
            geometry = new THREE.BoxGeometry(4, 0.2, 4);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.1;
            preview.add(mesh);
            break;
            
        case 'wall':
            geometry = new THREE.BoxGeometry(4, 3, 0.2);
            const wallMesh = new THREE.Mesh(geometry, material);
            wallMesh.position.y = 1.5;
            preview.add(wallMesh);
            break;
            
        case 'doorway':
            const doorwayGroup = new THREE.Group();
            // Left wall part
            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 0.2), material);
            leftWall.position.set(-1.25, 1.5, 0);
            doorwayGroup.add(leftWall);
            // Right wall part
            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 0.2), material);
            rightWall.position.set(1.25, 1.5, 0);
            doorwayGroup.add(rightWall);
            // Top part
            const topWall = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.2), material);
            topWall.position.set(0, 2.5, 0);
            doorwayGroup.add(topWall);
            preview.add(doorwayGroup);
            break;
            
        case 'floor':
            geometry = new THREE.BoxGeometry(4, 0.2, 4);
            const floorMesh = new THREE.Mesh(geometry, material);
            floorMesh.position.y = 0.1;
            preview.add(floorMesh);
            break;
            
        case 'stairs':
            for (let i = 0; i < 4; i++) {
                const step = new THREE.Mesh(
                    new THREE.BoxGeometry(4, 0.5, 1),
                    material
                );
                step.position.set(0, i * 0.5 + 0.25, i * 1 - 1.5);
                preview.add(step);
            }
            break;
            
        case 'roof':
            const roofGeom = new THREE.BoxGeometry(4, 0.2, 4.5);
            const roofMesh = new THREE.Mesh(roofGeom, material);
            roofMesh.rotation.x = Math.PI / 4;
            roofMesh.position.y = 2;
            preview.add(roofMesh);
            break;
    }
    
    preview.userData = { isPreview: true, type: type };
    gameState.buildingPreview = preview;
    scene.add(preview);
}

function rotateBuildingPreview() {
    if (gameState.buildingPreview) {
        gameState.buildingPreview.rotation.y += Math.PI / 2;
    }
}

function placeBuilding() {
    if (!gameState.buildingPreview) return;
    
    const building = BUILDINGS[gameState.buildingType];
    
    // Check materials
    const canBuild = Object.entries(building.requires).every(
        ([item, amount]) => (gameState.inventory[item] || 0) >= amount
    );
    
    if (!canBuild) {
        showMessage('Not enough materials!');
        return;
    }
    
    // Remove materials
    for (const [item, amount] of Object.entries(building.requires)) {
        gameState.inventory[item] -= amount;
        
        // Return building plan if specified
        if (item === 'buildingplan' && building.returnsPlan) {
            gameState.inventory[item] += 1;
        }
    }
    
    // Create permanent building
    const permanentBuilding = gameState.buildingPreview.clone();
    permanentBuilding.traverse((child) => {
        if (child.isMesh) {
            child.material = child.material.clone();
            child.material.opacity = 1;
            child.material.transparent = false;
            child.material.color.setHex(0x8B4513); // Wood color
        }
    });
    
    scene.add(permanentBuilding);
    gameState.placedBuildings.push(permanentBuilding);
    
    showMessage(`Built ${building.name}!`);
    updateInventoryDisplay();
    
    // Don't exit build mode, let player keep building
}

function updateCraftingDisplay() {
    const container = document.getElementById('crafting-recipes');
    container.innerHTML = '';

    const recipeEntries = Object.entries(RECIPES);
    
    recipeEntries.forEach(([id, recipe], index) => {
        const canCraft = Object.entries(recipe.requires).every(
            ([item, amount]) => (gameState.inventory[item] || 0) >= amount
        );

        const recipeDiv = document.createElement('div');
        const isSelected = index === gameState.selectedCraftIndex;
        recipeDiv.className = `recipe-item ${canCraft ? '' : 'disabled'} ${isSelected ? 'selected' : ''}`;
        
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
            recipeDiv.addEventListener('click', () => {
                gameState.selectedCraftIndex = index;
                craftItem(id, recipe);
            });
        }

        container.appendChild(recipeDiv);
    });
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
    const sunY = Math.sin(sunAngle) * 60;
    gameState.sunLight.position.set(sunX, Math.abs(sunY), 30);

    // Update lighting based on time with smooth transitions
    const dayIntensity = Math.max(0.1, Math.sin(sunAngle));
    gameState.sunLight.intensity = dayIntensity * 1.2;
    gameState.ambientLight.intensity = dayIntensity * 0.3;
    
    // Update hemisphere light
    if (gameState.hemisphereLight) {
        gameState.hemisphereLight.intensity = dayIntensity * 0.4;
    }

    // Update sky and fog color based on time of day
    if (sunY > 10) {
        // Daytime - bright blue
        const skyColor = new THREE.Color(0x87CEEB);
        scene.background = skyColor;
        scene.fog.color = skyColor;
        gameState.sunLight.color.setHex(0xfff4e6);
    } else if (sunY > 0) {
        // Sunrise/sunset - orange/pink
        const sunsetProgress = sunY / 10;
        const skyColor = new THREE.Color().lerpColors(
            new THREE.Color(0xff7e5f),
            new THREE.Color(0x87CEEB),
            sunsetProgress
        );
        scene.background = skyColor;
        scene.fog.color = skyColor;
        gameState.sunLight.color.setHex(0xffaa77);
    } else {
        // Night - dark blue
        const nightness = Math.abs(sunY) / 60;
        const skyColor = new THREE.Color().lerpColors(
            new THREE.Color(0x1a2332),
            new THREE.Color(0xff7e5f),
            Math.max(0, 1 - nightness)
        );
        scene.background = skyColor;
        scene.fog.color = skyColor;
        gameState.sunLight.color.setHex(0x4466aa);
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
    updateBuildingPreview();
    updateChunks(); // Generate terrain as player moves

    renderer.render(scene, camera);
}

function updateBuildingPreview() {
    if (gameState.buildMode && gameState.buildingPreview) {
        // Position preview in front of player
        const distance = 5;
        const forward = new THREE.Vector3(
            -Math.sin(yaw),
            0,
            -Math.cos(yaw)
        );
        
        gameState.buildingPreview.position.set(
            camera.position.x + forward.x * distance,
            camera.position.y - 2, // At ground level
            camera.position.z + forward.z * distance
        );
        
        // Snap to grid
        gameState.buildingPreview.position.x = Math.round(gameState.buildingPreview.position.x / 2) * 2;
        gameState.buildingPreview.position.z = Math.round(gameState.buildingPreview.position.z / 2) * 2;
        
        // Check if can place (basic collision check)
        let canPlace = true;
        for (const building of gameState.placedBuildings) {
            const distance = gameState.buildingPreview.position.distanceTo(building.position);
            if (distance < 2) {
                canPlace = false;
                break;
            }
        }
        
        // Update preview color
        gameState.buildingPreview.traverse((child) => {
            if (child.isMesh) {
                child.material.color.setHex(canPlace ? 0x00ff00 : 0xff0000);
            }
        });
    }
}

// Initialize when page loads
window.addEventListener('load', init);
