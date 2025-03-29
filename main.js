import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import config from './config.js';

let scene, camera, renderer, controls;
let player, playerVelocity = new THREE.Vector3(); // Keep velocity for potential physics/smoothness later
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let clock = new THREE.Clock();

let exitPortalGroup, exitPortalBox, exitPortalInnerMesh;
let startPortalGroup, startPortalBox, startPortalInnerMesh;
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
// Note: We don't currently use the incoming speed parameter directly for control, but keep config updated.
// if (!isNaN(portalSpeed)) config.player.speed = portalSpeed;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Camera position will be set relative to player spawn by controls

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(50, 80, 30);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.2 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8); // Radius 0.5, Height 1 (total height 1 + 2*0.5 = 2)
    playerGeometry.translate(0, 0.5, 0); // Move geometry up so base is at origin Y=0
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: config.player.color,
        roughness: 0.5,
        metalness: 0.3
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(config.spawnPoint.x, config.spawnPoint.y, config.spawnPoint.z); // Place base at spawn point
    player.castShadow = true;
    scene.add(player);
    // player.userData.velocity = playerVelocity; // Not currently used directly for movement

    controls = new PointerLockControls(camera, document.body);
    // Position the controls object (camera's parent) at eye level above the player's base position
    controls.getObject().position.set(
        player.position.x,
        player.position.y + config.player.eyeHeight, // Use eyeHeight from config
        player.position.z
    );
    scene.add(controls.getObject());

    const infoElement = document.getElementById('info');
    const loadingScreen = document.getElementById('loading-screen');

    const startExperience = () => {
        controls.lock();
        loadingScreen.style.opacity = '0';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
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
        // Reset movement keys on unlock
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);

    createExitPortal();
    if (isComingFromPortal && refUrl) {
        createStartPortal();
    }

    if (isComingFromPortal) {
        // Skip loading screen and attempt to lock pointer immediately
        loadingScreen.style.display = 'none';
        infoElement.style.display = 'none';
        try {
            controls.lock();
        } catch (e) {
            console.warn("Could not automatically lock pointer. User interaction might be needed.");
             infoElement.textContent = "Click to enter the world!";
             infoElement.style.display = 'block';
             // Ensure the startExperience function is available if immediate lock fails
             infoElement.addEventListener('click', startExperience);
             loadingScreen.addEventListener('click', startExperience);
        }
    }

    animate();
}

// ... (createPortalVisuals, createExitPortal, createStartPortal, createPortalLabel, getDomain remain the same) ...
function createPortalVisuals(color, position, rotation) {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(position.x, position.y, position.z);
    if (rotation) {
        portalGroup.rotation.x = rotation.x || 0;
        portalGroup.rotation.y = rotation.y || 0;
        portalGroup.rotation.z = rotation.z || 0;
    }

    const portalRadius = 5;
    const tubeRadius = 0.75;

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

    const portalInnerGeometry = new THREE.CircleGeometry(portalRadius - tubeRadius, 32);
    const portalInnerMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const portalInner = new THREE.Mesh(portalInnerGeometry, portalInnerMaterial);
    portalGroup.add(portalInner);

    const particleCount = 1000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const particleBaseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount * 3; i += 3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = portalRadius + (Math.random() - 0.5) * tubeRadius * 2.5;
        positions[i] = Math.cos(angle) * radius;
        positions[i + 1] = Math.sin(angle) * radius;
        positions[i + 2] = (Math.random() - 0.5) * tubeRadius * 1.5;

        colors[i] = particleBaseColor.r * (0.7 + Math.random() * 0.6);
        colors[i + 1] = particleBaseColor.g * (0.7 + Math.random() * 0.6);
        colors[i + 2] = particleBaseColor.b * (0.7 + Math.random() * 0.6);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    portalGroup.add(particleSystem);
    portalGroup.userData.particles = particles;

    scene.add(portalGroup);
    // Use the inner mesh for tighter collision detection
    const portalBox = new THREE.Box3().setFromObject(portalInner);

    // Adjust box slightly to better encompass the inner circle area for collision
    portalBox.expandByScalar(0.5); // Slightly expand the collision box

    return { group: portalGroup, box: portalBox, innerMesh: portalInner };
}

function createExitPortal() {
    const result = createPortalVisuals(
        config.exitPortalColor,
        config.exitPortalPosition,
        { x: 0.1, y: Math.PI / 4 } // Keep existing rotation
    );
    exitPortalGroup = result.group;
    exitPortalBox = result.box;
    exitPortalInnerMesh = result.innerMesh;
    exitPortalParticles = exitPortalGroup.userData.particles;

    createPortalLabel(exitPortalGroup, 'VIBEVERSE PORTAL', config.exitPortalColor, 10, 2);
}

function createStartPortal() {
    const offset = 10; // Keep offset logic
    const startPos = {
        x: config.spawnPoint.x,
        y: config.exitPortalPosition.y, // Align Y with exit portal's height for visual consistency
        z: config.spawnPoint.z + offset
    };
    const result = createPortalVisuals(
        config.startPortalColor,
        startPos,
        { x: 0, y: Math.PI } // Rotate to face player spawn
    );
    startPortalGroup = result.group;
    startPortalBox = result.box;
    startPortalInnerMesh = result.innerMesh;
    startPortalParticles = startPortalGroup.userData.particles;

    const domain = refUrl ? getDomain(refUrl) : 'Previous World';
    createPortalLabel(startPortalGroup, `Return to ${domain}`, config.startPortalColor, 15, 2);
}

function createPortalLabel(parentGroup, text, color, width, height) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const font_size = 32;
    context.font = `bold ${font_size}px Arial`;

    const textWidth = context.measureText(text).width;
    canvas.width = THREE.MathUtils.ceilPowerOfTwo(textWidth + 40);
    canvas.height = THREE.MathUtils.ceilPowerOfTwo(font_size + 20);

    context.font = `bold ${font_size}px Arial`;
    // Use configured color for text fill
    context.fillStyle = new THREE.Color(color).getStyle(); // Use THREE.Color style for canvas
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
        depthWrite: false // Don't obscure portal visuals
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 6.5; // Position above the portal ring
    // label.rotation.y = Math.PI; // Should face away from portal center - let parent group handle main rotation
    parentGroup.add(label);
}

function getDomain(url) {
    try {
        let hostname = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
        hostname = hostname.replace(/^www\./, '');
        return hostname;
    } catch (e) {
        console.error("Invalid ref URL for domain extraction:", url);
        return "???";
    }
}


function animatePortalParticles(particles) {
    if (!particles) return;
    const positions = particles.attributes.position.array;
    const time = Date.now() * 0.0005;

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i+1];
        const z = positions[i+2]; // Original Z offset

        // Keep existing swirl and Z oscillation logic
        const angle = Math.atan2(y, x);
        const radius = Math.sqrt(x*x + y*y);
        const swirlFactor = 0.3;
        const newAngle = angle + swirlFactor * time + radius * 0.1;

        positions[i] = Math.cos(newAngle) * radius; // Update X based on swirl
        positions[i + 1] = Math.sin(newAngle) * radius; // Update Y based on swirl

        // Modulate Z based on time and angle for a wave effect
        positions[i + 2] = z + Math.sin(time * 5 + angle * 3) * 0.1;
    }
    particles.attributes.position.needsUpdate = true;
}

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

function updatePlayer(delta) {
    if (!controls.isLocked) return; // Only move when pointer is locked

    const speed = config.player.speed; // Use speed directly from config

    // Calculate forward and right vectors based on camera orientation (projected onto XZ plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize(); // camera.up is typically (0, 1, 0)

    // Determine net movement direction based on key states
    const direction = new THREE.Vector3();
    let isMoving = false;
    if (moveForward) { direction.add(forward); isMoving = true; }
    if (moveBackward) { direction.sub(forward); isMoving = true; }
    if (moveLeft) { direction.sub(right); isMoving = true; }
    if (moveRight) { direction.add(right); isMoving = true; }

    if (isMoving) {
        direction.normalize(); // Ensure consistent speed for diagonal movement

        // Calculate displacement vector for this frame
        const displacement = direction.multiplyScalar(speed * delta);

        // Move the controls object (camera's parent)
        // controls.moveForward/Right work relative to the camera's local axes
        controls.getObject().position.add(displacement);
    }

    // Keep camera (controls object) at a fixed height above the spawn Y level
    // This prevents flying/falling without collision detection
    controls.getObject().position.y = config.spawnPoint.y + config.player.eyeHeight;

    // Update the player mesh model position to follow the camera horizontally,
    // and position its base at the spawn Y level.
    player.position.x = controls.getObject().position.x;
    player.position.z = controls.getObject().position.z;
    player.position.y = config.spawnPoint.y; // Keep player mesh base on the "ground"

    // Update player mesh rotation to face the direction the camera is looking horizontally
    player.rotation.y = Math.atan2(forward.x, forward.z);
}


function checkPortalCollisions() {
    if (!player || isRedirecting || !controls.isLocked) return;

    // Use the camera's position (controls object) for collision checks, as it's the viewpoint
    const playerPosition = controls.getObject().position;

    // Helper function for portal check logic
    const checkPortal = (portalGroup, portalInnerMesh, targetUrl, isReturn) => {
        if (!portalGroup) return false; // Portal doesn't exist

        // Use the inner mesh for collision check - more accurate than group bounding box
        // Create a temporary bounding box for the player's current position
        // A small box around the camera position is sufficient
        const playerCollider = new THREE.Box3(
            playerPosition.clone().subScalar(0.1), // Small box around camera feet
            playerPosition.clone().addScalar(0.1)
        );
        playerCollider.min.y = playerPosition.y - config.player.eyeHeight; // Box base at player feet level
        playerCollider.max.y = playerPosition.y; // Box top near camera feet


        // Create a world-space bounding box for the portal inner mesh
        const portalWorldBox = new THREE.Box3().setFromObject(portalInnerMesh, true); // Use precise bounding box


        // Check for intersection between player collider and portal inner mesh box
        if (playerCollider.intersectsBox(portalWorldBox)) {
            // Optional: Finer check using distance to portal center
            const portalCenter = new THREE.Vector3();
            portalWorldBox.getCenter(portalCenter);
            const distanceToPortal = playerPosition.distanceTo(portalCenter);

            if (distanceToPortal < (config.portalInteractionDistance / 2)) { // Use a threshold slightly larger than portal radius
                triggerPortal(targetUrl, isReturn);
                return true; // Collision detected and triggered
            }
        }
        return false; // No collision
    };

    // Check exit portal
    if (checkPortal(exitPortalGroup, exitPortalInnerMesh, config.portalTargetUrl, false)) {
        return; // Stop checking if exit portal was triggered
    }

    // Check start portal (if it exists and has a refUrl)
    if (refUrl && checkPortal(startPortalGroup, startPortalInnerMesh, refUrl, true)) {
        return; // Stop checking if start portal was triggered
    }
}


let isRedirecting = false;

function triggerPortal(targetUrl, isReturnPortal) {
    if (isRedirecting) return;
    isRedirecting = true;
    controls.unlock(); // Release pointer lock

    console.log(`Entering portal to: ${targetUrl}`);

    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    newParams.append('portal', 'true');

    // Append player data
    newParams.append('username', config.player.username);
    newParams.append('color', config.player.color);

    // Append current speed (magnitude of XZ velocity - approximation as we don't store velocity now)
    // We can estimate speed based on movement keys or pass a default like config speed
    let currentSpeed = 0;
    if (moveForward || moveBackward || moveLeft || moveRight) {
        currentSpeed = config.player.speed;
    }
    newParams.append('speed', currentSpeed.toFixed(2));

    // Append velocity components (approximated or zeroed if not moving)
    // Since we removed playerVelocity, let's pass 0 for now or reconstruct from direction
    // For simplicity, pass 0. Can be enhanced later if needed.
    newParams.append('speed_x', '0.00');
    newParams.append('speed_z', '0.00');

    // Append rotation (horizontal look direction)
    if (controls) {
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        newParams.append('rotation_y', euler.y.toFixed(4));
    }

    // Append ref URL logic
    if (isReturnPortal) {
        // Keep existing params from the original entry, excluding 'portal' and 'ref' itself if it was the one we used to return
         for (const [key, value] of currentParams) {
             if (key !== 'portal' && key !== 'ref' && !newParams.has(key)) {
                 newParams.append(key, value);
             }
         }
         // Make sure the original 'ref' (which pointed TO this world) is not re-added if it exists.
         // The targetUrl already is the refUrl.
    } else {
        // Going to a NEW world, set ref to current location
        newParams.append('ref', window.location.origin + window.location.pathname);
        // Keep other existing params
        for (const [key, value] of currentParams) {
             if (key !== 'portal' && key !== 'ref' && !newParams.has(key)) {
                 newParams.append(key, value);
             }
         }
    }


    // Construct final URL
    let finalUrl = targetUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl; // Assume https if no protocol
    }

    const paramString = newParams.toString();

    if (paramString) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + paramString;
    }

    console.log("Redirecting to:", finalUrl);

    // Fade out effect before redirect
    document.body.style.transition = 'opacity 0.3s ease-out';
    document.body.style.opacity = '0';

    setTimeout(() => {
        window.location.href = finalUrl;
    }, 300); // Delay matches fade out duration
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    updatePlayer(delta); // Update player/camera position and rotation based on input
    checkPortalCollisions(); // Check if player entered a portal

    // Animate portal visual effects
    animatePortalParticles(exitPortalParticles);
    animatePortalParticles(startPortalParticles);

    renderer.render(scene, camera);
}

init();