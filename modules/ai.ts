import { CONFIG } from './config';
import { GameState, Entity } from './types';
import { hasLineOfSight, checkWallCollision } from './physics';

// BOT AI V1.2 - Generic Implementation (Supports Player Autopilot)

export function getBotAction(gameState: GameState, me: Entity, enemy: Entity) {
    let action = { moveX: 0, moveY: 0, aimAngle: me.angle, shoot: false, reload: false, dash: false, shield: false };
    if (me.dead) return action;

    const spawn = me.team === 'player' ? CONFIG.SPAWNS.PLAYER : CONFIG.SPAWNS.BOT;
    const range = me.team === 'player' ? CONFIG.PLAYER.RANGE : CONFIG.BOT.RANGE;
    const aimError = me.team === 'player' ? 0 : CONFIG.BOT.AIM_ERROR; // Player bot has perfect aim (optional)

    // --- 1. STATE ANALYSIS ---
    const hpPercent = me.hp / me.maxHp;
    const distToEnemy = !enemy.dead ? Math.sqrt((enemy.x - me.x)**2 + (enemy.y - me.y)**2) : Infinity;
    
    // Check if in fountain
    const startX = spawn.x;
    const startY = spawn.y;
    const distToFountain = Math.sqrt((me.x - startX)**2 + (me.y - startY)**2);
    const inFountain = distToFountain < CONFIG.FOUNTAIN.RADIUS;

    // Determine Strategic Mode
    let mode: 'RETREAT' | 'ENGAGE' | 'FARM' | 'PUSH' = 'FARM';

    if (hpPercent < 0.25) {
        // Critical Health - Retreat
        mode = 'RETREAT';
    } else if (inFountain && hpPercent < 0.95) {
        // Hysteresis: If we are already healing, stay until full
        mode = 'RETREAT';
    } else if (!enemy.dead && distToEnemy < range * 1.5) {
        // If we have advantage, or enemy is close, fight
        if (hpPercent > 0.5 || distToEnemy < range) {
            mode = 'ENGAGE';
        }
    } else {
        // No enemy threat? Farm minions or Push towers
        mode = 'FARM';
    }

    // --- SKILL LOGIC: SHIELD ---
    if ((mode === 'ENGAGE' && hpPercent < 0.5) || (mode === 'RETREAT' && hpPercent < 0.3)) {
        action.shield = true;
    }

    // --- 2. TARGET SELECTION ---
    let target: {x: number, y: number} | null = null;
    let desiredDist = 0;

    if (mode === 'RETREAT') {
        // Run to own Spawn point (Fountain)
        target = { x: startX, y: startY };
        desiredDist = 0; // Go all the way
    } 
    else if (mode === 'ENGAGE') {
        target = enemy;
        desiredDist = range * 0.8; // Kite range
    } 
    else if (mode === 'FARM') {
        // Find lowest HP minion to last hit
        let bestMinion = null;
        let minHP = Infinity;
        
        for (const m of gameState.minions) {
            if (m.dead || m.team === me.team) continue;
            // Only care if close enough to be relevant
            const d = Math.sqrt((m.x - me.x)**2 + (m.y - me.y)**2);
            if (d < 800 && m.hp < minHP) {
                minHP = m.hp;
                bestMinion = m;
            }
        }

        if (bestMinion) {
            target = bestMinion;
            desiredDist = range * 0.9;
        } else {
            // No minions? Push closest enemy tower
            const enemyTowers = gameState.towers.filter(t => t.team !== me.team && !t.dead);
            // Sort by distance to me to find the closest one to push
            enemyTowers.sort((t1, t2) => {
                const d1 = (t1.x - me.x)**2 + (t1.y - me.y)**2;
                const d2 = (t2.x - me.x)**2 + (t2.y - me.y)**2;
                return d1 - d2;
            });
            
            if (enemyTowers.length > 0) {
                target = enemyTowers[0];
                desiredDist = range * 0.9;
            }
        }
    }

    // --- 3. MOVEMENT EXECUTION ---
    if (target) {
        const dx = target.x - me.x;
        const dy = target.y - me.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angleToTarget = Math.atan2(dy, dx);

        if (mode === 'RETREAT') {
             // Look where we are going
             action.aimAngle = Math.atan2(action.moveY, action.moveX); 
        } else {
             action.aimAngle = angleToTarget + (Math.random() - 0.5) * aimError;
        }

        // Tactical Movement Vector
        let moveDirX = 0;
        let moveDirY = 0;

        if (mode === 'RETREAT') {
            // Run straight there
            moveDirX = Math.cos(angleToTarget);
            moveDirY = Math.sin(angleToTarget);
            // DASH LOGIC: If retreating and far from fountain, DASH!
            if (dist > 500) action.dash = true;

        } else {
            // "Kiting" / Positioning Logic
            if (dist > desiredDist + 50) {
                // Gap Close
                moveDirX = Math.cos(angleToTarget);
                moveDirY = Math.sin(angleToTarget);
                // DASH LOGIC: Gap Close
                if (mode === 'ENGAGE' && dist > range + 200) action.dash = true;

            } else if (dist < desiredDist - 50) {
                // Back off
                moveDirX = -Math.cos(angleToTarget);
                moveDirY = -Math.sin(angleToTarget);
            } else {
                // Strafing (Orbit)
                const strafeDir = (gameState.gameTime % 2 > 1) ? 1 : -1;
                moveDirX = -Math.sin(angleToTarget) * strafeDir;
                moveDirY = Math.cos(angleToTarget) * strafeDir;
            }
        }

        // --- OBSTACLE AVOIDANCE ---
        const avoidanceLookAhead = 60;
        const radius = me.team === 'player' ? CONFIG.PLAYER.RADIUS : CONFIG.BOT.RADIUS;
        
        const checkCollision = (vx: number, vy: number) => {
            return checkWallCollision(me.x + vx * avoidanceLookAhead, me.y + vy * avoidanceLookAhead, radius + 5);
        };

        if (checkCollision(moveDirX, moveDirY)) {
            // Blocked! Try rotating left/right
            for (let i = 1; i <= 4; i++) {
                const angleOffset = (Math.PI / 4) * i;
                
                const leftX = Math.cos(Math.atan2(moveDirY, moveDirX) - angleOffset);
                const leftY = Math.sin(Math.atan2(moveDirY, moveDirX) - angleOffset);
                if (!checkCollision(leftX, leftY)) {
                    moveDirX = leftX;
                    moveDirY = leftY;
                    break;
                }
                
                const rightX = Math.cos(Math.atan2(moveDirY, moveDirX) + angleOffset);
                const rightY = Math.sin(Math.atan2(moveDirY, moveDirX) + angleOffset);
                if (!checkCollision(rightX, rightY)) {
                    moveDirX = rightX;
                    moveDirY = rightY;
                    break;
                }
            }
        }

        action.moveX = moveDirX;
        action.moveY = moveDirY;

        // Shooting Logic
        if ((mode === 'ENGAGE' || mode === 'FARM') && dist < range + 50) {
            if (hasLineOfSight(me.x, me.y, target.x, target.y)) {
                action.shoot = true;
            }
        }
    }

    // Auto Reload
    if (me.ammo <= 0 && !me.reloading) action.reload = true;
    if (mode === 'RETREAT' && me.ammo < CONFIG.AMMO.MAX) action.reload = true; 

    return action;
}