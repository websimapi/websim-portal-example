import * as K from 'three';
import config from './config.js';

let exitPortalGroup, exitPortalInnerMesh, exitPortalParticles;
let startPortalGroup, startPortalInnerMesh, startPortalParticles;
let isRedirecting = false;

// --- Domain Helper ---
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

// --- Portal Visuals and Label ---
function createPortalVisuals(scene, color, position, rotation) {
    const portalGroup = new K.Group();
    portalGroup.position.set(position.x, position.y, position.z);
    if (rotation) {
        portalGroup.rotation.x = rotation.x || 0;
        portalGroup.rotation.y = rotation.y || 0;
        portalGroup.rotation.z = rotation.z || 0;
    }

    const portalRadius = 5;
    const tubeRadius = 0.75;

    // Ring
    const portalGeometry = new K.TorusGeometry(portalRadius, tubeRadius, 16, 100);
    const portalMaterial = new K.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.7,
        shininess: 150
    });
    const portalRing = new K.Mesh(portalGeometry, portalMaterial);
    portalGroup.add(portalRing);

    // Inner Surface (for visual effect and collision check basis)
    const portalInnerGeometry = new K.CircleGeometry(portalRadius - tubeRadius, 32);
    const portalInnerMaterial = new K.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: K.DoubleSide,
        blending: K.AdditiveBlending,
        depthWrite: false
    });
    const portalInner = new K.Mesh(portalInnerGeometry, portalInnerMaterial);
    portalGroup.add(portalInner);

    // Particles
    const particleCount = 1000;
    const particles = new K.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const particleBaseColor = new K.Color(color);

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
    particles.setAttribute('position', new K.BufferAttribute(positions, 3));
    particles.setAttribute('color', new K.BufferAttribute(colors, 3));

    const particleMaterial = new K.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: K.AdditiveBlending,
        depthWrite: false
    });
    const particleSystem = new K.Points(particles, particleMaterial);
    portalGroup.add(particleSystem);

    scene.add(portalGroup);

    return { group: portalGroup, innerMesh: portalInner, particles: particles };
}

function createPortalLabel(parentGroup, text, color, width, height) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const font_size = 32;
    context.font = `bold ${font_size}px Arial`;

    const textWidth = context.measureText(text).width;
    canvas.width = K.MathUtils.ceilPowerOfTwo(textWidth + 40);
    canvas.height = K.MathUtils.ceilPowerOfTwo(font_size + 20);

    context.font = `bold ${font_size}px Arial`;
    context.fillStyle = new K.Color(color).getStyle();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new K.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const labelGeometry = new K.PlaneGeometry(width, height);
    const labelMaterial = new K.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: K.DoubleSide,
        depthWrite: false
    });
    const label = new K.Mesh(labelGeometry, labelMaterial);
    label.position.y = 6.5; // Position above the portal ring
    parentGroup.add(label);
}

// --- Portal Creation Functions ---
export function createExitPortal(scene) {
    const result = createPortalVisuals(
        scene,
        config.exitPortalColor,
        config.exitPortalPosition,
        { x: 0.1, y: Math.PI / 4 }
    );
    exitPortalGroup = result.group;
    exitPortalInnerMesh = result.innerMesh;
    exitPortalParticles = result.particles;
    createPortalLabel(exitPortalGroup, 'VIBEVERSE PORTAL', config.exitPortalColor, 10, 2);
}

export function createStartPortal(scene, refUrl) {
    const offset = 10;
    const startPos = {
        x: config.spawnPoint.x,
        y: config.exitPortalPosition.y,
        z: config.spawnPoint.z + offset
    };
    const result = createPortalVisuals(
        scene,
        config.startPortalColor,
        startPos,
        { x: 0, y: Math.PI } // Rotate to face player spawn
    );
    startPortalGroup = result.group;
    startPortalInnerMesh = result.innerMesh;
    startPortalParticles = result.particles;

    const domain = refUrl ? getDomain(refUrl) : 'Previous World';
    createPortalLabel(startPortalGroup, `Return to ${domain}`, config.startPortalColor, 15, 2);
}

// --- Particle Animation ---
export function animatePortalParticles() {
    const animateSystem = (particles) => {
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
    };

    animateSystem(exitPortalParticles);
    animateSystem(startPortalParticles);
}

// --- Collision and Triggering ---
function triggerPortal(targetUrl, isReturnPortal, playerData, controls) {
    if (isRedirecting) return;
    isRedirecting = true;
    if (controls) controls.unlock(); // Release pointer lock

    console.log(`Entering portal to: ${targetUrl}`);

    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    newParams.append('portal', 'true');

    // Append player data
    newParams.append('username', playerData.username);
    newParams.append('color', playerData.color);
    newParams.append('speed', playerData.speed.toFixed(2)); // Current overall speed
    newParams.append('speed_x', playerData.speed_x.toFixed(2)); // X component of velocity
    newParams.append('speed_z', playerData.speed_z.toFixed(2)); // Z component of velocity
    newParams.append('rotation_y', playerData.rotation_y.toFixed(4)); // Horizontal look direction

    // Append ref URL logic
    if (isReturnPortal) {
        // Keep existing params from the original entry, EXCLUDING 'portal' and 'ref'
         for (const [key, value] of currentParams) {
             if (key !== 'portal' && key !== 'ref' && !newParams.has(key)) {
                 newParams.append(key, value);
             }
         }
    } else {
        // Going to a NEW world, set ref to current location
        newParams.append('ref', window.location.origin + window.location.pathname);
        // Keep other existing params (except portal/ref which might exist if we came from somewhere)
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

export function checkPortalCollisions(playerData, controls, refUrl) {
    if (!playerData || !playerData.position || isRedirecting || !controls?.isLocked) return;

    const playerPosition = playerData.position;

    // Helper function for portal check logic
    const checkPortal = (portalInnerMesh, targetUrl, isReturn) => {
        if (!portalInnerMesh) return false; // Portal doesn't exist

        // Use the player's camera position for the check
        const playerCollider = new K.Box3(
            playerPosition.clone().subScalar(0.1), // Small box around camera center
            playerPosition.clone().addScalar(0.1)
        );
        // Adjust collider Y to represent player's feet/base area roughly
        playerCollider.min.y = playerPosition.y - config.player.eyeHeight;
        playerCollider.max.y = playerPosition.y - config.player.eyeHeight + 0.2; // Small height box near floor


        // Create a world-space bounding box for the portal inner mesh
        const portalWorldBox = new K.Box3().setFromObject(portalInnerMesh, true); // Use precise bounding box

        // Check for intersection between player collider and portal inner mesh box
        if (playerCollider.intersectsBox(portalWorldBox)) {
             // More accurate check: distance from player *base* to portal *center* projected onto portal plane
             const portalCenter = new K.Vector3();
             portalInnerMesh.getWorldPosition(portalCenter);
             const playerBasePosition = playerPosition.clone();
             playerBasePosition.y = config.spawnPoint.y; // Use player base Y for distance check

             const distanceToPortal = playerBasePosition.distanceTo(portalCenter);

            // Use configured interaction distance
            if (distanceToPortal < config.portalInteractionDistance) {
                triggerPortal(targetUrl, isReturn, playerData, controls);
                return true; // Collision detected and triggered
            }
        }
        return false; // No collision
    };

    // Check exit portal
    if (checkPortal(exitPortalInnerMesh, config.portalTargetUrl, false)) {
        return; // Stop checking if exit portal was triggered
    }

    // Check start portal (if it exists and has a refUrl)
    if (refUrl && checkPortal(startPortalInnerMesh, refUrl, true)) {
        return; // Stop checking if start portal was triggered
    }
}