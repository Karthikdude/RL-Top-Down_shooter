import { CONFIG } from './modules/config';
import { Input } from './modules/input';
import { draw, updateHUD } from './modules/renderer';
import { Game } from './modules/game';
import { InputState } from './modules/types';
import { RLEnvironment } from './RL/environment';
import { RLStorage } from './RL/storage';
import { RLAction, RLObservation } from './RL/types';
import { getBotAction } from './modules/ai';

let camera = { x: 0, y: 0 };

// RL Setup
const env = new RLEnvironment();
const storage = new RLStorage();
let isRecording = false;
let lastObservation: RLObservation | null = null;

// AFK Setup
let lastInputTime = performance.now();
let isAfkMode = false;
const AFK_TIMEOUT = 30000; // 30 seconds

// Setup Canvas
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
Input.init(canvas);

// INITIALIZE STATE
Game.resetState();
Game.state.running = false;

// --- UI HELPERS ---
function createButton(id: string, text: string, onClick: () => void, color: string = '#4ade80') {
    const btn = document.createElement('button');
    btn.id = id;
    btn.innerText = text;
    btn.style.position = 'absolute';
    btn.style.zIndex = '100';
    btn.style.padding = '8px 16px';
    btn.style.fontWeight = 'bold';
    btn.style.cursor = 'pointer';
    btn.style.backgroundColor = color;
    btn.style.border = '2px solid #fff';
    btn.style.borderRadius = '4px';
    btn.addEventListener('click', onClick);
    return btn;
}

// Add Data Collection Buttons
const recordBtn = createButton('record-btn', 'Start Recording', () => {
    isRecording = !isRecording;
    const btn = document.getElementById('record-btn')!;
    btn.innerText = isRecording ? 'Stop Recording' : 'Start Recording';
    btn.style.backgroundColor = isRecording ? '#f87171' : '#4ade80';
    if(isRecording) console.log("Recording started...");
    else console.log("Recording stopped.");
}, '#4ade80');
recordBtn.style.top = '10px';
recordBtn.style.right = '150px'; // Offset from right
document.body.appendChild(recordBtn);

const downloadBtn = createButton('download-btn', 'Download Data', () => {
    storage.downloadLogs();
}, '#60a5fa');
downloadBtn.style.top = '10px';
downloadBtn.style.right = '10px';
document.body.appendChild(downloadBtn);


function endGame(title: string, msg: string) {
    Game.state.running = false;
    document.getElementById('game-over-screen')!.classList.remove('hidden');
    const t = document.getElementById('outcome-title')!;
    t.innerText = title;
    t.className = title === "VICTORY" ? "win" : "lose";
    document.getElementById('outcome-message')!.innerText = msg;
}

// Helper to map continuous input back to discrete RLAction for logging
function mapInputToRLAction(input: InputState): RLAction {
    // 1. Map Move (Simple 9-way)
    // 0:Stop, 1:N, 2:NE, 3:E, 4:SE, 5:S, 6:SW, 7:W, 8:NW
    let moveIndex = 0;
    const { moveX: x, moveY: y } = input;
    const threshold = 0.3;
    
    if (Math.abs(x) < threshold && Math.abs(y) < threshold) moveIndex = 0;
    else if (y < -threshold && Math.abs(x) < threshold) moveIndex = 1; // N
    else if (y < -threshold && x > threshold) moveIndex = 2; // NE
    else if (Math.abs(y) < threshold && x > threshold) moveIndex = 3; // E
    else if (y > threshold && x > threshold) moveIndex = 4; // SE
    else if (y > threshold && Math.abs(x) < threshold) moveIndex = 5; // S
    else if (y > threshold && x < -threshold) moveIndex = 6; // SW
    else if (Math.abs(y) < threshold && x < -threshold) moveIndex = 7; // W
    else if (y < -threshold && x < -threshold) moveIndex = 8; // NW

    // 2. Map Aim (0-7 sectors)
    // Angle is -PI to PI. Normalize to 0-7 index.
    let angle = input.aimAngle;
    if (angle < 0) angle += Math.PI * 2;
    const octant = Math.round(angle / (Math.PI / 4)) % 8;

    // 3. Skill
    let skillIndex = 0;
    if (input.dash) skillIndex = 1;
    else if (input.shield) skillIndex = 2;

    return {
        moveIndex,
        aimIndex: octant,
        shoot: input.shoot ? 1 : 0,
        skillIndex
    };
}

function loop(timestamp: number) {
    if (Game.state.running) {
        const dt = (timestamp - Game.state.lastTime) / 1000;
        Game.state.lastTime = timestamp;

        // --- DATA COLLECTION START ---
        // Capture Observation BEFORE update
        if (isRecording) {
            lastObservation = env.getObservation();
        }

        // Construct Input State from Browser Input
        const move = Input.getMoveDir();
        const worldMouseX = Input.mouse.x + camera.x;
        const worldMouseY = Input.mouse.y + camera.y;
        const p = Game.state.player;
        const aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);

        let inputState: InputState;
        
        // --- AFK CHECK LOGIC ---
        const anyInput = Math.abs(move.x) > 0 || Math.abs(move.y) > 0 || Input.mouse.down || Input.keys[' '] || Input.keys['shift'] || Input.keys.r;
        
        if (anyInput) {
            lastInputTime = timestamp;
        }

        if (Input.keys.c) {
             isAfkMode = false;
             lastInputTime = timestamp;
             document.getElementById('afk-overlay')?.classList.add('hidden');
        }

        if (!isAfkMode && (timestamp - lastInputTime > AFK_TIMEOUT)) {
            isAfkMode = true;
            document.getElementById('afk-overlay')?.classList.remove('hidden');
        }

        if (isAfkMode) {
            // Autopilot
            const botAction = getBotAction(Game.state, Game.state.player, Game.state.bot);
            inputState = {
                moveX: botAction.moveX,
                moveY: botAction.moveY,
                aimAngle: botAction.aimAngle,
                shoot: botAction.shoot,
                reload: botAction.reload,
                dash: botAction.dash,
                shield: botAction.shield
            };
        } else {
            // Human Input
            inputState = {
                moveX: move.x,
                moveY: move.y,
                aimAngle: aimAngle,
                shoot: Input.mouse.down,
                reload: Input.keys.r,
                dash: Input.keys[' '],
                shield: Input.keys['shift']
            };
        }

        // --- UPDATE GAME ---
        Game.update(dt, inputState);

        // --- DATA COLLECTION END ---
        // Capture Reward & Next State AFTER update
        if (isRecording && lastObservation) {
            const nextObservation = env.getObservation();
            
            // Calculate Reward manually for logging purposes
            // (Ideally this logic should be shared with Environment.step to keep it synced)
            let reward = -0.01;
            reward += (nextObservation.hp - lastObservation.hp) * 0.1; 
            reward += (lastObservation.enemyHp - nextObservation.enemyHp) * 0.2;
            if (Game.state.outcome === "VICTORY") reward += 10;
            if (Game.state.outcome === "DEFEAT") reward -= 10;

            const rlAction = mapInputToRLAction(inputState);

            storage.saveExperience({
                state: lastObservation,
                action: rlAction,
                reward: reward,
                nextState: nextObservation,
                done: !!Game.state.outcome
            });
        }

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
    lastInputTime = performance.now();
    isAfkMode = false;
});

document.getElementById('restart-btn')?.addEventListener('click', () => {
    document.getElementById('game-over-screen')!.classList.add('hidden');
    Game.resetState();
    Game.state.lastTime = performance.now();
    lastInputTime = performance.now();
    isAfkMode = false;
    document.getElementById('afk-overlay')?.classList.add('hidden');
});

draw(ctx, Game.state, camera);
requestAnimationFrame(loop);