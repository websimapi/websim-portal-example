import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import config from './config.js';
import * as Portal from './portal.js';
import * as Player from './player.js';

let scene, camera, renderer, controls;
let clock = new THREE.Clock();

// --- URL Params ---
const urlParams = new URLSearchParams(window.location.search);
const isComingFromPortal = urlParams.get('portal') === 'true';
const refUrl = urlParams.get('ref');

// --- Player data potentially received from portal ---
const portalUsername = urlParams.get('username');
const portalColor = urlParams.get('color');
// Note: We don't use incoming speed/rotation directly to SET player state,
// but we use username/color if provided.
if (portalUsername) config.player.username = portalUsername;
if (portalColor) config.player.color = `#${portalColor.replace('#','')}`; // Ensure color is hex format

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(50, 80, 30);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // --- Ground ---
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.2 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Player ---
    const player = Player.createPlayer(scene); // Create player using module

    // --- Controls ---
    controls = new PointerLockControls(camera, document.body);
    // Position the controls object (camera's parent) at eye level above the player's base position
    controls.getObject().position.set(
        player.position.x,
        player.position.y + config.player.eyeHeight, // Use eyeHeight from config
        player.position.z
    );
    scene.add(controls.getObject());

    // --- UI Elements & Event Listeners ---
    const infoElement = document.getElementById('info');
    const loadingScreen = document.getElementById('loading-screen');

    const startExperience = () => {
        controls.lock();
        loadingScreen.style.opacity = '0';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500); // Fade out
    };

    infoElement.addEventListener('click', startExperience);
    loadingScreen.addEventListener('click', startExperience);

    controls.addEventListener('lock', () => {
        infoElement.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        if (loadingScreen.style.display !== 'none') {
             infoElement.style.display = 'block';
        }
        Player.resetMovement(); // Reset movement state when controls are unlocked
    });

    document.addEventListener('keydown', Player.onKeyDown); // Use player module handlers
    document.addEventListener('keyup', Player.onKeyUp);     // Use player module handlers
    window.addEventListener('resize', onWindowResize);

    // --- Portals ---
    Portal.createExitPortal(scene);
    if (isComingFromPortal && refUrl) {
        Portal.createStartPortal(scene, refUrl);
    }

    // --- Instant Start Logic ---
    if (isComingFromPortal) {
        loadingScreen.style.display = 'none';
        infoElement.style.display = 'none';
        try {
            // Attempt immediate lock - might require user interaction depending on browser policy
            controls.lock();
        } catch (e) {
            console.warn("Could not automatically lock pointer. User interaction might be needed.");
             infoElement.textContent = "Click to enter the world!";
             infoElement.style.display = 'block';
             // Ensure the startExperience function is available if immediate lock fails
             infoElement.addEventListener('click', startExperience);
             loadingScreen.addEventListener('click', startExperience); // Also allow click on loading screen if it reappears
        }
    } else {
         loadingScreen.style.display = 'flex'; // Ensure loading screen is visible initially if not coming from portal
         infoElement.style.display = 'block'; // Ensure info is visible
    }


    animate();
}

// --- Resize Handler ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Update player position and state
    Player.updatePlayer(delta, controls, camera);

    // Get current player data for portal checks/triggering
    const currentPlayerData = Player.getPlayerData(camera);
    // Pass camera position directly from controls object
    if(controls && controls.getObject()) {
       currentPlayerData.position = controls.getObject().position;
    }

    // Check portal collisions
    Portal.checkPortalCollisions(currentPlayerData, controls, refUrl);

    // Animate portal visual effects
    Portal.animatePortalParticles();

    renderer.render(scene, camera);
}

// --- Start ---
init();