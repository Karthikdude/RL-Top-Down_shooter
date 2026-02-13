import { CONFIG } from './config';
import { GameState } from './types';
import { hasLineOfSight, checkWallCollision } from './physics';

// BOT AI V1.1 - "The Pro Update"
// Features: Obstacle Avoidance, Kiting, Strafing, Smart Farming, Dashing, Shielding

export function getBotAction(gameState: GameState) {
    const b = gameState.bot;
    const p = gameState.player;
    
    let action = { moveX: 0, moveY: 0, aimAngle: b.angle, shoot: false, reload: false, dash: false, shield: false };
    if (b.dead) return action;

    // --- 1. STATE ANALYSIS ---
    const hpPercent = b.hp / b.maxHp;
    const ammoPercent = b.ammo / CONFIG.AMMO.MAX;
    const distToPlayer = !p.dead ? Math.sqrt((p.x - b.x)**2 + (p.y - b.y)**2) : Infinity;
    
    // Check if in fountain
    const startX = CONFIG.SPAWNS.BOT.x;
    const startY = CONFIG.SPAWNS.BOT.y;
    const distToFountain = Math.sqrt((b.x - startX)**2 + (b.y - startY)**2);
    const inFountain = distToFountain < CONFIG.FOUNTAIN.RADIUS;

    // Determine Strategic Mode
    let mode: 'RETREAT' | 'ENGAGE' | 'FARM' | 'PUSH' = 'FARM';

    if (hpPercent < 0.25) {
        // Critical Health - Retreat
        mode = 'RETREAT';
    } else if (inFountain && hpPercent < 0.95) {
        // Hysteresis: If we are already healing, stay until full
        mode = 'RETREAT';
    } else if (!p.dead && distToPlayer < CONFIG.BOT.RANGE * 1.5) {
        // If we have advantage, or player is close, fight
        if (hpPercent > 0.5 || distToPlayer < CONFIG.BOT.RANGE) {
            mode = 'ENGAGE';
        }
    } else {
        // No player threat? Farm minions or Push towers
        mode = 'FARM';
    }

    // --- SKILL LOGIC: SHIELD ---
    // Use shield if fighting and HP is getting low, or if retreating critically
    if ((mode === 'ENGAGE' && hpPercent < 0.5) || (mode === 'RETREAT' && hpPercent < 0.3)) {
        action.shield = true;
    }

    // --- 2. TARGET SELECTION ---
    let target: {x: number, y: number, vx?: number, vy?: number} | null = null;
    let desiredDist = 0;

    if (mode === 'RETREAT') {
        // Run to own Spawn point (Fountain)
        target = { x: CONFIG.SPAWNS.BOT.x, y: CONFIG.SPAWNS.BOT.y };
        desiredDist = 0; // Go all the way
    } 
    else if (mode === 'ENGAGE') {
        target = p;
        desiredDist = CONFIG.BOT.RANGE * 0.8; // Kite range
    } 
    else if (mode === 'FARM') {
        // Find lowest HP minion to last hit
        let bestMinion = null;
        let minHP = Infinity;
        
        for (const m of gameState.minions) {
            if (m.dead || m.team === 'bot') continue;
            // Only care if close enough to be relevant
            const d = Math.sqrt((m.x - b.x)**2 + (m.y - b.y)**2);
            if (d < 800 && m.hp < minHP) {
                minHP = m.hp;
                bestMinion = m;
            }
        }

        if (bestMinion) {
            target = bestMinion;
            desiredDist = CONFIG.BOT.RANGE * 0.9;
        } else {
            // No minions? Push closest tower
            const enemyTowers = gameState.towers.filter(t => t.team === 'player' && !t.dead);
            enemyTowers.sort((t1, t2) => t2.x - t1.x); // Closest to bot side
            
            let closestT = null;
            let closestD = Infinity;
            for(const t of enemyTowers) {
                const d = Math.sqrt((t.x - b.x)**2 + (t.y - b.y)**2);
                if (d < closestD) { closestD = d; closestT = t; }
            }
            if (closestT) {
                target = closestT;
                desiredDist = CONFIG.BOT.RANGE * 0.9;
            }
        }
    }

    // --- 3. MOVEMENT EXECUTION ---
    if (target) {
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angleToTarget = Math.atan2(dy, dx);

        if (mode === 'RETREAT') {
             // Look where we are going
             action.aimAngle = Math.atan2(action.moveY, action.moveX); 
        } else {
             action.aimAngle = angleToTarget + (Math.random() - 0.5) * CONFIG.BOT.AIM_ERROR;
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
                if (mode === 'ENGAGE' && dist > CONFIG.BOT.RANGE + 200) action.dash = true;

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
        const checkCollision = (vx: number, vy: number) => {
            return checkWallCollision(b.x + vx * avoidanceLookAhead, b.y + vy * avoidanceLookAhead, CONFIG.BOT.RADIUS + 5);
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
        if ((mode === 'ENGAGE' || mode === 'FARM') && dist < CONFIG.BOT.RANGE + 50) {
            if (hasLineOfSight(b.x, b.y, target.x, target.y)) {
                action.shoot = true;
            }
        }
    }

    // Auto Reload
    if (b.ammo <= 0 && !b.reloading) action.reload = true;
    if (mode === 'RETREAT' && b.ammo < CONFIG.AMMO.MAX) action.reload = true; 

    return action;
}