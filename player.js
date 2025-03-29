import * as THREE from 'three';
import config from './config.js';

let playerMesh;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let playerVelocity = new THREE.Vector3(); // Store velocity for sending in portal params
let controls;

export function createPlayer(scene) {
    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    playerGeometry.translate(0, 0.5, 0); // Move geometry up so base is at origin Y=0
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: config.player.color,
        roughness: 0.5,
        metalness: 0.3
    });
    playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.position.set(config.spawnPoint.x, config.spawnPoint.y, config.spawnPoint.z);
    playerMesh.castShadow = true;
    scene.add(playerMesh);
    return playerMesh;
}

export function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
    }
}

export function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
    }
}

// Reset movement on pointer unlock
export function resetMovement() {
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    playerVelocity.set(0, 0, 0); // Also reset velocity
}

export function updatePlayer(delta, controlsObj, camera) {
    controls = controlsObj;
    if (!controls.isLocked || !playerMesh) {
        playerVelocity.set(0, 0, 0); // Ensure velocity is zeroed if not moving/locked
        return;
    }

    const speed = config.player.speed;
    const direction = new THREE.Vector3();
    let isMoving = false;

    // Calculate forward and right vectors based on camera orientation (projected onto XZ plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize();

    // Determine net movement direction based on key states
    if (moveForward) { direction.add(forward); isMoving = true; }
    if (moveBackward) { direction.sub(forward); isMoving = true; }
    if (moveLeft) { direction.sub(right); isMoving = true; }
    if (moveRight) { direction.add(right); isMoving = true; }

    // Calculate velocity based on direction and speed
    if (isMoving) {
        direction.normalize(); // Ensure consistent speed for diagonal movement
        playerVelocity.copy(direction).multiplyScalar(speed);
    } else {
        playerVelocity.set(0, 0, 0); // Stop moving
    }

    // Calculate displacement vector for this frame
    const displacement = playerVelocity.clone().multiplyScalar(delta);

    // Move the controls object (camera's parent)
    controls.getObject().position.add(displacement);

    // Keep camera (controls object) at a fixed height above the spawn Y level
    controls.getObject().position.y = config.spawnPoint.y + config.player.eyeHeight;

    // Update the player mesh model position to follow the camera horizontally,
    // and position its base at the spawn Y level.
    playerMesh.position.x = controls.getObject().position.x;
    playerMesh.position.z = controls.getObject().position.z;
    playerMesh.position.y = config.spawnPoint.y; // Keep player mesh base on the "ground"

    // Update player mesh rotation to face the direction the camera is looking horizontally
    if (isMoving) { // Only update rotation if moving to avoid snapping back to forward when stopping
        playerMesh.rotation.y = Math.atan2(direction.x, direction.z); // Use movement direction for rotation
    } else {
         // Optionally keep last rotation or align with camera even when stopped
         playerMesh.rotation.y = Math.atan2(forward.x, forward.z);
    }
}

// Function to get current player state for portal parameters
export function getPlayerData(camera) {
     const forward = new THREE.Vector3();
     if (camera) {
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
     }
     // Calculate speed components from the current velocity vector
     // Note: playerVelocity is in world space based on camera direction at time of movement calculation
     const speed_x = playerVelocity.x;
     const speed_z = playerVelocity.z;

     // Calculate rotation from camera
     let rotation_y = 0;
     if (camera) {
         const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
         rotation_y = euler.y;
     }

    return {
        username: config.player.username,
        color: config.player.color,
        speed: playerVelocity.length(), // Current actual speed
        speed_x: speed_x,
        speed_z: speed_z,
        rotation_y: rotation_y,
        position: controls?.getObject()?.position // Provide camera position for collision checks
    };
}

// Function to get the player mesh for external use (e.g., collision)
export function getPlayerMesh() {
    return playerMesh;
}