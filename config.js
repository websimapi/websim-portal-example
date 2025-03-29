const config = {
    portalTargetUrl: "http://portal.pieter.com",
    player: {
        speed: 5,
        color: 'white',
        username: 'guest',
    },
    spawnPoint: { x: 0, y: 10, z: 0 },
    exitPortalPosition: { x: -50, y: 10, z: -50 },
    portalInteractionDistance: 15, // Units within which interaction/redirect happens
    startPortalColor: 0xff0000, // Red
    exitPortalColor: 0x00ff00, // Green
};

export default config;

const config = {
    portalTargetUrl: "http://portal.pieter.com",
    player: {
        speed: 5, // meters per second (approx)
        color: 'white',
        username: `guest_${Math.random().toString(36).substring(7)}`, // Generate a random guest name
    },
    spawnPoint: { x: 0, y: 1, z: 0 }, // Adjusted Y to be closer to ground
    exitPortalPosition: { x: -30, y: 5, z: -30 }, // Positioned lower and closer
    portalInteractionDistance: 15, // Units within which interaction/redirect happens
    portalCollisionThreshold: 5, // Closer distance for actual collision/redirect trigger
    startPortalColor: 0xff0000, // Red
    exitPortalColor: 0x00ff00, // Green
};

export default config;

