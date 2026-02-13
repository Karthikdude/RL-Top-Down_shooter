export interface RLObservation {
    hp: number;
    enemyHp: number;
    distToEnemy: number;
    angleToEnemy: number;
    ammo: number;
    canDash: number; // 1 or 0
    canShield: number; // 1 or 0
}

export interface RLAction {
    moveIndex: number; // 0-8 (Stop + 8 directions)
    aimIndex: number; // 0-7 (8 directions relative to current or absolute)
    shoot: number; // 0 or 1
    skillIndex: number; // 0=None, 1=Dash, 2=Shield
}

export interface Experience {
    state: RLObservation;
    action: RLAction;
    reward: number;
    nextState: RLObservation;
    done: boolean;
}