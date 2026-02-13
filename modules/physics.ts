import { CONFIG } from './config';
import { Entity } from './types';

export function checkWallCollision(x: number, y: number, radius: number) {
    for (const obs of CONFIG.OBSTACLES) {
        const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.w));
        const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.h));
        const dx = x - closestX;
        const dy = y - closestY;
        if ((dx * dx + dy * dy) <= (radius * radius)) return true;
    }
    return false;
}

export function moveEntity(entity: Entity, dirX: number, dirY: number, speed: number, dt: number, radius: number) {
    if (dirX === 0 && dirY === 0) return;

    let nextX = entity.x + dirX * speed * dt;
    let nextY = entity.y + dirY * speed * dt;

    // Boundary Clamp
    nextX = Math.max(radius, Math.min(CONFIG.WIDTH - radius, nextX));
    nextY = Math.max(radius, Math.min(CONFIG.HEIGHT - radius, nextY));

    // Slide along walls
    if (!checkWallCollision(nextX, entity.y, radius)) entity.x = nextX;
    if (!checkWallCollision(entity.x, nextY, radius)) entity.y = nextY;
}

export function hasLineOfSight(x1: number, y1: number, x2: number, y2: number) {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const checkX = x1 + (x2 - x1) * t;
        const checkY = y1 + (y2 - y1) * t;
        if (checkWallCollision(checkX, checkY, 2)) return false;
    }
    return true;
}