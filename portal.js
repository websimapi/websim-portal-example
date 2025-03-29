import * as K from 'three';
import config from './config.js';

let exitPortalGroup, exitPortalInnerMesh, exitPortalParticles, exitPortalRing;
let startPortalGroup, startPortalInnerMesh, startPortalParticles, startPortalRing;
let isRedirecting = false;
let playerNearExitPortal = false;
let playerNearStartPortal = false;

const originalExitColor = new K.Color(config.exitPortalColor);
const originalStartColor = new K.Color(config.startPortalColor);
const proximityColorFactor = 1.5; // How much brighter the portal gets when near

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
        emissiveIntensity: 1.0, // Start with base intensity
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

    // Return the ring mesh as well for proximity effect
    return { group: portalGroup, innerMesh: portalInner, particles: particles, ring: portalRing };
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
        originalExitColor, // Use original color
        config.exitPortalPosition,
        { x: 0.1, y: Math.PI / 4 }
    );
    exitPortalGroup = result.group;
    exitPortalInnerMesh = result.innerMesh;
    exitPortalParticles = result.particles;
    exitPortalRing = result.ring; // Store ring mesh
    createPortalLabel(exitPortalGroup, 'VIBEVERSE PORTAL', config.exitPortalColor, 10, 2);
}

export function createStartPortal(scene, refUrl) {
    const offset = 10;
    const startPos = {
        x: config.spawnPoint.x,
        y: config.exitPortalPosition.y, // Use same Y as exit portal for consistency
        z: config.spawnPoint.z + offset
    };
    const result = createPortalVisuals(
        scene,
        originalStartColor, // Use original color
        startPos,
        { x: 0, y: Math.PI } // Rotate to face player spawn
    );
    startPortalGroup = result.group;
    startPortalInnerMesh = result.innerMesh;
    startPortalParticles = result.particles;
    startPortalRing = result.ring; // Store ring mesh

    const domain = refUrl ? getDomain(refUrl) : 'Previous World';
    createPortalLabel(startPortalGroup, `Return to ${domain}`, config.startPortalColor, 15, 2);
}

// --- Particle Animation & Proximity Effect ---
export function animatePortalParticles() {
    const time = Date.now() * 0.0005;
    const proximitySpeedFactor = 1.5; // How much faster particles move when near

    const animateSystem = (particles, isNear) => {
        if (!particles) return;
        const positions = particles.attributes.position.array;
        const speedMultiplier = isNear ? proximitySpeedFactor : 1.0;
        const particleTime = time * speedMultiplier;

        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i+1];
            const z = positions[i+2];

            const angle = Math.atan2(y, x);
            // Use base radius if available, otherwise calculate (less efficient)
            const radius = particles.userData.basePositions
                         ? Math.sqrt(particles.userData.basePositions[i]**2 + particles.userData.basePositions[i+1]**2)
                         : Math.sqrt(x*x + y*y);

            const swirlFactor = 0.3;
            const newAngle = angle + swirlFactor * particleTime + radius * 0.1;

            positions[i] = Math.cos(newAngle) * radius;
            positions[i + 1] = Math.sin(newAngle) * radius;
            // Keep z oscillation consistent regardless of proximity speed
            positions[i + 2] = (particles.userData.basePositions ? particles.userData.basePositions[i+2] : z) + Math.sin(time * 5 + angle * 3) * 0.1;
        }
        particles.attributes.position.needsUpdate = true;
    };

     // Store base positions for consistent radius/z calculation if not already done
    if (exitPortalParticles && !exitPortalParticles.userData.basePositions) {
        exitPortalParticles.userData.basePositions = exitPortalParticles.attributes.position.array.slice();
    }
     if (startPortalParticles && !startPortalParticles.userData.basePositions) {
        startPortalParticles.userData.basePositions = startPortalParticles.attributes.position.array.slice();
     }

    animateSystem(exitPortalParticles, playerNearExitPortal);
    animateSystem(startPortalParticles, playerNearStartPortal);

    // Update emissive intensity based on proximity
    if (exitPortalRing) {
        exitPortalRing.material.emissiveIntensity = playerNearExitPortal ? proximityColorFactor : 1.0;
        // Optionally update inner mesh opacity/brightness too
        // exitPortalInnerMesh.material.opacity = playerNearExitPortal ? 0.5 : 0.3;
    }
     if (startPortalRing) {
        startPortalRing.material.emissiveIntensity = playerNearStartPortal ? proximityColorFactor : 1.0;
        // startPortalInnerMesh.material.opacity = playerNearStartPortal ? 0.5 : 0.3;
     }
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
    if (!playerData || !playerData.position || isRedirecting || !controls?.isLocked) {
        // Reset proximity flags if player isn't active or is redirecting
        playerNearExitPortal = false;
        playerNearStartPortal = false;
        return;
    }

    const playerPosition = playerData.position;
    const playerBasePosition = playerPosition.clone();
    // Assume player base is roughly at spawn Y level - might need refinement if verticality exists
    playerBasePosition.y = config.spawnPoint.y;

    const portalTriggerThreshold = config.portalInteractionDistance; // Distance to trigger redirect
    const portalProximityThreshold = portalTriggerThreshold + 1.5; // Slightly larger distance for visual feedback

    // Helper function for portal check logic
    const checkPortal = (portalInnerMesh, portalGroup, targetUrl, isReturn) => {
        if (!portalInnerMesh || !portalGroup) return { near: false, triggered: false }; // Portal doesn't exist

        const portalCenter = new K.Vector3();
        portalGroup.getWorldPosition(portalCenter); // Use group center

        // 1. Check distance for proximity effect
        const distanceToPortal = playerBasePosition.distanceTo(portalCenter);
        const isNear = distanceToPortal < portalProximityThreshold;

        // 2. Check distance for triggering (more precise than simple distance)
        let triggered = false;
        if (distanceToPortal < portalTriggerThreshold) {
            // More precise check: Is the player base point roughly within the portal ring radius
            // and close to the portal's plane?

            // Get portal's world rotation and up vector (normal to the portal plane)
            const portalWorldQuaternion = new K.Quaternion();
            portalGroup.getWorldQuaternion(portalWorldQuaternion);
            const portalNormal = new K.Vector3(0, 0, 1).applyQuaternion(portalWorldQuaternion); // Default Z-axis if no rotation
            // If portal rotated, might need different axis, e.g. (0,1,0) for horizontal portal
            // For Torus default orientation, Z might be appropriate, or Y if rotated flat. Let's stick with Y-axis normal for vertical portals.
            const portalPlaneNormal = new K.Vector3(0, 1, 0).applyQuaternion(portalWorldQuaternion);


            // Vector from portal center to player base
            const vecToPlayer = playerBasePosition.clone().sub(portalCenter);

            // Distance along the portal's normal (how far "in front" or "behind" the plane)
            const distFromPlane = Math.abs(vecToPlayer.dot(portalPlaneNormal));

            // Project player position onto the portal plane
            const projectedPoint = playerBasePosition.clone().sub(portalPlaneNormal.clone().multiplyScalar(vecToPlayer.dot(portalPlaneNormal)));
            const distFromCenterOnPlane = projectedPoint.distanceTo(portalCenter);

            const portalRadius = config.exitPortalPosition.radius || 5; // Use a default radius, could be stored per portal

             //console.log(`Dist Plane: ${distFromPlane.toFixed(2)}, Dist Center: ${distFromCenterOnPlane.toFixed(2)}, Radius: ${portalRadius}`);

            // Trigger conditions: close to the plane AND within the radius on the plane
            if (distFromPlane < 1.0 && distFromCenterOnPlane < portalRadius) { // Adjust thresholds as needed (1.0 for plane, radius for ring)
                 console.log(`Attempting to trigger portal to ${targetUrl}`);
                 triggerPortal(targetUrl, isReturn, playerData, controls);
                 triggered = true;
            }
        }

        return { near: isNear, triggered: triggered };
    };

    // Check exit portal
    const exitResult = checkPortal(exitPortalInnerMesh, exitPortalGroup, config.portalTargetUrl, false);
    playerNearExitPortal = exitResult.near; // Update proximity state
    if (exitResult.triggered) return; // Stop checking if exit portal was triggered

    // Check start portal (if it exists and has a refUrl)
    if (refUrl) {
        const startResult = checkPortal(startPortalInnerMesh, startPortalGroup, refUrl, true);
        playerNearStartPortal = startResult.near; // Update proximity state
        if (startResult.triggered) return; // Stop checking if start portal was triggered
    } else {
        playerNearStartPortal = false; // No start portal, not near
    }
}