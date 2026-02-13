import { Game } from '../modules/game';
import { GameState, InputState } from '../modules/types';
import { RLObservation, RLAction } from './types';
import { CONFIG } from '../modules/config';

export class RLEnvironment {
    constructor() {}

    reset(): RLObservation {
        Game.resetState();
        return this.getObservation();
    }

    getObservation(): RLObservation {
        const s = Game.state;
        const p = s.player;
        const e = s.bot;
        const dist = Math.sqrt((e.x - p.x)**2 + (e.y - p.y)**2);
        const angle = Math.atan2(e.y - p.y, e.x - p.x);

        return {
            hp: p.hp / p.maxHp,
            enemyHp: e.hp / e.maxHp,
            distToEnemy: dist / CONFIG.WIDTH,
            angleToEnemy: angle, // Radians
            ammo: p.ammo / CONFIG.AMMO.MAX,
            canDash: p.dashCooldown <= 0 ? 1 : 0,
            canShield: p.shieldSkillCooldown <= 0 ? 1 : 0
        };
    }

    step(action: RLAction): { observation: RLObservation, reward: number, done: boolean } {
        // Translate RL Action to Game Input
        const input: InputState = {
            moveX: 0,
            moveY: 0,
            aimAngle: Game.state.player.angle,
            shoot: action.shoot > 0.5,
            reload: false,
            dash: action.skillIndex === 1,
            shield: action.skillIndex === 2
        };

        // Movement Mapping (0=Stop, 1=N, 2=NE, 3=E, ...)
        const dirs = [
            [0,0], [0,-1], [0.7,-0.7], [1,0], [0.7,0.7], [0,1], [-0.7,0.7], [-1,0], [-0.7,-0.7]
        ];
        if (action.moveIndex >= 0 && action.moveIndex < dirs.length) {
            input.moveX = dirs[action.moveIndex][0];
            input.moveY = dirs[action.moveIndex][1];
        }

        // Aim Mapping (Relative to enemy? Let's say absolute 8 directions for simplicity)
        input.aimAngle = (action.aimIndex / 8) * Math.PI * 2;

        // Run Logic Steps (100ms simulation step)
        const dt = 0.1; 
        
        // Track stats for reward
        const prevHp = Game.state.player.hp;
        const prevEnemyHp = Game.state.bot.hp;

        Game.update(dt, input);

        const currentHp = Game.state.player.hp;
        const currentEnemyHp = Game.state.bot.hp;
        
        // Calculate Reward
        let reward = -0.01; // Time penalty
        reward += (currentHp - prevHp) * 0.1; // Penalty for taking damage
        reward += (prevEnemyHp - currentEnemyHp) * 0.2; // Reward for dealing damage
        
        if (Game.state.outcome === "VICTORY") reward += 10;
        if (Game.state.outcome === "DEFEAT") reward -= 10;

        const done = !!Game.state.outcome;

        return {
            observation: this.getObservation(),
            reward,
            done
        };
    }
}