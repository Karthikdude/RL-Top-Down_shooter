export type Team = 'player' | 'bot';
export type TowerTier = 1 | 2 | 3 | 4; // 1: Outer, 2: Inner, 3: Base Turret, 4: Nexus (Base)

export interface InputState {
    moveX: number;
    moveY: number;
    aimAngle: number;
    shoot: boolean;
    reload: boolean;
    dash: boolean;
    shield: boolean;
}

export interface Entity {
    id: number; // For turret tracking
    x: number;
    y: number;
    angle: number;
    hp: number;
    maxHp: number;
    baseHp: number; // For scaling calculations
    shield: number;
    maxShield: number;
    ammo: number;
    reloading: boolean;
    reloadTimer: number;
    cooldown: number;
    dead: boolean;
    respawnTimer: number;
    team: Team;
    // Economy & Scaling
    gold: number;
    level: number; // Derived from gold
    baseDamage: number; // For scaling calculations
    // Combat Tracking
    lastDamageTime: number; // Timestamp of last damage taken
    // Skills
    dashCooldown: number;
    dashing: boolean;
    dashTimeLeft: number;
    
    shieldSkillCooldown: number;
    shieldSkillActive: boolean;
    shieldSkillTimeLeft: number;
    
    // Bot specific
    targetMoveX?: number;
    targetMoveY?: number;
}

export interface Tower {
    id: number;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    radius: number;
    color: string;
    team: Team;
    tier: TowerTier; // 1=Outer, 2=Inner, 3=BaseTurret, 4=Nexus
    dead: boolean;
    cooldown: number;
    
    // MLBB Mechanics
    invulnerable: boolean; // Cannot be damaged if lower tier exists
    energyShield: number; // Outer Turret early game shield
    maxEnergyShield: number;
    
    // Damage Stacking
    lastTargetId: number | null;
    consecutiveHits: number;
}

export interface Minion {
    id: number;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    angle: number;
    team: Team;
    dead: boolean;
    cooldown: number;
    damage: number;
    type: 'melee' | 'ranged' | 'siege'; // Added basic types for future visual differentiation
    goldValue: number;
}

export interface Bullet {
    x: number;
    y: number;
    angle: number;
    team: Team; 
    damage: number;
    life: number;
    color?: string;
    sourceId: number; // To track who dealt damage for aggro
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

export interface HitMarker {
    x: number;
    y: number;
    life: number;
}

export interface GameState {
    running: boolean;
    lastTime: number;
    gameTime: number; 
    player: Entity;
    bot: Entity;
    towers: Tower[];
    minions: Minion[];
    bullets: Bullet[];
    particles: Particle[];
    hitMarkers: HitMarker[];
    botTimer: number;
    nextWaveTime: number;
    entityIdCounter: number; // To assign unique IDs
    outcome?: "VICTORY" | "DEFEAT" | null; // Added outcome tracking
}