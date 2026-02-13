import { CONFIG } from './config';
import { GameState, Minion, Tower, Bullet, Entity, Team } from './types';
import { hasLineOfSight } from './physics';

function getUniqueId(state: GameState): number {
    return state.entityIdCounter++;
}

// --- MINIONS ---

export function spawnMinionWave(state: GameState) {
    const offset = 40; // Spacing
    
    const minutes = state.gameTime / 60;
    const currentHP = CONFIG.MINION.HP + (minutes * CONFIG.MINION.HP_SCALING_PER_MIN);
    const currentDamage = CONFIG.MINION.DAMAGE + (minutes * CONFIG.MINION.DMG_SCALING_PER_MIN);

    // Player Minions
    for (let i = 0; i < CONFIG.MINION.COUNT_PER_WAVE; i++) {
        state.minions.push({
            id: getUniqueId(state),
            x: CONFIG.SPAWNS.PLAYER.x + (Math.random() * offset - offset/2),
            y: CONFIG.SPAWNS.PLAYER.y + (Math.random() * offset - offset/2),
            hp: currentHP,
            maxHp: currentHP,
            angle: Math.PI / 4,
            team: 'player',
            dead: false,
            cooldown: 0,
            damage: currentDamage,
            type: 'melee',
            goldValue: CONFIG.MINION.GOLD_REWARD
        });
    }

    // Bot Minions
    for (let i = 0; i < CONFIG.MINION.COUNT_PER_WAVE; i++) {
        state.minions.push({
            id: getUniqueId(state),
            x: CONFIG.SPAWNS.BOT.x + (Math.random() * offset - offset/2),
            y: CONFIG.SPAWNS.BOT.y + (Math.random() * offset - offset/2),
            hp: currentHP,
            maxHp: currentHP,
            angle: -Math.PI * 0.75,
            team: 'bot',
            dead: false,
            cooldown: 0,
            damage: currentDamage,
            type: 'melee',
            goldValue: CONFIG.MINION.GOLD_REWARD
        });
    }
}

export function updateMinions(state: GameState, dt: number) {
    state.minions.forEach(m => {
        if (m.dead) return;

        m.cooldown -= dt;

        // 1. Find Attack Target (Unit/Structure in Range)
        const target = findClosestEnemy(state, m.x, m.y, m.team, CONFIG.MINION.RANGE);
        
        if (target) {
            // Attack Mode
            const dx = target.x - m.x;
            const dy = target.y - m.y;
            m.angle = Math.atan2(dy, dx);

            if (m.cooldown <= 0) {
                state.bullets.push({
                    x: m.x + Math.cos(m.angle) * 10,
                    y: m.y + Math.sin(m.angle) * 10,
                    angle: m.angle,
                    team: m.team,
                    damage: m.damage,
                    life: CONFIG.MINION.RANGE / CONFIG.BULLET.SPEED,
                    color: m.team === 'player' ? '#93c5fd' : '#fca5a5',
                    sourceId: m.id
                });
                m.cooldown = CONFIG.MINION.COOLDOWN;
            }
        } else {
            // Move Mode - Find Next Structure Objective
            let objective: {x: number, y: number, radius: number} | undefined;
            const enemyTowers = state.towers.filter(t => t.team !== m.team && !t.dead);
            
            if (m.team === 'player') {
                enemyTowers.sort((a, b) => a.x - b.x);
                objective = enemyTowers[0];
            } else {
                enemyTowers.sort((a, b) => b.x - a.x);
                objective = enemyTowers[0];
            }

            if (objective) {
                const dx = objective.x - m.x;
                const dy = objective.y - m.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > CONFIG.MINION.RADIUS + objective.radius) {
                    m.angle = Math.atan2(dy, dx);
                    m.x += Math.cos(m.angle) * CONFIG.MINION.SPEED * dt;
                    m.y += Math.sin(m.angle) * CONFIG.MINION.SPEED * dt;
                }
            }
        }
    });
}

// --- TOWERS ---

export function updateTowers(state: GameState, dt: number) {
    state.towers.forEach(t => {
        if (t.dead) return;
        if (t.tier === 4) return; // Nexus doesn't shoot in this simple version

        t.cooldown -= dt;

        if (t.cooldown <= 0) {
            // Priority:
            // 1. Enemy Hero attacking Ally Hero (Complex check, skipping "Attack Ally" detection for V1 simplicity)
            // 2. Minions
            // 3. Hero
            
            // Simplified Priority: Closest Minion -> Closest Hero
            
            let target = null;
            let minDist = Infinity;

            // Check Minions First
            state.minions.forEach(m => {
                if (!m.dead && m.team !== t.team) {
                    const dist = Math.sqrt((m.x - t.x)**2 + (m.y - t.y)**2);
                    if (dist <= CONFIG.TOWER.RANGE && dist < minDist) {
                        target = m;
                        minDist = dist;
                    }
                }
            });

            // If no minion, check Heroes
            if (!target) {
                const enemies = t.team === 'player' ? [state.bot] : [state.player];
                enemies.forEach(e => {
                    if (!e.dead) {
                        const dist = Math.sqrt((e.x - t.x)**2 + (e.y - t.y)**2);
                        if (dist <= CONFIG.TOWER.RANGE && dist < minDist) {
                            target = e;
                            minDist = dist;
                        }
                    }
                });
            }

            if (target) {
                const dx = target.x - t.x;
                const dy = target.y - t.y;
                const angle = Math.atan2(dy, dx);
                
                // Damage Stacking Logic
                if (t.lastTargetId === target.id) {
                    t.consecutiveHits = Math.min(t.consecutiveHits + 1, CONFIG.TOWER.MAX_STACKS);
                } else {
                    t.lastTargetId = target.id;
                    t.consecutiveHits = 0;
                }

                let baseDmg = 0;
                if (t.tier === 1) baseDmg = CONFIG.TOWER.TIER_1.DMG;
                else if (t.tier === 2) baseDmg = CONFIG.TOWER.TIER_2.DMG;
                else baseDmg = CONFIG.TOWER.TIER_3.DMG;

                const stackedDmg = baseDmg * (1 + (t.consecutiveHits * CONFIG.TOWER.DAMAGE_STACK));

                // Shoot
                state.bullets.push({
                    x: t.x + Math.cos(angle) * (t.radius + 5),
                    y: t.y + Math.sin(angle) * (t.radius + 5),
                    angle: angle,
                    team: t.team,
                    damage: stackedDmg,
                    life: CONFIG.TOWER.RANGE / CONFIG.BULLET.SPEED,
                    color: t.team === 'player' ? '#1d4ed8' : '#b91c1c',
                    sourceId: t.id
                });
                t.cooldown = CONFIG.TOWER.COOLDOWN;
            } else {
                // Reset stacks if no target found
                t.lastTargetId = null;
                t.consecutiveHits = 0;
            }
        }
    });
}

function findClosestEnemy(state: GameState, x: number, y: number, myTeam: Team, range: number): {x: number, y: number, id: number} | null {
    let closest: {x: number, y: number, id: number, dist: number} | null = null;

    const updateClosest = (ent: {x: number, y: number, id: number}, dist: number) => {
        if (!closest || dist < closest.dist) {
            closest = { x: ent.x, y: ent.y, id: ent.id, dist };
        }
    };

    // 1. Check Minions
    for (const m of state.minions) {
        if (m.dead || m.team === myTeam) continue;
        const dx = m.x - x;
        const dy = m.y - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= range && hasLineOfSight(x, y, m.x, m.y)) {
             updateClosest(m, dist);
        }
    }

    if (closest) return closest;

    // 2. Check Heroes
    const enemies = myTeam === 'player' ? [state.bot] : [state.player];
    for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= range && hasLineOfSight(x, y, e.x, e.y)) {
            updateClosest(e, dist);
        }
    }

    // 3. Check Towers
    for (const t of state.towers) {
        if (t.dead || t.team === myTeam || t.tier === 4) continue; // Minions usually don't shoot nexus?
        const dx = t.x - x;
        const dy = t.y - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= range && hasLineOfSight(x, y, t.x, t.y)) {
            updateClosest(t, dist);
        }
    }

    return closest ? closest : null;
}