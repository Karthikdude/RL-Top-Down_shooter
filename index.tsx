import { CONFIG } from './modules/config';
import { GameState, Entity, Tower, Team, TowerTier } from './modules/types';
import { Input } from './modules/input';
import { moveEntity, checkWallCollision } from './modules/physics';
import { getBotAction } from './modules/ai';
import { draw, updateHUD } from './modules/renderer';
import { spawnMinionWave, updateMinions, updateTowers } from './modules/gameLogic';
import { Skills } from './modules/skills';

// Global State
let state: GameState = {
    running: false,
    lastTime: 0,
    gameTime: 0,
    // Initialize with safe defaults or empty objects that will be populated by resetState() immediately
    player: {
        id: 0, x: 0, y: 0, angle: 0, hp: 100, maxHp: 100, baseHp: 100, shield: 0, maxShield: 0,
        ammo: 0, reloading: false, reloadTimer: 0, cooldown: 0, dead: false, respawnTimer: 0,
        team: 'player', gold: 0, level: 1, baseDamage: 0, lastDamageTime: -10,
        dashCooldown: 0, dashing: false, dashTimeLeft: 0,
        shieldSkillCooldown: 0, shieldSkillActive: false, shieldSkillTimeLeft: 0
    },
    bot: {
        id: 0, x: 0, y: 0, angle: 0, hp: 100, maxHp: 100, baseHp: 100, shield: 0, maxShield: 0,
        ammo: 0, reloading: false, reloadTimer: 0, cooldown: 0, dead: false, respawnTimer: 0,
        team: 'bot', gold: 0, level: 1, baseDamage: 0, lastDamageTime: -10,
        dashCooldown: 0, dashing: false, dashTimeLeft: 0,
        shieldSkillCooldown: 0, shieldSkillActive: false, shieldSkillTimeLeft: 0
    },
    towers: [],
    minions: [],
    bullets: [],
    particles: [],
    hitMarkers: [],
    botTimer: 0,
    nextWaveTime: CONFIG.MINION.FIRST_WAVE_DELAY,
    entityIdCounter: 1
};

let camera = { x: 0, y: 0 };

function getUniqueId(): number {
    return state.entityIdCounter++;
}

function createParticles(x: number, y: number, color: string, count: number, speedMultiplier: number = 1) {
    for(let i=0; i<count; i++) {
        state.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 200 * speedMultiplier,
            vy: (Math.random() - 0.5) * 200 * speedMultiplier,
            life: 0.5,
            color,
            size: Math.random() * 3 + 1
        });
    }
}

function createHitMarker(x: number, y: number) {
    state.hitMarkers.push({
        x, y, life: 0.2 // Lasts 0.2 seconds
    });
}

// Updated to calculate lifetime based on source Range
function spawnBullet(x: number, y: number, angle: number, team: 'player' | 'bot', damage: number, sourceId: number) {
    const offset = 25;
    const bx = x + Math.cos(angle) * offset;
    const by = y + Math.sin(angle) * offset;

    if (checkWallCollision(bx, by, CONFIG.BULLET.RADIUS)) {
        createParticles(bx, by, '#aaa', 2);
        return;
    }

    // Calculate exact lifetime to match the visual range circle
    const range = team === 'player' ? CONFIG.PLAYER.RANGE : CONFIG.BOT.RANGE;
    const lifetime = range / CONFIG.BULLET.SPEED;

    state.bullets.push({
        x: bx,
        y: by,
        angle,
        team,
        damage,
        life: lifetime,
        color: team === 'player' ? '#fbbf24' : '#fca5a5',
        sourceId
    });
}

function initTowers() {
    state.towers = [];
    
    const createTower = (x: number, y: number, team: 'player' | 'bot', tier: TowerTier): Tower => {
        let stats;
        if (tier === 1) stats = CONFIG.TOWER.TIER_1;
        else if (tier === 2) stats = CONFIG.TOWER.TIER_2;
        else if (tier === 3) stats = CONFIG.TOWER.TIER_3;
        else stats = CONFIG.TOWER.NEXUS;

        return {
            id: getUniqueId(),
            x, y,
            hp: stats.HP,
            maxHp: stats.HP,
            radius: tier === 4 ? CONFIG.TOWER.NEXUS_RADIUS : CONFIG.TOWER.RADIUS,
            color: team === 'player' ? CONFIG.TOWER.COLOR_PLAYER : CONFIG.TOWER.COLOR_BOT,
            team, 
            tier,
            dead: false, 
            cooldown: 0,
            
            invulnerable: tier !== 1, // Only Tier 1 is vulnerable at start
            energyShield: tier === 1 ? stats.SHIELD || 0 : 0,
            maxEnergyShield: tier === 1 ? stats.SHIELD || 0 : 0,
            
            lastTargetId: null,
            consecutiveHits: 0
        };
    };

    // New Center Y for larger map
    const midY = 800;
    
    // Player Team (Left Side)
    // Map Width 3200
    // Nexus @ 100, Base @ 300, Inner @ 800, Outer @ 1300
    state.towers.push(createTower(100, midY, 'player', 4)); // Nexus
    state.towers.push(createTower(300, midY, 'player', 3)); // Base Turret
    state.towers.push(createTower(800, midY, 'player', 2)); // Inner
    state.towers.push(createTower(1300, midY, 'player', 1)); // Outer

    // Bot Team (Right Side)
    // Nexus @ 3100, Base @ 2900, Inner @ 2400, Outer @ 1900
    state.towers.push(createTower(3100, midY, 'bot', 4)); // Nexus
    state.towers.push(createTower(2900, midY, 'bot', 3)); // Base Turret
    state.towers.push(createTower(2400, midY, 'bot', 2)); // Inner
    state.towers.push(createTower(1900, midY, 'bot', 1)); // Outer
}

function resetState() {
    state.entityIdCounter = 1;
    state.player = {
        id: getUniqueId(),
        x: CONFIG.SPAWNS.PLAYER.x, y: CONFIG.SPAWNS.PLAYER.y, angle: CONFIG.SPAWNS.PLAYER.angle,
        hp: CONFIG.PLAYER.BASE_HP, maxHp: CONFIG.PLAYER.BASE_HP, baseHp: CONFIG.PLAYER.BASE_HP,
        shield: CONFIG.PLAYER.MAX_SHIELD, maxShield: CONFIG.PLAYER.MAX_SHIELD,
        ammo: CONFIG.AMMO.MAX, reloading: false, reloadTimer: 0,
        cooldown: 0, dead: false, respawnTimer: 0, team: 'player',
        gold: 0, level: 1, baseDamage: CONFIG.PLAYER.BASE_DAMAGE,
        lastDamageTime: -10, // Initialized safely
        dashCooldown: 0, dashing: false, dashTimeLeft: 0,
        shieldSkillCooldown: 0, shieldSkillActive: false, shieldSkillTimeLeft: 0
    };
    state.bot = {
        id: getUniqueId(),
        x: CONFIG.SPAWNS.BOT.x, y: CONFIG.SPAWNS.BOT.y, angle: CONFIG.SPAWNS.BOT.angle,
        hp: CONFIG.BOT.BASE_HP, maxHp: CONFIG.BOT.BASE_HP, baseHp: CONFIG.BOT.BASE_HP,
        shield: CONFIG.BOT.MAX_SHIELD, maxShield: CONFIG.BOT.MAX_SHIELD,
        ammo: CONFIG.AMMO.MAX, reloading: false, reloadTimer: 0,
        cooldown: 0, dead: false, respawnTimer: 0, team: 'bot',
        gold: 0, level: 1, baseDamage: CONFIG.BOT.BASE_DAMAGE,
        targetMoveX: 0, targetMoveY: 0,
        lastDamageTime: -10, // Initialized safely
        dashCooldown: 0, dashing: false, dashTimeLeft: 0,
        shieldSkillCooldown: 0, shieldSkillActive: false, shieldSkillTimeLeft: 0
    };

    initTowers();
    state.minions = [];
    state.bullets = [];
    state.particles = [];
    state.hitMarkers = [];
    state.running = true;
    state.gameTime = 0;
    state.nextWaveTime = CONFIG.MINION.FIRST_WAVE_DELAY;
    state.lastTime = performance.now();
    camera = { x: 0, y: 0 };
    updateHUD(state);
}

function updateEntityReload(entity: Entity, dt: number) {
    if (entity.reloading) {
        entity.reloadTimer -= dt;
        if (entity.reloadTimer <= 0) {
            entity.reloading = false;
            entity.ammo = CONFIG.AMMO.MAX;
        }
    }
}

function applyDamage(target: Entity, damage: number) {
    let finalDamage = damage;
    
    // Shield Skill Reduction
    if (target.shieldSkillActive) {
        finalDamage *= (1 - CONFIG.SHIELD_SKILL.DAMAGE_REDUCTION);
    }

    if (target.shield && target.shield > 0) {
        target.shield -= finalDamage;
        // If shield breaks
        if (target.shield < 0) {
            const overflow = Math.abs(target.shield);
            target.shield = 0;
            target.hp -= overflow;
        }
    } else {
        target.hp -= finalDamage;
    }
}

function applyFountainHealing(entity: Entity, spawn: {x: number, y: number}, dt: number) {
    if (entity.dead) return;
    const dx = entity.x - spawn.x;
    const dy = entity.y - spawn.y;
    // Squared distance check
    if ((dx*dx + dy*dy) < CONFIG.FOUNTAIN.RADIUS**2) {
        // COMBAT CHECK: Do not heal if took damage recently
        if (state.gameTime - entity.lastDamageTime < CONFIG.FOUNTAIN.COMBAT_COOLDOWN) {
            return; 
        }

        // Heal HP
        if (entity.hp < entity.maxHp) {
            entity.hp = Math.min(entity.maxHp, entity.hp + CONFIG.FOUNTAIN.HEAL_RATE * dt);
        }
        // Recharge Shield
        if (entity.shield < entity.maxShield) {
            entity.shield = Math.min(entity.maxShield, entity.shield + CONFIG.FOUNTAIN.SHIELD_RATE * dt);
        }
        // Instant Reload
        if (entity.ammo < CONFIG.AMMO.MAX) {
            entity.ammo = CONFIG.AMMO.MAX;
            entity.reloading = false;
            entity.reloadTimer = 0;
        }
    }
}

function respawnEntity(entity: Entity, spawn: {x: number, y: number, angle: number}) {
    entity.dead = false;
    entity.hp = entity.maxHp;
    entity.shield = entity.maxShield;
    entity.ammo = CONFIG.AMMO.MAX;
    entity.x = spawn.x;
    entity.y = spawn.y;
    entity.angle = spawn.angle;
    entity.lastDamageTime = -10; // Reset combat timer
    entity.dashCooldown = 0;
    entity.dashing = false;
    entity.shieldSkillCooldown = 0;
    entity.shieldSkillActive = false;
}

// Check collision with ENEMY towers only, or neutral structures
function checkEnemyStructureCollision(x: number, y: number, r: number, myTeam: Team) {
    for (const t of state.towers) {
        if (t.dead) continue;
        // Allow walking through friendly towers
        if (t.team === myTeam) continue; 
        
        const dx = x - t.x;
        const dy = y - t.y;
        if ((dx*dx + dy*dy) < (t.radius + r)**2) return true;
    }
    return false;
}

function update(dt: number) {
    if (!state.running) return;
    state.gameTime += dt;

    // --- Fountain Healing ---
    applyFountainHealing(state.player, CONFIG.SPAWNS.PLAYER, dt);
    applyFountainHealing(state.bot, CONFIG.SPAWNS.BOT, dt);

    // --- Minion Spawner ---
    if (state.gameTime >= state.nextWaveTime) {
        spawnMinionWave(state);
        state.nextWaveTime += CONFIG.MINION.SPAWN_INTERVAL;
    }

    // --- Camera ---
    const { player: p, bot: b } = state;
    let camX = p.x - CONFIG.VIEWPORT.WIDTH / 2;
    let camY = p.y - CONFIG.VIEWPORT.HEIGHT / 2;
    camera.x = Math.max(0, Math.min(camX, CONFIG.WIDTH - CONFIG.VIEWPORT.WIDTH));
    camera.y = Math.max(0, Math.min(camY, CONFIG.HEIGHT - CONFIG.VIEWPORT.HEIGHT));

    // --- Player ---
    if (!p.dead) {
        Skills.update(p, dt);
        
        // Input Logic
        const move = Input.getMoveDir();
        if (Input.keys[' '] && Skills.tryDash(p)) {
            createParticles(p.x, p.y, '#fff', 5, 2);
        }
        if (Input.keys['shift'] && Skills.tryShield(p)) {
             // Shield activated sound/visual triggers could go here
        }

        // Movement Logic
        let moveX = 0;
        let moveY = 0;
        let speed = CONFIG.PLAYER.SPEED;

        if (p.dashing) {
            // Force movement in FACING direction (Angle)
            moveX = Math.cos(p.angle);
            moveY = Math.sin(p.angle);
            speed *= CONFIG.DASH.SPEED_MULTIPLIER;
        } else {
            // Standard Movement
            moveX = move.x;
            moveY = move.y;
        }

        let nextX = p.x + moveX * speed * dt;
        let nextY = p.y + moveY * speed * dt;
        
        if (!checkEnemyStructureCollision(nextX, p.y, CONFIG.PLAYER.RADIUS, 'player')) {
             moveEntity(p, moveX, 0, speed, dt, CONFIG.PLAYER.RADIUS);
        }
        if (!checkEnemyStructureCollision(p.x, nextY, CONFIG.PLAYER.RADIUS, 'player')) {
             moveEntity(p, 0, moveY, speed, dt, CONFIG.PLAYER.RADIUS);
        }

        const worldMouseX = Input.mouse.x + camera.x;
        const worldMouseY = Input.mouse.y + camera.y;
        p.angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
        
        updateEntityReload(p, dt);
        if ((p.ammo <= 0 || Input.keys.r) && !p.reloading && p.ammo < CONFIG.AMMO.MAX) {
            p.reloading = true;
            p.reloadTimer = CONFIG.AMMO.RELOAD_TIME;
        }

        p.cooldown -= dt;
        if (Input.mouse.down && !p.reloading && p.ammo > 0 && p.cooldown <= 0 && !p.dashing) {
            // DMG scaling based on gold
            const dmg = p.baseDamage + (p.gold * CONFIG.PLAYER.DMG_PER_GOLD);
            spawnBullet(p.x, p.y, p.angle, 'player', dmg, p.id);
            p.ammo--;
            p.cooldown = CONFIG.PLAYER.COOLDOWN;
        }
        if (p.hp <= 0) {
            p.dead = true;
            p.respawnTimer = CONFIG.PLAYER.RESPAWN_TIME;
            createParticles(p.x, p.y, CONFIG.PLAYER.COLOR, 15, 3);
        }
    } else {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) respawnEntity(p, CONFIG.SPAWNS.PLAYER);
    }

    // --- Bot ---
    if (!b.dead) {
        Skills.update(b, dt);
        updateEntityReload(b, dt);
        state.botTimer += dt;
        
        if (state.botTimer >= CONFIG.BOT.REACTION_TIME) {
            state.botTimer = 0;
            const action = getBotAction(state);
            b.targetMoveX = action.moveX;
            b.targetMoveY = action.moveY;
            b.angle = action.aimAngle;
            
            if (action.dash) {
                if (Skills.tryDash(b)) createParticles(b.x, b.y, '#fff', 5, 2);
            }
            if (action.shield) {
                Skills.tryShield(b);
            }

            if (action.reload && !b.reloading && b.ammo < CONFIG.AMMO.MAX) {
                b.reloading = true;
                b.reloadTimer = CONFIG.AMMO.RELOAD_TIME;
            }
            if (action.shoot && !b.reloading && b.ammo > 0 && b.cooldown <= 0 && !b.dashing) {
                const dmg = b.baseDamage + (b.gold * CONFIG.BOT.DMG_PER_GOLD);
                spawnBullet(b.x, b.y, b.angle, 'bot', dmg, b.id);
                b.ammo--;
                b.cooldown = CONFIG.BOT.COOLDOWN;
            }
        }
        b.cooldown -= dt;
        
        // Movement Logic
        let moveX = 0;
        let moveY = 0;
        let speed = CONFIG.BOT.SPEED;

        if (b.dashing) {
            moveX = Math.cos(b.angle);
            moveY = Math.sin(b.angle);
            speed *= CONFIG.DASH.SPEED_MULTIPLIER;
        } else {
            moveX = b.targetMoveX || 0;
            moveY = b.targetMoveY || 0;
        }

        let nextBX = b.x + moveX * speed * dt;
        let nextBY = b.y + moveY * speed * dt;
        if (!checkEnemyStructureCollision(nextBX, b.y, CONFIG.BOT.RADIUS, 'bot')) moveEntity(b, moveX, 0, speed, dt, CONFIG.BOT.RADIUS);
        if (!checkEnemyStructureCollision(b.x, nextBY, CONFIG.BOT.RADIUS, 'bot')) moveEntity(b, 0, moveY, speed, dt, CONFIG.BOT.RADIUS);

        if (b.hp <= 0) {
            b.dead = true;
            b.respawnTimer = CONFIG.PLAYER.RESPAWN_TIME;
            createParticles(b.x, b.y, CONFIG.BOT.COLOR, 15, 3);
        }
    } else {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) respawnEntity(b, CONFIG.SPAWNS.BOT);
    }

    // --- Logic Updates ---
    updateMinions(state, dt);
    updateTowers(state, dt);

    // --- Bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bul = state.bullets[i];
        bul.life -= dt;
        const nextX = bul.x + Math.cos(bul.angle) * CONFIG.BULLET.SPEED * dt;
        const nextY = bul.y + Math.sin(bul.angle) * CONFIG.BULLET.SPEED * dt;

        if (nextX < 0 || nextX > CONFIG.WIDTH || nextY < 0 || nextY > CONFIG.HEIGHT || bul.life <= 0) {
            if (bul.life <= 0) createParticles(bul.x, bul.y, bul.color || '#fff', 1, 0.5);
            state.bullets.splice(i, 1);
            continue;
        }
        if (checkWallCollision(nextX, nextY, CONFIG.BULLET.RADIUS)) {
            createParticles(nextX, nextY, '#aaa', 4, 1.5);
            state.bullets.splice(i, 1);
            continue;
        }

        // Generic Hit Handler
        let hit = false;
        let owner = bul.team === 'player' ? p : b;
        
        // 1. Entities
        const targets = [p, b];
        for (const t of targets) {
            if (!t.dead && t.team !== bul.team) {
                const dist = Math.sqrt((nextX - t.x)**2 + (nextY - t.y)**2);
                const r = t === p ? CONFIG.PLAYER.RADIUS : CONFIG.BOT.RADIUS;
                if (dist < r + CONFIG.BULLET.RADIUS) {
                    applyDamage(t, bul.damage); // Uses new shield logic
                    t.lastDamageTime = state.gameTime; // TRACK COMBAT TIME
                    createParticles(nextX, nextY, t.team === 'player' ? CONFIG.PLAYER.COLOR : CONFIG.BOT.COLOR, 5, 2);
                    
                    // SPAWN HIT MARKER
                    createHitMarker(nextX, nextY);

                    hit = true;
                    // Kill Reward
                     if (t.hp <= 0 && !t.dead) {
                        if (owner.team !== t.team) owner.gold += 300; 
                    }
                    break;
                }
            }
        }
        if (hit) { state.bullets.splice(i, 1); continue; }

        // 2. Minions
        for (const m of state.minions) {
            if (!m.dead && m.team !== bul.team) {
                const dist = Math.sqrt((nextX - m.x)**2 + (nextY - m.y)**2);
                if (dist < CONFIG.MINION.RADIUS + CONFIG.BULLET.RADIUS) {
                    m.hp -= bul.damage;
                    createParticles(nextX, nextY, '#fff', 2, 1);
                    if (m.hp <= 0 && !m.dead) {
                        m.dead = true;
                        createParticles(m.x, m.y, m.team === 'player' ? '#93c5fd' : '#fca5a5', 5, 1);
                        if (bul.team === 'player') state.player.gold += m.goldValue;
                        if (bul.team === 'bot') state.bot.gold += m.goldValue;
                    } 
                    hit = true;
                    break;
                }
            }
        }
        if (hit) { state.bullets.splice(i, 1); continue; }

        // 3. Towers
        for (const t of state.towers) {
            if (!t.dead && t.team !== bul.team) {
                const dist = Math.sqrt((nextX - t.x)**2 + (nextY - t.y)**2);
                if (dist < t.radius + CONFIG.BULLET.RADIUS) {
                    hit = true;
                    createParticles(nextX, nextY, t.color, 3, 1);
                    
                    // MLBB Rules: Cannot damage if Invulnerable
                    if (t.invulnerable) {
                        break; 
                    }
                    
                    // Energy Shield Absorption (Tier 1)
                    let finalDamage = bul.damage;
                    
                    // Backdoor Protection Check (No minions in range)
                    const friendlyMinionsNear = state.minions.some(m => 
                        !m.dead && m.team === bul.team && 
                        ((m.x - t.x)**2 + (m.y - t.y)**2) < (CONFIG.TOWER.RANGE + 50)**2
                    );
                    
                    if (!friendlyMinionsNear) {
                        finalDamage *= CONFIG.TOWER.BACKDOOR_REDUCTION;
                    }

                    if (t.tier === 1 && t.energyShield > 0) {
                        finalDamage *= 0.5;
                        t.energyShield -= finalDamage;
                        if (t.energyShield < 0) t.energyShield = 0;
                    } else {
                        t.hp -= finalDamage;
                    }

                    if (t.hp <= 0) {
                        t.dead = true;
                        createParticles(t.x, t.y, t.color, 30, 5); 
                        
                        // Award Gold
                        let reward = 0;
                        if (t.tier === 1) reward = CONFIG.TOWER.TIER_1.GOLD;
                        else if (t.tier === 2) reward = CONFIG.TOWER.TIER_2.GOLD;
                        else if (t.tier === 3) reward = CONFIG.TOWER.TIER_3.GOLD;
                        else reward = CONFIG.TOWER.NEXUS.GOLD;

                        if (bul.team === 'player') state.player.gold += reward;
                        else state.bot.gold += reward;

                        // Unlock next tier
                        unlockNextTier(state, t.team, t.tier);

                        if (t.tier === 4) checkWin();
                    }
                    break;
                }
            }
        }
        if (hit) { state.bullets.splice(i, 1); continue; }

        bul.x = nextX;
        bul.y = nextY;
    }

    // Minion Cleanup
    state.minions = state.minions.filter(m => !m.dead);

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const pt = state.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life <= 0) state.particles.splice(i, 1);
    }

    // Hit Markers
    for (let i = state.hitMarkers.length - 1; i >= 0; i--) {
        const hm = state.hitMarkers[i];
        hm.life -= dt;
        if (hm.life <= 0) state.hitMarkers.splice(i, 1);
    }

    // Update Entity Stats based on Gold
    updateStats(state.player);
    updateStats(state.bot);

    updateHUD(state);
}

function updateStats(ent: Entity) {
    // Scaling
    const goldFactor = ent.gold;
    ent.maxHp = ent.baseHp + (goldFactor * CONFIG.PLAYER.HP_PER_GOLD);
    // Heal proportional to max HP increase? Or just cap.
    if (ent.hp > ent.maxHp) ent.hp = ent.maxHp;
    
    // Level approximation: 1 level per 200 gold
    ent.level = 1 + Math.floor(ent.gold / 200);
}

function unlockNextTier(state: GameState, team: Team, destroyedTier: number) {
    // If Player destroys Bot Tier 1, Bot Tier 2 becomes vulnerable.
    // So we look for towers of the SAME team as the destroyed one, with Tier + 1
    const nextTier = destroyedTier + 1;
    const tower = state.towers.find(t => t.team === team && t.tier === nextTier);
    if (tower) {
        tower.invulnerable = false;
    }
}

function checkWin() {
    const pNexus = state.towers.find(t => t.team === 'player' && t.tier === 4);
    const bNexus = state.towers.find(t => t.team === 'bot' && t.tier === 4);

    if (pNexus && pNexus.dead) endGame("DEFEAT", "Your Nexus has been destroyed.");
    else if (bNexus && bNexus.dead) endGame("VICTORY", "Enemy Nexus destroyed.");
}

function endGame(title: string, msg: string) {
    state.running = false;
    document.getElementById('game-over-screen')!.classList.remove('hidden');
    const t = document.getElementById('outcome-title')!;
    t.innerText = title;
    t.className = title === "VICTORY" ? "win" : "lose";
    document.getElementById('outcome-message')!.innerText = msg;
}

function loop(timestamp: number) {
    if (state.running) {
        const dt = (timestamp - state.lastTime) / 1000;
        state.lastTime = timestamp;
        update(dt);
    }
    draw(ctx, state, camera);
    requestAnimationFrame(loop);
}

// Setup
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
Input.init(canvas);

document.getElementById('start-btn')?.addEventListener('click', () => {
    document.getElementById('start-screen')!.classList.add('hidden');
    resetState();
});

document.getElementById('restart-btn')?.addEventListener('click', () => {
    document.getElementById('game-over-screen')!.classList.add('hidden');
    resetState();
});

// INITIALIZE STATE BEFORE FIRST RENDER
resetState();
state.running = false; // Pause immediately so we wait for start button

draw(ctx, state, camera);
requestAnimationFrame(loop);