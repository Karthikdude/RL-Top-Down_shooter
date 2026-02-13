export const CONFIG = {
    FPS: 60,
    WIDTH: 3200,
    HEIGHT: 1600,
    VIEWPORT: {
        WIDTH: 1024,
        HEIGHT: 768
    },
    PLAYER: {
        RADIUS: 18,
        SPEED: 260, 
        BASE_HP: 2500,
        MAX_SHIELD: 1000,
        COLOR: '#3b82f6', 
        COOLDOWN: 0.2, 
        RESPAWN_TIME: 10,
        RANGE: 350,
        BASE_DAMAGE: 60,
        HP_PER_GOLD: 1.5,
        DMG_PER_GOLD: 0.15
    },
    BOT: {
        RADIUS: 18,
        SPEED: 260, // Matched Player Speed
        BASE_HP: 2500,
        MAX_SHIELD: 1000,
        COLOR: '#ef4444', 
        COOLDOWN: 0.2, // Matched Player Fire Rate (was 0.3)
        REACTION_TIME: 0.05, // Much faster reactions (Pro feel)
        AIM_ERROR: 0.05, // More accurate
        RANGE: 350,
        BASE_DAMAGE: 60, // Matched Player Damage
        HP_PER_GOLD: 1.5,
        DMG_PER_GOLD: 0.15
    },
    DASH: {
        COOLDOWN: 15.0,
        DURATION: 0.2,
        SPEED_MULTIPLIER: 5.0 // Very fast burst
    },
    SHIELD_SKILL: {
        COOLDOWN: 120.0,
        DURATION: 10.0,
        DAMAGE_REDUCTION: 0.8 // 80% Damage Reduction
    },
    TOWER: {
        TIER_1: { HP: 4500, DMG: 320, RANGE: 320, GOLD: 300, SHIELD: 4500 },
        TIER_2: { HP: 5500, DMG: 360, RANGE: 320, GOLD: 150 },
        TIER_3: { HP: 5500, DMG: 560, RANGE: 320, GOLD: 100 },
        NEXUS:  { HP: 6000, DMG: 0,   RANGE: 0,   GOLD: 1000 },
        
        RADIUS: 40,
        NEXUS_RADIUS: 60,
        
        RANGE: 320,
        COOLDOWN: 1.0,

        ATTACK_SPEED: 1.0,
        DAMAGE_STACK: 0.75,
        MAX_STACKS: 20,
        BACKDOOR_REDUCTION: 0.5,
        
        COLOR_PLAYER: '#60a5fa',
        COLOR_BOT: '#f87171'
    },
    MINION: {
        HP: 600,
        SPEED: 130, 
        RADIUS: 12,
        DAMAGE: 20,
        COOLDOWN: 1.0,
        RANGE: 180,
        SPAWN_INTERVAL: 30,
        FIRST_WAVE_DELAY: 5,
        COUNT_PER_WAVE: 3,
        GOLD_REWARD: 45,
        HP_SCALING_PER_MIN: 100,
        DMG_SCALING_PER_MIN: 5
    },
    AMMO: {
        MAX: 30,
        RELOAD_TIME: 1.5
    },
    BULLET: {
        SPEED: 800,
        RADIUS: 5,
        LIFETIME: 3 
    },
    FOUNTAIN: {
        RADIUS: 280,
        HEAL_RATE: 800,   // HP per second
        SHIELD_RATE: 400,  // Shield per second
        COMBAT_COOLDOWN: 3 // Seconds to wait after taking damage before healing
    },
    SPAWNS: {
        PLAYER: { x: 100, y: 800, angle: 0 },
        BOT: { x: 3100, y: 800, angle: Math.PI }
    },
    OBSTACLES: [
        // --- TOP JUNGLE (Y < 600) ---
        { x: 600, y: 100, w: 200, h: 300 },
        { x: 1400, y: 100, w: 400, h: 250 }, 
        { x: 2400, y: 100, w: 200, h: 300 },
        
        { x: 1000, y: 400, w: 100, h: 100 },
        { x: 2100, y: 400, w: 100, h: 100 },
        
        { x: 200, y: 200, w: 50, h: 200 },
        { x: 200, y: 200, w: 200, h: 50 },

        { x: 2950, y: 200, w: 50, h: 200 },
        { x: 2800, y: 200, w: 200, h: 50 },

        // --- BOTTOM JUNGLE (Y > 1000) ---
        { x: 600, y: 1200, w: 200, h: 300 },
        { x: 1400, y: 1250, w: 400, h: 250 }, 
        { x: 2400, y: 1200, w: 200, h: 300 },

        { x: 1000, y: 1100, w: 100, h: 100 },
        { x: 2100, y: 1100, w: 100, h: 100 },

        { x: 200, y: 1200, w: 50, h: 200 },
        { x: 200, y: 1350, w: 200, h: 50 },

        { x: 2950, y: 1200, w: 50, h: 200 },
        { x: 2800, y: 1350, w: 200, h: 50 },
        
        // --- MID LANE BUFFERS ---
        { x: 0, y: 0, w: 3200, h: 50 },
        { x: 0, y: 1550, w: 3200, h: 50 }, 
        { x: 0, y: 0, w: 50, h: 1600 }, 
        { x: 3150, y: 0, w: 50, h: 1600 }, 
    ]
};