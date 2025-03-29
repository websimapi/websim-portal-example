import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import config from './config.js';

let scene, camera, renderer, controls;
let player, playerVelocity = new THREE.Vector3();
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
if (!isNaN(portalSpeed)) config.player.speed = portalSpeed;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 150); 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(config.spawnPoint.x, config.spawnPoint.y + 1.6, config.spawnPoint.z + 5);

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

    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8); 
    playerGeometry.translate(0, 0.5, 0); 
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: config.player.color,
        roughness: 0.5,
        metalness: 0.3
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(config.spawnPoint.x, config.spawnPoint.y, config.spawnPoint.z);
    player.castShadow = true; 
    scene.add(player);
    player.userData.velocity = playerVelocity; 

    controls = new PointerLockControls(camera, document.body);
    controls.getObject().position.set(player.position.x, player.position.y + 1.6, player.position.z);
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
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);

    createExitPortal();
    if (isComingFromPortal && refUrl) {
        createStartPortal();
    }

    if (isComingFromPortal) {
        loadingScreen.style.display = 'none';
        infoElement.style.display = 'none';
        try {
            controls.lock();
        } catch (e) {
            console.warn("Could not automatically lock pointer. User interaction might be needed.");
             infoElement.textContent = "Click to enter the world!";
             infoElement.style.display = 'block';
        }
    }

    animate();
}

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
    const portalBox = new THREE.Box3().setFromObject(portalInner);

    return { group: portalGroup, box: portalBox, innerMesh: portalInner }; 
}

function createExitPortal() {
    const result = createPortalVisuals(
        config.exitPortalColor,
        config.exitPortalPosition,
        { x: 0.1, y: Math.PI / 4 } 
    );
    exitPortalGroup = result.group;
    exitPortalBox = result.box;
    exitPortalInnerMesh = result.innerMesh;
    exitPortalParticles = exitPortalGroup.userData.particles;

    createPortalLabel(exitPortalGroup, 'VIBEVERSE PORTAL', config.exitPortalColor, 10, 2); 
}

function createStartPortal() {
    const offset = 10;
    const startPos = {
        x: config.spawnPoint.x,
        y: config.exitPortalPosition.y, 
        z: config.spawnPoint.z + offset
    };
    const result = createPortalVisuals(
        config.startPortalColor,
        startPos,
        { x: 0, y: Math.PI } 
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
    label.position.y = 6.5; 
    label.rotation.y = Math.PI; 
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
        const z = positions[i+2];

        const angle = Math.atan2(y, x);
        const radius = Math.sqrt(x*x + y*y);
        const swirlFactor = 0.3; 
        const newAngle = angle + swirlFactor * time + radius * 0.1; 

        positions[i] = Math.cos(newAngle) * radius;
        positions[i + 1] = Math.sin(newAngle) * radius;

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
    if (!controls.isLocked) {
        playerVelocity.multiplyScalar(0); 
        return;
    }

    const speed = config.player.speed * 50; 
    const damping = 10.0;

    playerVelocity.x -= playerVelocity.x * damping * delta;
    playerVelocity.z -= playerVelocity.z * damping * delta;

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; 
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize(); 

    if (moveForward) direction.add(forward);
    if (moveBackward) direction.sub(forward);
    if (moveLeft) direction.sub(right); 
    if (moveRight) direction.add(right); 

    direction.normalize(); 

    playerVelocity.x += direction.x * speed * delta;
    playerVelocity.z += direction.z * speed * delta;

    controls.moveRight(playerVelocity.x * delta);
    controls.moveForward(playerVelocity.z * delta); 

    player.position.copy(controls.getObject().position);
    player.position.y = config.spawnPoint.y; 

    controls.getObject().position.y = player.position.y + 1.6; 
}

function checkPortalCollisions() {
    if (!player || isRedirecting || !controls.isLocked) return;

    const playerPosition = controls.getObject().position;

    if (exitPortalGroup) {
        const portalCenter = new THREE.Vector3();
        exitPortalBox.getCenter(portalCenter); 
        const distanceToExit = playerPosition.distanceTo(portalCenter);

        if (distanceToExit < config.portalInteractionDistance) {
             if (distanceToExit < config.portalCollisionThreshold) {
                  const raycaster = new THREE.Raycaster(playerPosition, portalCenter.clone().sub(playerPosition).normalize());
                  const intersects = raycaster.intersectObject(exitPortalInnerMesh); 

                  if (intersects.length > 0 && intersects[0].distance < 1.5) { 
                      triggerPortal(config.portalTargetUrl, false);
                      return; 
                  }
             }
        }
    }

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
    controls.unlock(); 

    console.log(`Entering portal to: ${targetUrl}`);

    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    newParams.append('portal', 'true');

    newParams.append('username', config.player.username);
    newParams.append('color', config.player.color);

    const currentSpeed = playerVelocity.length();
    newParams.append('speed', currentSpeed > 0.1 ? currentSpeed.toFixed(2) : config.player.speed.toFixed(2)); 

    newParams.append('speed_x', playerVelocity.x.toFixed(2));
    newParams.append('speed_z', playerVelocity.z.toFixed(2));

    if (controls) {
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        newParams.append('rotation_y', euler.y.toFixed(4)); 
    }

    if (isReturnPortal) {
        for (const [key, value] of currentParams) {
             if (key !== 'portal' && !newParams.has(key)) { 
                 newParams.append(key, value);
             }
         }
        if (!newParams.has('ref') && currentParams.has('ref')) {
             newParams.append('ref', currentParams.get('ref'));
        }
    } else {
        newParams.append('ref', window.location.origin + window.location.pathname);
        for (const [key, value] of currentParams) {
             if (key !== 'portal' && key !== 'ref' && !newParams.has(key)) {
                 newParams.append(key, value);
             }
         }
    }

    let finalUrl = targetUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl; 
    }

    const paramString = newParams.toString();

    if (paramString) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + paramString;
    }

    console.log("Redirecting to:", finalUrl);

    document.body.style.transition = 'opacity 0.3s ease-out';
    document.body.style.opacity = '0';

    setTimeout(() => {
        window.location.href = finalUrl;
    }, 300); 
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    updatePlayer(delta);
    checkPortalCollisions(); 

    animatePortalParticles(exitPortalParticles);
    animatePortalParticles(startPortalParticles);

    renderer.render(scene, camera);
}

init();