const config = {
    portalTargetUrl: "http://portal.pieter.com",
    player: {
        speed: 5, // Base movement speed in units per second
        eyeHeight: 1.6, // Camera height above the player's base position
        color: 'white',
        username: `guest_${Math.random().toString(36).substring(7)}`, // Generate a random guest name
    },
    spawnPoint: { x: 0, y: 0.5, z: 0 }, // Player base starts slightly above the absolute ground (y=0) if needed, adjust Y based on ground plane. Assuming ground is at Y=0, spawn Y=0 is fine. Let's keep Y=0.5 to avoid initial ground clip possibility.
    exitPortalPosition: { x: -30, y: 5, z: -30 }, // Keep existing position
    portalInteractionDistance: 7, // Reduced distance for triggering portal (relative to portal center)
    portalCollisionThreshold: 3, // Threshold used within checkPortal (distance check) - make this slightly larger than portal radius
    startPortalColor: 0xff0000, // Red
    exitPortalColor: 0x00ff00, // Green
};

export default config;