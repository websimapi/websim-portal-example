import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import config from './config.js';

let scene, camera, renderer, controls;
let player, playerVelocity = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let clock = new THREE.Clock();

let exitPortalGroup, exitPortalBox;
let startPortalGroup, startPortalBox;
let exitPortalParticles, startPortalParticles;

const urlParams = new URLSearchParams(window.location.search);
const isComingFromPortal = urlParams.get('portal') === 'true';
const refUrl = urlParams.get('ref');

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 200);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(config.spawnPoint.x, config.spawnPoint.y + 5, config.spawnPoint.z + 10); // Start slightly back and up

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Player representation (simple cube for now)
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: config.player.color });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(config.spawnPoint.x, config.spawnPoint.y, config.spawnPoint.z);
    scene.add(player);
    player.userData.velocity = playerVelocity; // Store velocity on the player object

    // Pointer Lock Controls
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject()); // Add the camera holder to the scene

    // Event listeners for controls
    const infoElement = document.getElementById('info');
    const loadingScreen = document.getElementById('loading-screen');

    infoElement.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        infoElement.style.display = 'none';
        loadingScreen.style.display = 'none'; // Hide loading screen on interaction
    });

    controls.addEventListener('unlock', () => {
        infoElement.style.display = 'block';
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Create Portals
    createExitPortal();
    if (isComingFromPortal && refUrl) {
        createStartPortal();
    }

    // Hide loading screen immediately if coming from portal
    if (isComingFromPortal) {
        loadingScreen.style.display = 'none';
        // Optional: Automatically lock controls if desired for seamless entry
        // controls.lock();
    }

    // Start animation loop
    animate();
}

function createPortalVisuals(color, position, rotation) {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(position.x, position.y, position.z);
    portalGroup.rotation.x = rotation?.x || 0;
    portalGroup.rotation.y = rotation?.y || 0;

    // Torus Ring
    const portalGeometry = new THREE.TorusGeometry(10, 1.5, 16, 100);
    const portalMaterial = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        transparent: true,
        opacity: 0.8,
        shininess: 100
    });
    const portalRing = new THREE.Mesh(portalGeometry, portalMaterial);
    portalGroup.add(portalRing);

    // Inner Surface (slightly transparent)
    const portalInnerGeometry = new THREE.CircleGeometry(8.5, 32); // Slightly smaller radius
    const portalInnerMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const portalInner = new THREE.Mesh(portalInnerGeometry, portalInnerMaterial);
    portalGroup.add(portalInner);

    // Particle System
    const particleCount = 800;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount * 3; i += 3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + (Math.random() - 0.5) * 3; // Around the torus
        positions[i] = Math.cos(angle) * radius;
        positions[i + 1] = Math.sin(angle) * radius;
        positions[i + 2] = (Math.random() - 0.5) * 3; // Slight depth variation

        colors[i] = baseColor.r * (0.8 + Math.random() * 0.2);
        colors[i + 1] = baseColor.g * (0.8 + Math.random() * 0.2);
        colors[i + 2] = baseColor.b * (0.8 + Math.random() * 0.2);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending, // Make particles glow more
        depthWrite: false // Prevent particles obscuring portal surface
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    portalGroup.add(particleSystem);
    portalGroup.userData.particles = particles; // Store for animation

    scene.add(portalGroup);
    const portalBox = new THREE.Box3().setFromObject(portalRing); // Use ring for collision bounds

    return { group: portalGroup, box: portalBox };
}

function createExitPortal() {
    const result = createPortalVisuals(
        config.exitPortalColor,
        config.exitPortalPosition,
        { x: 0.2, y: 0.5 } // Example rotation
    );
    exitPortalGroup = result.group;
    exitPortalBox = result.box;
    exitPortalParticles = exitPortalGroup.userData.particles;

    // Add Label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 64;
    context.fillStyle = `rgba(${new THREE.Color(config.exitPortalColor).toArray().map(c => c * 255).join(',')}, 1)`;
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('VIBEVERSE PORTAL', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(20, 4); // Adjust size as needed
    const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false // Prevent label z-fighting with portal
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 15; // Position above the portal ring
    exitPortalGroup.add(label);
}

function createStartPortal() {
    // Position the start portal slightly behind the spawn point
    const startPos = {
        x: config.spawnPoint.x,
        y: config.spawnPoint.y,
        z: config.spawnPoint.z - 15 // Spawn player in front, portal behind
    };
    const result = createPortalVisuals(
        config.startPortalColor,
        startPos,
        { x: 0, y: 0 } // Face forward
    );
    startPortalGroup = result.group;
    startPortalBox = result.box;
    startPortalParticles = startPortalGroup.userData.particles;

     // Add Label (optional, points back to ref)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 64;
    context.fillStyle = `rgba(${new THREE.Color(config.startPortalColor).toArray().map(c => c * 255).join(',')}, 1)`;
    context.font = 'bold 28px Arial'; // Slightly smaller
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const domain = refUrl ? new URL(refUrl.startsWith('http') ? refUrl : 'https://' + refUrl).hostname : 'Previous World';
    context.fillText(`Return to ${domain}`, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(20, 4); // Adjust size
    const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 15; // Position above the portal ring
    startPortalGroup.add(label);
}

function animatePortalParticles(particles) {
    if (!particles) return;
    const positions = particles.attributes.position.array;
    const time = Date.now() * 0.001;
    for (let i = 0; i < positions.length; i += 3) {
        // Simple sinusoidal oscillation on Y axis
        positions[i + 1] += Math.sin(time + i * 0.1) * 0.02;
        // Add some subtle radial movement (optional)
        const angle = Math.atan2(positions[i+1], positions[i]);
        const radius = Math.sqrt(positions[i]*positions[i] + positions[i+1]*positions[i+1]);
        positions[i] = Math.cos(angle) * (radius + Math.sin(time + i * 0.05) * 0.01);
        positions[i+1] = Math.sin(angle) * (radius + Math.sin(time + i * 0.05) * 0.01);

    }
    particles.attributes.position.needsUpdate = true;
}


function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updatePlayer(delta) {
    if (!controls.isLocked) {
        playerVelocity.set(0, 0, 0); // Stop movement if controls are locked
        return;
    }

    // Reset velocity influencers
    playerVelocity.x -= playerVelocity.x * 10.0 * delta; // Damping
    playerVelocity.z -= playerVelocity.z * 10.0 * delta;

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const sideways = new THREE.Vector3();

    camera.getWorldDirection(forward); // Get camera direction
    sideways.crossVectors(camera.up, forward).normalize(); // Get sideways vector

    if (moveForward) direction.add(forward);
    if (moveBackward) direction.sub(forward);
    if (moveLeft) direction.add(sideways);
    if (moveRight) direction.sub(sideways);

    direction.normalize(); // Ensure consistent speed regardless of direction combination

    // Apply movement based on direction and speed
    if (moveForward || moveBackward) playerVelocity.z -= direction.z * config.player.speed * 10.0 * delta;
    if (moveLeft || moveRight) playerVelocity.x -= direction.x * config.player.speed * 10.0 * delta;


    // Apply velocity using PointerLockControls method
    controls.moveRight(-playerVelocity.x * delta);
    controls.moveForward(-playerVelocity.z * delta);

    // Update player mesh position to match camera holder position
    player.position.copy(controls.getObject().position);
    player.position.y -= 1; // Adjust so cube feet are near the ground level of camera
     // Ensure player stays on the ground (simple approach)
    if (player.position.y < config.spawnPoint.y) { // Use spawn Y as ground level reference
         player.position.y = config.spawnPoint.y;
         playerVelocity.y = 0; // Stop downward velocity
         controls.getObject().position.y = config.spawnPoint.y + 1; // Reset camera holder y
    }
}


function checkPortalCollisions() {
    if (!player) return;

    const playerBox = new THREE.Box3().setFromObject(player);
    const playerCenter = playerBox.getCenter(new THREE.Vector3());

    // Check Exit Portal
    if (exitPortalBox) {
        const exitPortalCenter = exitPortalBox.getCenter(new THREE.Vector3());
        const distanceToExit = playerCenter.distanceTo(exitPortalCenter);

        if (distanceToExit < config.portalInteractionDistance) {
             // Could add visual feedback here (e.g., portal intensifies)
             if (playerBox.intersectsBox(exitPortalBox)) {
                 triggerPortal(config.portalTargetUrl, false); // False means it's not the start portal
             }
        }
    }


    // Check Start Portal (if it exists)
    if (startPortalBox && refUrl) {
         const startPortalCenter = startPortalBox.getCenter(new THREE.Vector3());
         const distanceToStart = playerCenter.distanceTo(startPortalCenter);

         if (distanceToStart < config.portalInteractionDistance) {
             if (playerBox.intersectsBox(startPortalBox)) {
                 triggerPortal(refUrl, true); // True means it's the start/return portal
             }
         }
    }
}

let isRedirecting = false; // Prevent multiple redirects

function triggerPortal(targetUrl, isReturnPortal) {
    if (isRedirecting) return;
    isRedirecting = true;

    console.log(`Entering portal to: ${targetUrl}`);

    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    // Always add portal=true for the target
    newParams.append('portal', 'true');

    // Pass along relevant player data
    newParams.append('username', config.player.username);
    newParams.append('color', config.player.color);
    // Calculate current speed (magnitude of velocity)
    const speed = player ? player.userData.velocity.length() : config.player.speed; // Use stored velocity or default
    newParams.append('speed', speed.toFixed(2));

    // Include velocity components if needed
    if (player && player.userData.velocity) {
        newParams.append('speed_x', player.userData.velocity.x.toFixed(2));
        // Y speed might not be relevant in many FPS setups, but include if needed
        // newParams.append('speed_y', player.userData.velocity.y.toFixed(2));
        newParams.append('speed_z', player.userData.velocity.z.toFixed(2));
    }

    // Add rotation (from camera) - Send Euler Y rotation (yaw)
     if(controls) {
         const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
         newParams.append('rotation_y', euler.y.toFixed(4)); // Yaw
         // Optionally add pitch (euler.x) and roll (euler.z) if needed
         // newParams.append('rotation_x', euler.x.toFixed(4));
         // newParams.append('rotation_z', euler.z.toFixed(4));
     }


    // If it's the EXIT portal, add the current game's URL as 'ref' for the *next* game
    if (!isReturnPortal) {
        newParams.append('ref', window.location.origin + window.location.pathname);
    }
    // If it's the START (return) portal, we *don't* overwrite the 'ref' param.
    // We need to ensure any *other* params from the original entry are passed back.
    else {
         for (const [key, value] of currentParams) {
             // Don't re-add params we've already set explicitly
             if (!newParams.has(key) && key !== 'ref') { // Keep original ref
                  newParams.append(key, value);
             }
         }
    }


    let finalUrl = targetUrl;
    // Ensure the base targetUrl has protocol
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }

    const paramString = newParams.toString();
    finalUrl += (paramString ? (finalUrl.includes('?') ? '&' : '?') + paramString : '');


    console.log("Redirecting to:", finalUrl);
    window.location.href = finalUrl;

    // Optional: Add a small delay or visual effect before redirect
    // setTimeout(() => { window.location.href = finalUrl; }, 200);
}


function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    updatePlayer(delta);
    checkPortalCollisions();

    // Animate portal particles
    animatePortalParticles(exitPortalParticles);
    animatePortalParticles(startPortalParticles);


    renderer.render(scene, camera);
}

init();

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import config from './config.js';

let scene, camera, renderer, controls;
let player, playerVelocity = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let clock = new THREE.Clock();

let exitPortalGroup, exitPortalBox, exitPortalInnerMesh; // Add exitPortalInnerMesh
let startPortalGroup, startPortalBox, startPortalInnerMesh; // Add startPortalInnerMesh
let exitPortalParticles, startPortalParticles;

const urlParams = new URLSearchParams(window.location.search);
const isComingFromPortal = urlParams.get('portal') === 'true';
const refUrl = urlParams.get('ref');

// Player data potentially received from portal
const portalUsername = urlParams.get('username');
const portalColor = urlParams.get('color');
const portalSpeed = parseFloat(urlParams.get('speed'));

if (portalUsername) config.player.username = portalUsername;
if (portalColor) config.player.color = portalColor;
if (!isNaN(portalSpeed)) config.player.speed = portalSpeed;
// TODO: Potentially use speed_x, speed_y, speed_z, rotation etc. for spawning


function init() {
    // --- Basic Scene Setup ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 150); // Reduced fog distance

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Start camera at player height + eye level offset
    camera.position.set(config.spawnPoint.x, config.spawnPoint.y + 1.6, config.spawnPoint.z + 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(50, 80, 30);
    directionalLight.castShadow = true; // Optional: add shadows
    scene.add(directionalLight);

    // --- Ground ---
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.2 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true; // Optional
    scene.add(ground);

    // --- Player Representation ---
    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8); // Capsule shape (radius, height)
    playerGeometry.translate(0, 0.5, 0); // Move pivot to base
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: config.player.color,
        roughness: 0.5,
        metalness: 0.3
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(config.spawnPoint.x, config.spawnPoint.y, config.spawnPoint.z);
    player.castShadow = true; // Optional
    scene.add(player);
    player.userData.velocity = playerVelocity; // Store velocity


    // --- Pointer Lock Controls ---
    controls = new PointerLockControls(camera, document.body);
    // Move the controls object (camera holder) to the player's head position
    controls.getObject().position.set(player.position.x, player.position.y + 1.6, player.position.z);
    scene.add(controls.getObject());

    const infoElement = document.getElementById('info');
    const loadingScreen = document.getElementById('loading-screen');

    // Start game on click
    const startExperience = () => {
        controls.lock();
        loadingScreen.style.opacity = '0'; // Fade out
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500); // Remove after fade
    };

    infoElement.addEventListener('click', startExperience);
    loadingScreen.addEventListener('click', startExperience); // Allow starting by clicking loading screen


    controls.addEventListener('lock', () => {
        infoElement.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        // Don't show info overlay again unless loading screen was also visible
        if (loadingScreen.style.display !== 'none') {
             infoElement.style.display = 'block';
        }
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);

    // --- Create Portals ---
    createExitPortal();
    if (isComingFromPortal && refUrl) {
        createStartPortal();
    }

    // --- Handle Instant Load for Portal Entry ---
    if (isComingFromPortal) {
        // Hide loading/info immediately and attempt to lock controls
        loadingScreen.style.display = 'none';
        infoElement.style.display = 'none';
        // Note: Browsers often require user interaction to lock pointer.
        // This might not work reliably on first load without a prior click.
        // Consider showing a minimal "Click to continue" if lock fails.
        try {
            controls.lock();
        } catch (e) {
            console.warn("Could not automatically lock pointer. User interaction might be needed.");
             // Fallback: Show a simple message if auto-lock fails
             infoElement.textContent = "Click to enter the world!";
             infoElement.style.display = 'block';
        }
    }

    animate();
}

// --- Portal Creation Logic ---
function createPortalVisuals(color, position, rotation) {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(position.x, position.y, position.z);
    // Apply rotation if provided
    if (rotation) {
        portalGroup.rotation.x = rotation.x || 0;
        portalGroup.rotation.y = rotation.y || 0;
        portalGroup.rotation.z = rotation.z || 0;
    }

    const portalRadius = 5; // Main radius
    const tubeRadius = 0.75;

    // Torus Ring
    const portalGeometry = new THREE.TorusGeometry(portalRadius, tubeRadius, 16, 100);
    const portalMaterial = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.7,
        shininess: 150
    });
    const portalRing = new THREE.Mesh(portalGeometry, portalMaterial);
    portalGroup.add(portalRing);

    // Inner Surface (slightly transparent, potentially animated shader later)
    const portalInnerGeometry = new THREE.CircleGeometry(portalRadius - tubeRadius, 32); // Fit inside torus
    const portalInnerMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3, // More subtle inner glow
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, // Additive blend for glow effect
        depthWrite: false // Don't obscure particles behind it
    });
    const portalInner = new THREE.Mesh(portalInnerGeometry, portalInnerMaterial);
    portalGroup.add(portalInner);

    // Particle System
    const particleCount = 1000; // More particles
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const particleBaseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount * 3; i += 3) {
        const angle = Math.random() * Math.PI * 2;
        // Distribute particles in and around the torus ring volume
        const radius = portalRadius + (Math.random() - 0.5) * tubeRadius * 2.5; // Spread wider
        positions[i] = Math.cos(angle) * radius; // X in local XY plane
        positions[i + 1] = Math.sin(angle) * radius; // Y in local XY plane
        positions[i + 2] = (Math.random() - 0.5) * tubeRadius * 1.5; // Z depth variation

        // Vary color slightly
        colors[i] = particleBaseColor.r * (0.7 + Math.random() * 0.6); // Wider range
        colors[i + 1] = particleBaseColor.g * (0.7 + Math.random() * 0.6);
        colors[i + 2] = particleBaseColor.b * (0.7 + Math.random() * 0.6);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.08, // Smaller particles
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    portalGroup.add(particleSystem);
    portalGroup.userData.particles = particles; // Store for animation

    scene.add(portalGroup);
    // Use the inner mesh for tighter collision detection
    const portalBox = new THREE.Box3().setFromObject(portalInner);

    return { group: portalGroup, box: portalBox, innerMesh: portalInner }; // Return innerMesh too
}

function createExitPortal() {
    const result = createPortalVisuals(
        config.exitPortalColor,
        config.exitPortalPosition,
        { x: 0.1, y: Math.PI / 4 } // Tilted slightly
    );
    exitPortalGroup = result.group;
    exitPortalBox = result.box;
    exitPortalInnerMesh = result.innerMesh;
    exitPortalParticles = exitPortalGroup.userData.particles;

    // Add Label
    createPortalLabel(exitPortalGroup, 'VIBEVERSE PORTAL', config.exitPortalColor, 10, 2); // Width, Height
}

function createStartPortal() {
    // Position behind spawn, facing player
    const offset = 10;
    const startPos = {
        x: config.spawnPoint.x,
        y: config.exitPortalPosition.y, // Same height as exit portal for consistency
        z: config.spawnPoint.z + offset
    };
    const result = createPortalVisuals(
        config.startPortalColor,
        startPos,
        { x: 0, y: Math.PI } // Rotate 180 deg on Y to face player spawn
    );
    startPortalGroup = result.group;
    startPortalBox = result.box;
    startPortalInnerMesh = result.innerMesh;
    startPortalParticles = startPortalGroup.userData.particles;

    // Add Label pointing back
    const domain = refUrl ? getDomain(refUrl) : 'Previous World';
    createPortalLabel(startPortalGroup, `Return to ${domain}`, config.startPortalColor, 15, 2);
}

function createPortalLabel(parentGroup, text, color, width, height) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const font_size = 32;
    context.font = `bold ${font_size}px Arial`;

    // Calculate text width to make canvas size dynamic (optional but good)
    const textWidth = context.measureText(text).width;
    canvas.width = THREE.MathUtils.ceilPowerOfTwo(textWidth + 40); // Add padding
    canvas.height = THREE.MathUtils.ceilPowerOfTwo(font_size + 20); // Add padding

    // Re-apply font after resize
    context.font = `bold ${font_size}px Arial`;
    context.fillStyle = `rgba(${new THREE.Color(color).toArray().map(c => c * 255).join(',')}, 1)`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const labelGeometry = new THREE.PlaneGeometry(width, height);
    const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    // Position above the portal ring, adjust Y offset based on portal size
    label.position.y = 6.5; // portalRadius + tubeRadius + buffer
    label.rotation.y = Math.PI; // If parent group is rotated 180 deg, counter-rotate label text
    parentGroup.add(label);
}

function getDomain(url) {
    try {
        let hostname = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
        // Optional: remove www.
        hostname = hostname.replace(/^www\./, '');
        return hostname;
    } catch (e) {
        console.error("Invalid ref URL for domain extraction:", url);
        return "???"; // Fallback
    }
}


function animatePortalParticles(particles) {
    if (!particles) return;
    const positions = particles.attributes.position.array;
    const time = Date.now() * 0.0005; // Slower animation

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i+1];
        const z = positions[i+2];

        // Swirl effect: Rotate in the XY plane based on time and original angle
        const angle = Math.atan2(y, x);
        const radius = Math.sqrt(x*x + y*y);
        const swirlFactor = 0.3; // Speed of swirl
        const newAngle = angle + swirlFactor * time + radius * 0.1; // Add radius influence for variation

        positions[i] = Math.cos(newAngle) * radius;
        positions[i + 1] = Math.sin(newAngle) * radius;

        // Add subtle Z oscillation
        positions[i + 2] = z + Math.sin(time * 5 + angle * 3) * 0.1;
    }
    particles.attributes.position.needsUpdate = true;
}


// --- Input Handling ---
function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Player Update ---
function updatePlayer(delta) {
    if (!controls.isLocked) {
        playerVelocity.multiplyScalar(0); // Stop movement immediately
        return;
    }

    const speed = config.player.speed * 50; // Effective speed multiplier
    const damping = 10.0;

    // Apply damping (friction)
    playerVelocity.x -= playerVelocity.x * damping * delta;
    playerVelocity.z -= playerVelocity.z * damping * delta;
    // We don't handle Y velocity (jumping/gravity) here, but you could add it.
    // playerVelocity.y -= 9.8 * 10.0 * delta; // Example gravity

    const direction = new THREE.Vector3();
    // Get forward/right vectors relative to camera orientation (XZ plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Project onto XZ plane
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize(); // Right vector in XZ plane

    // Calculate movement direction based on input
    if (moveForward) direction.add(forward);
    if (moveBackward) direction.sub(forward);
    if (moveLeft) direction.sub(right); // Strafe left
    if (moveRight) direction.add(right); // Strafe right

    direction.normalize(); // Prevent faster diagonal movement

    // Apply acceleration
    playerVelocity.x += direction.x * speed * delta;
    playerVelocity.z += direction.z * speed * delta;


    // Move the controls object (camera holder)
    controls.moveRight(playerVelocity.x * delta);
    controls.moveForward(playerVelocity.z * delta); // Note: moveForward is opposite of velocity.z

    // Update player mesh position to follow controls object, adjusting for capsule base
    player.position.copy(controls.getObject().position);
    player.position.y = config.spawnPoint.y; // Keep player firmly on ground level for now

     // Update camera holder y-position based on player's intended ground level + eye height
    controls.getObject().position.y = player.position.y + 1.6; // Maintain eye height

    // Simple ground collision (prevent falling through floor)
    // if (controls.getObject().position.y < config.spawnPoint.y + 1.6) {
    //     playerVelocity.y = 0;
    //     controls.getObject().position.y = config.spawnPoint.y + 1.6;
    // }
}

// --- Portal Collision & Redirection ---
function checkPortalCollisions() {
    if (!player || isRedirecting || !controls.isLocked) return;

    // Use the controls object (camera position) for proximity checks
    const playerPosition = controls.getObject().position;

    // Check Exit Portal
    if (exitPortalGroup) {
        const portalCenter = new THREE.Vector3();
        exitPortalBox.getCenter(portalCenter); // Get world center of the box
        const distanceToExit = playerPosition.distanceTo(portalCenter);

        if (distanceToExit < config.portalInteractionDistance) {
             // Check tighter collision with the inner mesh bounding box
             if (distanceToExit < config.portalCollisionThreshold) {
                  // Use Raycasting from player towards portal center for more robust intersection
                  const raycaster = new THREE.Raycaster(playerPosition, portalCenter.clone().sub(playerPosition).normalize());
                  const intersects = raycaster.intersectObject(exitPortalInnerMesh); // Check against inner mesh

                  if (intersects.length > 0 && intersects[0].distance < 1.5) { // Check if intersection is very close
                      triggerPortal(config.portalTargetUrl, false);
                      return; // Exit early if triggered
                  }
             }
        }
    }


    // Check Start Portal (if it exists)
    if (startPortalGroup && refUrl) {
        const portalCenter = new THREE.Vector3();
        startPortalBox.getCenter(portalCenter);
        const distanceToStart = playerPosition.distanceTo(portalCenter);

         if (distanceToStart < config.portalInteractionDistance) {
             if (distanceToStart < config.portalCollisionThreshold) {
                  const raycaster = new THREE.Raycaster(playerPosition, portalCenter.clone().sub(playerPosition).normalize());
                  const intersects = raycaster.intersectObject(startPortalInnerMesh);

                  if (intersects.length > 0 && intersects[0].distance < 1.5) {
                      triggerPortal(refUrl, true);
                  }
             }
         }
    }
}


let isRedirecting = false;

function triggerPortal(targetUrl, isReturnPortal) {
    if (isRedirecting) return;
    isRedirecting = true;
    controls.unlock(); // Unlock controls before redirecting

    console.log(`Entering portal to: ${targetUrl}`);

    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    // 1. Always add portal=true
    newParams.append('portal', 'true');

    // 2. Add player data
    newParams.append('username', config.player.username);
    newParams.append('color', config.player.color);

    // Calculate speed magnitude (use current velocity if available, else default config speed)
    const currentSpeed = playerVelocity.length();
    newParams.append('speed', currentSpeed > 0.1 ? currentSpeed.toFixed(2) : config.player.speed.toFixed(2)); // Avoid sending near-zero speeds

    // Add velocity components
    newParams.append('speed_x', playerVelocity.x.toFixed(2));
    // newParams.append('speed_y', playerVelocity.y.toFixed(2)); // Only if using vertical movement
    newParams.append('speed_z', playerVelocity.z.toFixed(2));

    // Add rotation (camera orientation)
    if (controls) {
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        newParams.append('rotation_y', euler.y.toFixed(4)); // Yaw (most important)
        // newParams.append('rotation_x', euler.x.toFixed(4)); // Pitch
        // newParams.append('rotation_z', euler.z.toFixed(4)); // Roll (usually less useful)
    }

    // 3. Handle 'ref' parameter logic
    if (isReturnPortal) {
        // Returning: Pass through *original* params, excluding 'portal' itself if it exists
         for (const [key, value] of currentParams) {
             if (key !== 'portal' && !newParams.has(key)) { // Don't overwrite already set params
                 newParams.append(key, value);
             }
         }
        // Ensure the original 'ref' is still present (it should be if logic is correct)
        if (!newParams.has('ref') && currentParams.has('ref')) {
             newParams.append('ref', currentParams.get('ref'));
        }
    } else {
        // Exiting: Set 'ref' to this game's URL
        newParams.append('ref', window.location.origin + window.location.pathname);
        // Pass through any *other* params this game might have received (excluding portal/ref)
        for (const [key, value] of currentParams) {
             if (key !== 'portal' && key !== 'ref' && !newParams.has(key)) {
                 newParams.append(key, value);
             }
         }
    }

    // 4. Construct final URL
    let finalUrl = targetUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl; // Default to https
    }

    const paramString = newParams.toString();

    // Append params carefully, handling existing query strings in targetUrl
    if (paramString) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + paramString;
    }

    console.log("Redirecting to:", finalUrl);

    // Optional: Visual feedback before redirect
    document.body.style.transition = 'opacity 0.3s ease-out';
    document.body.style.opacity = '0';

    setTimeout(() => {
        window.location.href = finalUrl;
    }, 300); // Wait for fade effect
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    updatePlayer(delta);
    checkPortalCollisions(); // Check after player moves

    // Animate portal particles
    animatePortalParticles(exitPortalParticles);
    animatePortalParticles(startPortalParticles);

    renderer.render(scene, camera);
}

// --- Start ---
init();


