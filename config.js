const config = {
    portalTargetUrl: "http://portal.pieter.com", 
    player: {
        speed: 5, 
        eyeHeight: 1.6, 
        color: '#ffffff', 
        username: `guest_${Math.random().toString(36).substring(7)}`, 
    },
    spawnPoint: { x: 0, y: 0, z: 0 },
    exitPortalPosition: { x: -15, y: 5, z: -20, radius: 5 }, 
    portalInteractionDistance: 4.0, 
    startPortalColor: 0xff0000, 
    exitPortalColor: 0x00ff00, 
};

export default config;