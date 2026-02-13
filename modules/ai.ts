import { CONFIG } from './config';
import { GameState, Entity } from './types';
import { hasLineOfSight, checkWallCollision } from './physics';

// BOT AI V1.3 - Improved Targeting & Aggression

export function getBotAction(gameState: GameState, me: Entity, enemy: Entity) {
    let action = { moveX: 0, moveY: 0, aimAngle: me.angle, shoot: false, reload: false, dash: false, shield: false };
    if (me.dead) return action;

    const spawn = me.team === 'player' ? CONFIG.SPAWNS.PLAYER : CONFIG.SPAWNS.BOT;
    const range = me.team === 'player' ? CONFIG.PLAYER.RANGE : CONFIG.BOT.RANGE;
    const aimError = me.team === 'player' ? 0 : CONFIG.BOT.AIM_ERROR; 

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
        mode = 'RETREAT';
    } else if (inFountain && hpPercent < 0.95) {
        // Stay in fountain until almost full if we are already there
        mode = 'RETREAT';
    } else if (!enemy.dead && distToEnemy < range * 1.5) {
        // Fight if enemy is close or we are healthy
        if (hpPercent > 0.4 || distToEnemy < range) {
            mode = 'ENGAGE';
        }
    } else {
        mode = 'FARM';
    }

    // --- SKILL LOGIC ---
    if ((mode === 'ENGAGE' && hpPercent < 0.5) || (mode === 'RETREAT' && hpPercent < 0.3)) {
        action.shield = true;
    }

    // --- 2. TARGET SELECTION ---
    let target: {x: number, y: number} | null = null;
    let desiredDist = 0;

    if (mode === 'RETREAT') {
        target = { x: startX, y: startY };
        desiredDist = 0; 
    } 
    else if (mode === 'ENGAGE') {
        target = enemy;
        desiredDist = range * 0.8; 
    } 
    else if (mode === 'FARM') {
        // 1. Prioritize Minions (Global range, no limit)
        let bestMinion = null;
        let minHP = Infinity;
        let closestMinionDist = Infinity;
        
        for (const m of gameState.minions) {
            if (m.dead || m.team === me.team) continue;
            
            const d = Math.sqrt((m.x - me.x)**2 + (m.y - me.y)**2);
            // Prioritize low HP minions for last hitting, but also consider distance
            const score = m.hp + (d * 0.5); 
            
            if (score < minHP) {
                minHP = score;
                bestMinion = m;
                closestMinionDist = d;
            }
        }

        if (bestMinion) {
            target = bestMinion;
            desiredDist = range * 0.9;
        } else {
            // 2. No Minions? Push Towers
            const enemyTowers = gameState.towers.filter(t => t.team !== me.team && !t.dead);
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
    let moveDirX = 0;
    let moveDirY = 0;

    if (target) {
        const dx = target.x - me.x;
        const dy = target.y - me.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angleToTarget = Math.atan2(dy, dx);

        if (mode === 'RETREAT') {
             action.aimAngle = Math.atan2(action.moveY, action.moveX); 
        } else {
             action.aimAngle = angleToTarget + (Math.random() - 0.5) * aimError;
        }

        if (mode === 'RETREAT') {
            moveDirX = Math.cos(angleToTarget);
            moveDirY = Math.sin(angleToTarget);
            if (dist > 500) action.dash = true;
        } else {
            // Kiting / Positioning
            if (dist > desiredDist + 50) {
                // Move towards
                moveDirX = Math.cos(angleToTarget);
                moveDirY = Math.sin(angleToTarget);
                if (mode === 'ENGAGE' && dist > range + 200) action.dash = true;
            } else if (dist < desiredDist - 50) {
                // Back off
                moveDirX = -Math.cos(angleToTarget);
                moveDirY = -Math.sin(angleToTarget);
            } else {
                // Strafe
                const strafeDir = (gameState.gameTime % 2 > 1) ? 1 : -1;
                moveDirX = -Math.sin(angleToTarget) * strafeDir;
                moveDirY = Math.cos(angleToTarget) * strafeDir;
            }
        }
    } else {
        // Fallback: If no target (rare), move to Center of Map
        // This ensures bot never gets stuck doing nothing
        if (mode !== 'RETREAT') {
            const centerX = CONFIG.WIDTH / 2;
            const centerY = CONFIG.HEIGHT / 2;
            const angleToCenter = Math.atan2(centerY - me.y, centerX - me.x);
            moveDirX = Math.cos(angleToCenter);
            moveDirY = Math.sin(angleToCenter);
            action.aimAngle = angleToCenter;
        }
    }

    // --- OBSTACLE AVOIDANCE ---
    const avoidanceLookAhead = 80; // Increased lookahead
    const radius = me.team === 'player' ? CONFIG.PLAYER.RADIUS : CONFIG.BOT.RADIUS;
    
    const checkCollision = (vx: number, vy: number) => {
        return checkWallCollision(me.x + vx * avoidanceLookAhead, me.y + vy * avoidanceLookAhead, radius + 5);
    };

    if (checkCollision(moveDirX, moveDirY)) {
        // Simple whiskers detection
        let bestDirX = moveDirX;
        let bestDirY = moveDirY;
        let foundPath = false;

        // Check 8 directions
        for (let i = 1; i <= 4; i++) {
            const angleOffset = (Math.PI / 4) * i;
            const baseAngle = Math.atan2(moveDirY, moveDirX);

            // Left turn
            const leftX = Math.cos(baseAngle - angleOffset);
            const leftY = Math.sin(baseAngle - angleOffset);
            if (!checkCollision(leftX, leftY)) {
                bestDirX = leftX;
                bestDirY = leftY;
                foundPath = true;
                break;
            }
            
            // Right turn
            const rightX = Math.cos(baseAngle + angleOffset);
            const rightY = Math.sin(baseAngle + angleOffset);
            if (!checkCollision(rightX, rightY)) {
                bestDirX = rightX;
                bestDirY = rightY;
                foundPath = true;
                break;
            }
        }
        
        if (foundPath) {
            moveDirX = bestDirX;
            moveDirY = bestDirY;
        }
    }

    action.moveX = moveDirX;
    action.moveY = moveDirY;

    // Shooting Logic
    if ((mode === 'ENGAGE' || mode === 'FARM') && target) {
        const dx = target.x - me.x;
        const dy = target.y - me.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < range + 50) {
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