import { CONFIG } from './modules/config';
import { Input } from './modules/input';
import { draw, updateHUD } from './modules/renderer';
import { Game } from './modules/game';
import { InputState } from './modules/types';

let camera = { x: 0, y: 0 };

// Setup
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
Input.init(canvas);

// INITIALIZE STATE
Game.resetState();
Game.state.running = false;

function endGame(title: string, msg: string) {
    Game.state.running = false;
    document.getElementById('game-over-screen')!.classList.remove('hidden');
    const t = document.getElementById('outcome-title')!;
    t.innerText = title;
    t.className = title === "VICTORY" ? "win" : "lose";
    document.getElementById('outcome-message')!.innerText = msg;
}

function loop(timestamp: number) {
    if (Game.state.running) {
        const dt = (timestamp - Game.state.lastTime) / 1000;
        Game.state.lastTime = timestamp;

        // Construct Input State from Browser Input
        const move = Input.getMoveDir();
        const worldMouseX = Input.mouse.x + camera.x;
        const worldMouseY = Input.mouse.y + camera.y;
        const p = Game.state.player;
        const aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);

        const inputState: InputState = {
            moveX: move.x,
            moveY: move.y,
            aimAngle: aimAngle,
            shoot: Input.mouse.down,
            reload: Input.keys.r,
            dash: Input.keys[' '],
            shield: Input.keys['shift']
        };

        Game.update(dt, inputState);

        if (Game.state.outcome) {
            if (Game.state.outcome === "VICTORY") endGame("VICTORY", "Enemy Nexus destroyed.");
            else endGame("DEFEAT", "Your Nexus has been destroyed.");
        }
        
        // Update HUD
        updateHUD(Game.state);
    }

    // Camera Logic
    const { player: p } = Game.state;
    let camX = p.x - CONFIG.VIEWPORT.WIDTH / 2;
    let camY = p.y - CONFIG.VIEWPORT.HEIGHT / 2;
    camera.x = Math.max(0, Math.min(camX, CONFIG.WIDTH - CONFIG.VIEWPORT.WIDTH));
    camera.y = Math.max(0, Math.min(camY, CONFIG.HEIGHT - CONFIG.VIEWPORT.HEIGHT));

    draw(ctx, Game.state, camera);
    requestAnimationFrame(loop);
}

document.getElementById('start-btn')?.addEventListener('click', () => {
    document.getElementById('start-screen')!.classList.add('hidden');
    Game.resetState();
    Game.state.lastTime = performance.now();
});

document.getElementById('restart-btn')?.addEventListener('click', () => {
    document.getElementById('game-over-screen')!.classList.add('hidden');
    Game.resetState();
    Game.state.lastTime = performance.now();
});

draw(ctx, Game.state, camera);
requestAnimationFrame(loop);