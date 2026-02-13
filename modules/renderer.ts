import { CONFIG } from './config';
import { Entity, GameState, Tower, Minion, HitMarker } from './types';

export function draw(ctx: CanvasRenderingContext2D, state: GameState, camera: {x: number, y: number}) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Background
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    
    // Mid Lane
    ctx.fillStyle = '#334155'; 
    ctx.fillRect(0, 250, CONFIG.WIDTH, 400); // Expanded slightly for better movement

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= CONFIG.WIDTH; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.HEIGHT); }
    for (let y = 0; y <= CONFIG.HEIGHT; y += 100) { ctx.moveTo(0, y); ctx.lineTo(CONFIG.WIDTH, y); }
    ctx.stroke();

    // River
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; 
    ctx.fillRect(750, 250, 100, 400);

    // Fountains (Healing Zones)
    drawFountain(ctx, CONFIG.SPAWNS.PLAYER.x, CONFIG.SPAWNS.PLAYER.y, '#4ade80');
    drawFountain(ctx, CONFIG.SPAWNS.BOT.x, CONFIG.SPAWNS.BOT.y, '#f87171');

    // Ranges
    if (!state.player.dead) drawRangeCircle(ctx, state.player.x, state.player.y, CONFIG.PLAYER.RANGE, 'player');
    if (!state.bot.dead) drawRangeCircle(ctx, state.bot.x, state.bot.y, CONFIG.BOT.RANGE, 'bot');
    state.towers.forEach(t => {
        if (!t.dead && t.tier !== 4) drawRangeCircle(ctx, t.x, t.y, CONFIG.TOWER.RANGE, t.team);
    });

    // Structures
    state.towers.forEach(t => drawTower(ctx, t));

    // Minions
    state.minions.forEach(m => drawMinion(ctx, m));

    // Obstacles
    ctx.fillStyle = '#0f172a'; 
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    for (const obs of CONFIG.OBSTACLES) {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(obs.x, obs.y, obs.w, 5); 
        ctx.fillStyle = '#0f172a';
    }

    // Characters
    if (!state.player.dead) drawCharacter(ctx, state.player, CONFIG.PLAYER.COLOR, true);
    if (!state.bot.dead) drawCharacter(ctx, state.bot, CONFIG.BOT.COLOR, false);

    // Bullets
    for (const b of state.bullets) {
        ctx.fillStyle = b.color || '#fbbf24';
        ctx.beginPath();
        ctx.arc(b.x, b.y, CONFIG.BULLET.RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }

    // Particles
    for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    
    // Hit Markers
    for (const hm of state.hitMarkers) {
        drawHitMarker(ctx, hm);
    }

    // Border
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    ctx.restore();

    // Minimap
    drawMinimap(ctx, state);
    
    // Respawn Text
    if (state.player.dead) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RESPAWNING IN ${Math.ceil(state.player.respawnTimer)}...`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function drawHitMarker(ctx: CanvasRenderingContext2D, hm: HitMarker) {
    ctx.save();
    ctx.translate(hm.x, hm.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = hm.life * 5; // Fade out fast. life starts at 0.2, so 0.2*5 = 1.0

    const size = 6;
    ctx.beginPath();
    ctx.moveTo(-size, -size);
    ctx.lineTo(size, size);
    ctx.moveTo(size, -size);
    ctx.lineTo(-size, size);
    ctx.stroke();

    ctx.restore();
}

function drawFountain(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.FOUNTAIN.RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Icon or Text
    ctx.fillStyle = color;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("FOUNTAIN", x, y - CONFIG.FOUNTAIN.RADIUS + 20);
}

function drawRangeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, team: string) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (team === 'player') {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.05)';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.1)';
    } else {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.05)';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.1)';
    }
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawTower(ctx: CanvasRenderingContext2D, t: Tower) {
    if (t.dead) return;

    ctx.fillStyle = t.color;
    ctx.strokeStyle = t.invulnerable ? '#fbbf24' : '#fff'; // Gold outline if invulnerable
    ctx.lineWidth = t.tier === 4 ? 4 : (t.tier === 1 ? 2 : 3);
    
    ctx.beginPath();
    if (t.tier === 4) { // Nexus (Octagon)
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45) * Math.PI / 180;
            const x = t.x + Math.cos(angle) * t.radius;
            const y = t.y + Math.sin(angle) * t.radius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    } else if (t.tier === 3) { // Base Turret (Square)
        ctx.rect(t.x - t.radius, t.y - t.radius, t.radius*2, t.radius*2);
    } else { // Turret (Circle)
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Shield Visual
    if (t.energyShield > 0) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Health Bar
    const hpPct = t.hp / t.maxHp;
    const barW = t.radius * 2;
    const barH = 6;
    ctx.fillStyle = '#000';
    ctx.fillRect(t.x - barW/2, t.y - t.radius - 12, barW, barH);
    ctx.fillStyle = hpPct < 0.3 ? '#ef4444' : '#22c55e';
    ctx.fillRect(t.x - barW/2 + 1, t.y - t.radius - 11, (barW - 2) * hpPct, barH - 2);

    if (t.invulnerable) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('IMMUNE', t.x, t.y - t.radius - 16);
    }
}

function drawMinion(ctx: CanvasRenderingContext2D, m: Minion) {
    if (m.dead) return;
    
    ctx.fillStyle = m.team === 'player' ? '#60a5fa' : '#f87171';
    ctx.beginPath();
    ctx.arc(m.x, m.y, CONFIG.MINION.RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    const hpPct = m.hp / m.maxHp;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(m.x - 10, m.y - 12, 20, 3);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(m.x - 10, m.y - 12, 20 * hpPct, 3);
}

function drawCharacter(ctx: CanvasRenderingContext2D, entity: Entity, color: string, isPlayer: boolean) {
    const r = isPlayer ? CONFIG.PLAYER.RADIUS : CONFIG.BOT.RADIUS;

    // SHIELD SKILL VISUAL (Force Field)
    if (entity.shieldSkillActive) {
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, r + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 211, 238, 0.2)'; // Cyan transparent
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
        ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, r, 0, Math.PI * 2);
    ctx.fill();
    
    if (entity.shield > 0) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke(); 

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(entity.x, entity.y);
    const barrel = 25;
    ctx.lineTo(entity.x + Math.cos(entity.angle) * barrel, entity.y + Math.sin(entity.angle) * barrel);
    ctx.stroke();
    
    // Level Badge
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(entity.x + 10, entity.y + 10, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    
    // SAFE ACCESS: Accessing toString on potentially undefined property caused the error
    const lvl = (entity.level || 1).toString();
    ctx.fillText(lvl, entity.x + 10, entity.y + 13);

    if (entity.reloading) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RELOAD', entity.x, entity.y - 25);
    }
}

function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState) {
    const margin = 20;
    const width = 200;
    const height = width * (CONFIG.HEIGHT / CONFIG.WIDTH);
    const scale = width / CONFIG.WIDTH;
    const x = ctx.canvas.width - width - margin;
    const y = ctx.canvas.height - height - margin;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(x, y, width, height);

    state.towers.forEach(t => {
        if (t.dead) return;
        ctx.fillStyle = t.team === 'player' ? CONFIG.TOWER.COLOR_PLAYER : CONFIG.TOWER.COLOR_BOT;
        const size = (t.tier === 4 ? 6 : 4);
        ctx.fillRect(x + t.x * scale - size/2, y + t.y * scale - size/2, size, size);
    });

    state.minions.forEach(m => {
        if (m.dead) return;
        ctx.fillStyle = m.team === 'player' ? '#60a5fa' : '#f87171';
        ctx.fillRect(x + m.x * scale - 1, y + m.y * scale - 1, 2, 2);
    });

    if (!state.player.dead) {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(x + state.player.x * scale, y + state.player.y * scale, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    if (!state.bot.dead) {
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(x + state.bot.x * scale, y + state.bot.y * scale, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function updateHUD(state: GameState) {
    const p = state.player;
    const b = state.bot;

    const pHp = Math.max(0, (p.hp / p.maxHp) * 100);
    const bHp = Math.max(0, (b.hp / b.maxHp) * 100);
    
    document.getElementById('p1-health-fill')!.style.width = `${pHp}%`;
    document.getElementById('p2-health-fill')!.style.width = `${bHp}%`;

    const pShield = Math.max(0, (p.shield / p.maxShield) * 100);
    const bShield = Math.max(0, (b.shield / b.maxShield) * 100);
    
    document.getElementById('p1-shield-fill')!.style.width = `${pShield}%`;
    document.getElementById('p2-shield-fill')!.style.width = `${bShield}%`;

    const ammoEl = document.getElementById('ammo-display')!;
    if (p.reloading) {
        ammoEl.innerText = "RELOAD...";
        ammoEl.style.color = "#facc15";
    } else {
        ammoEl.innerText = `${p.ammo} / ${CONFIG.AMMO.MAX} [R]`;
        ammoEl.style.color = p.ammo === 0 ? "#f87171" : "#ccc";
    }

    // Gold & Levels
    const pGold = p.gold || 0;
    const bGold = b.gold || 0;
    
    document.getElementById('p1-gold')!.innerText = Math.floor(pGold).toString();
    document.getElementById('p2-gold')!.innerText = Math.floor(bGold).toString();
    document.getElementById('p1-lvl')!.innerText = `(LVL ${p.level || 1})`;
    document.getElementById('p2-lvl')!.innerText = `(LVL ${b.level || 1})`;

    // UPDATE SKILL COOLDOWNS (HUD)
    const dashPct = Math.min(100, Math.max(0, (p.dashCooldown / CONFIG.DASH.COOLDOWN) * 100));
    const shieldPct = Math.min(100, Math.max(0, (p.shieldSkillCooldown / CONFIG.SHIELD_SKILL.COOLDOWN) * 100));

    // Update Dash Icon
    document.getElementById('dash-overlay')!.style.height = `${dashPct}%`;
    document.getElementById('dash-text')!.innerText = p.dashCooldown > 0 ? Math.ceil(p.dashCooldown).toString() : '';

    // Update Shield Icon
    document.getElementById('shield-overlay')!.style.height = `${shieldPct}%`;
    document.getElementById('shield-text')!.innerText = p.shieldSkillCooldown > 0 ? Math.ceil(p.shieldSkillCooldown).toString() : '';
}