import { CONFIG } from './config';
import { GameState, Entity, Tower, Team, TowerTier, InputState } from './types';
import { moveEntity, checkWallCollision } from './physics';
import { getBotAction } from './ai';
import { spawnMinionWave, updateMinions, updateTowers } from './gameLogic';
import { Skills } from './skills';

export const Game = {
    state: {} as GameState,

    getUniqueId(): number {
        return this.state.entityIdCounter++;
    },

    createParticles(x: number, y: number, color: string, count: number, speedMultiplier: number = 1) {
        for(let i=0; i<count; i++) {
            this.state.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 200 * speedMultiplier,
                vy: (Math.random() - 0.5) * 200 * speedMultiplier,
                life: 0.5,
                color,
                size: Math.random() * 3 + 1
            });
        }
    },

    createHitMarker(x: number, y: number) {
        this.state.hitMarkers.push({
            x, y, life: 0.2
        });
    },

    spawnBullet(x: number, y: number, angle: number, team: 'player' | 'bot', damage: number, sourceId: number) {
        const offset = 25;
        const bx = x + Math.cos(angle) * offset;
        const by = y + Math.sin(angle) * offset;

        if (checkWallCollision(bx, by, CONFIG.BULLET.RADIUS)) {
            this.createParticles(bx, by, '#aaa', 2);
            return;
        }

        const range = team === 'player' ? CONFIG.PLAYER.RANGE : CONFIG.BOT.RANGE;
        const lifetime = range / CONFIG.BULLET.SPEED;

        this.state.bullets.push({
            x: bx,
            y: by,
            angle,
            team,
            damage,
            life: lifetime,
            color: team === 'player' ? '#fbbf24' : '#fca5a5',
            sourceId
        });
    },

    initTowers() {
        this.state.towers = [];
        
        const createTower = (x: number, y: number, team: 'player' | 'bot', tier: TowerTier): Tower => {
            let stats;
            if (tier === 1) stats = CONFIG.TOWER.TIER_1;
            else if (tier === 2) stats = CONFIG.TOWER.TIER_2;
            else if (tier === 3) stats = CONFIG.TOWER.TIER_3;
            else stats = CONFIG.TOWER.NEXUS;

            return {
                id: this.getUniqueId(),
                x, y,
                hp: stats.HP,
                maxHp: stats.HP,
                radius: tier === 4 ? CONFIG.TOWER.NEXUS_RADIUS : CONFIG.TOWER.RADIUS,
                color: team === 'player' ? CONFIG.TOWER.COLOR_PLAYER : CONFIG.TOWER.COLOR_BOT,
                team, tier, dead: false, cooldown: 0,
                invulnerable: tier !== 1, 
                energyShield: tier === 1 ? stats.SHIELD || 0 : 0,
                maxEnergyShield: tier === 1 ? stats.SHIELD || 0 : 0,
                lastTargetId: null, consecutiveHits: 0
            };
        };

        const midY = 800;
        this.state.towers.push(createTower(100, midY, 'player', 4));
        this.state.towers.push(createTower(300, midY, 'player', 3));
        this.state.towers.push(createTower(800, midY, 'player', 2));
        this.state.towers.push(createTower(1300, midY, 'player', 1));
        this.state.towers.push(createTower(3100, midY, 'bot', 4));
        this.state.towers.push(createTower(2900, midY, 'bot', 3));
        this.state.towers.push(createTower(2400, midY, 'bot', 2));
        this.state.towers.push(createTower(1900, midY, 'bot', 1));
    },

    resetState() {
        this.state.entityIdCounter = 1;
        this.state.player = {
            id: this.getUniqueId(),
            x: CONFIG.SPAWNS.PLAYER.x, y: CONFIG.SPAWNS.PLAYER.y, angle: CONFIG.SPAWNS.PLAYER.angle,
            hp: CONFIG.PLAYER.BASE_HP, maxHp: CONFIG.PLAYER.BASE_HP, baseHp: CONFIG.PLAYER.BASE_HP,
            shield: CONFIG.PLAYER.MAX_SHIELD, maxShield: CONFIG.PLAYER.MAX_SHIELD,
            ammo: CONFIG.AMMO.MAX, reloading: false, reloadTimer: 0, cooldown: 0, dead: false, respawnTimer: 0,
            team: 'player', gold: 0, level: 1, baseDamage: CONFIG.PLAYER.BASE_DAMAGE, lastDamageTime: -10,
            dashCooldown: 0, dashing: false, dashTimeLeft: 0,
            shieldSkillCooldown: 0, shieldSkillActive: false, shieldSkillTimeLeft: 0
        };
        this.state.bot = {
            id: this.getUniqueId(),
            x: CONFIG.SPAWNS.BOT.x, y: CONFIG.SPAWNS.BOT.y, angle: CONFIG.SPAWNS.BOT.angle,
            hp: CONFIG.BOT.BASE_HP, maxHp: CONFIG.BOT.BASE_HP, baseHp: CONFIG.BOT.BASE_HP,
            shield: CONFIG.BOT.MAX_SHIELD, maxShield: CONFIG.BOT.MAX_SHIELD,
            ammo: CONFIG.AMMO.MAX, reloading: false, reloadTimer: 0, cooldown: 0, dead: false, respawnTimer: 0,
            team: 'bot', gold: 0, level: 1, baseDamage: CONFIG.BOT.BASE_DAMAGE, lastDamageTime: -10,
            dashCooldown: 0, dashing: false, dashTimeLeft: 0,
            shieldSkillCooldown: 0, shieldSkillActive: false, shieldSkillTimeLeft: 0
        };

        this.initTowers();
        this.state.minions = [];
        this.state.bullets = [];
        this.state.particles = [];
        this.state.hitMarkers = [];
        this.state.running = true;
        this.state.gameTime = 0;
        this.state.nextWaveTime = CONFIG.MINION.FIRST_WAVE_DELAY;
        this.state.lastTime = performance.now();
        this.state.outcome = null;
    },

    updateEntityReload(entity: Entity, dt: number) {
        if (entity.reloading) {
            entity.reloadTimer -= dt;
            if (entity.reloadTimer <= 0) {
                entity.reloading = false;
                entity.ammo = CONFIG.AMMO.MAX;
            }
        }
    },

    applyDamage(target: Entity, damage: number) {
        let finalDamage = damage;
        if (target.shieldSkillActive) {
            finalDamage *= (1 - CONFIG.SHIELD_SKILL.DAMAGE_REDUCTION);
        }
        if (target.shield && target.shield > 0) {
            target.shield -= finalDamage;
            if (target.shield < 0) {
                const overflow = Math.abs(target.shield);
                target.shield = 0;
                target.hp -= overflow;
            }
        } else {
            target.hp -= finalDamage;
        }
    },

    applyFountainHealing(entity: Entity, spawn: {x: number, y: number}, dt: number) {
        if (entity.dead) return;
        const dx = entity.x - spawn.x;
        const dy = entity.y - spawn.y;
        if ((dx*dx + dy*dy) < CONFIG.FOUNTAIN.RADIUS**2) {
            if (this.state.gameTime - entity.lastDamageTime < CONFIG.FOUNTAIN.COMBAT_COOLDOWN) return; 
            if (entity.hp < entity.maxHp) entity.hp = Math.min(entity.maxHp, entity.hp + CONFIG.FOUNTAIN.HEAL_RATE * dt);
            if (entity.shield < entity.maxShield) entity.shield = Math.min(entity.maxShield, entity.shield + CONFIG.FOUNTAIN.SHIELD_RATE * dt);
            if (entity.ammo < CONFIG.AMMO.MAX) {
                entity.ammo = CONFIG.AMMO.MAX;
                entity.reloading = false;
                entity.reloadTimer = 0;
            }
        }
    },

    respawnEntity(entity: Entity, spawn: {x: number, y: number, angle: number}) {
        entity.dead = false;
        entity.hp = entity.maxHp;
        entity.shield = entity.maxShield;
        entity.ammo = CONFIG.AMMO.MAX;
        entity.x = spawn.x;
        entity.y = spawn.y;
        entity.angle = spawn.angle;
        entity.lastDamageTime = -10;
        entity.dashCooldown = 0;
        entity.dashing = false;
        entity.shieldSkillCooldown = 0;
        entity.shieldSkillActive = false;
    },

    checkEnemyStructureCollision(x: number, y: number, r: number, myTeam: Team) {
        for (const t of this.state.towers) {
            if (t.dead) continue;
            if (t.team === myTeam) continue; 
            const dx = x - t.x;
            const dy = y - t.y;
            if ((dx*dx + dy*dy) < (t.radius + r)**2) return true;
        }
        return false;
    },

    updateStats(ent: Entity) {
        const goldFactor = ent.gold;
        ent.maxHp = ent.baseHp + (goldFactor * CONFIG.PLAYER.HP_PER_GOLD);
        if (ent.hp > ent.maxHp) ent.hp = ent.maxHp;
        ent.level = 1 + Math.floor(ent.gold / 200);
    },

    unlockNextTier(team: Team, destroyedTier: number) {
        const nextTier = destroyedTier + 1;
        const tower = this.state.towers.find(t => t.team === team && t.tier === nextTier);
        if (tower) tower.invulnerable = false;
    },

    checkWin() {
        const pNexus = this.state.towers.find(t => t.team === 'player' && t.tier === 4);
        const bNexus = this.state.towers.find(t => t.team === 'bot' && t.tier === 4);
        if (pNexus && pNexus.dead) this.state.outcome = "DEFEAT";
        else if (bNexus && bNexus.dead) this.state.outcome = "VICTORY";
    },

    // --- MAIN GAME LOOP ---
    update(dt: number, input: InputState) {
        if (!this.state.running) return;
        this.state.gameTime += dt;

        this.applyFountainHealing(this.state.player, CONFIG.SPAWNS.PLAYER, dt);
        this.applyFountainHealing(this.state.bot, CONFIG.SPAWNS.BOT, dt);

        if (this.state.gameTime >= this.state.nextWaveTime) {
            spawnMinionWave(this.state);
            this.state.nextWaveTime += CONFIG.MINION.SPAWN_INTERVAL;
        }

        const p = this.state.player;
        const b = this.state.bot;

        // --- PLAYER UPDATE ---
        if (!p.dead) {
            Skills.update(p, dt);
            
            // Skill triggers from Input
            if (input.dash && Skills.tryDash(p)) this.createParticles(p.x, p.y, '#fff', 5, 2);
            if (input.shield) Skills.tryShield(p);

            let moveX = 0; 
            let moveY = 0;
            let speed = CONFIG.PLAYER.SPEED;

            if (p.dashing) {
                moveX = Math.cos(p.angle);
                moveY = Math.sin(p.angle);
                speed *= CONFIG.DASH.SPEED_MULTIPLIER;
            } else {
                moveX = input.moveX;
                moveY = input.moveY;
            }

            let nextX = p.x + moveX * speed * dt;
            let nextY = p.y + moveY * speed * dt;
            
            if (!this.checkEnemyStructureCollision(nextX, p.y, CONFIG.PLAYER.RADIUS, 'player')) 
                moveEntity(p, moveX, 0, speed, dt, CONFIG.PLAYER.RADIUS);
            if (!this.checkEnemyStructureCollision(p.x, nextY, CONFIG.PLAYER.RADIUS, 'player')) 
                moveEntity(p, 0, moveY, speed, dt, CONFIG.PLAYER.RADIUS);

            p.angle = input.aimAngle;
            
            this.updateEntityReload(p, dt);
            if ((p.ammo <= 0 || input.reload) && !p.reloading && p.ammo < CONFIG.AMMO.MAX) {
                p.reloading = true;
                p.reloadTimer = CONFIG.AMMO.RELOAD_TIME;
            }

            p.cooldown -= dt;
            if (input.shoot && !p.reloading && p.ammo > 0 && p.cooldown <= 0 && !p.dashing) {
                const dmg = p.baseDamage + (p.gold * CONFIG.PLAYER.DMG_PER_GOLD);
                this.spawnBullet(p.x, p.y, p.angle, 'player', dmg, p.id);
                p.ammo--;
                p.cooldown = CONFIG.PLAYER.COOLDOWN;
            }
            if (p.hp <= 0) {
                p.dead = true;
                p.respawnTimer = CONFIG.PLAYER.RESPAWN_TIME;
                this.createParticles(p.x, p.y, CONFIG.PLAYER.COLOR, 15, 3);
            }
        } else {
            p.respawnTimer -= dt;
            if (p.respawnTimer <= 0) this.respawnEntity(p, CONFIG.SPAWNS.PLAYER);
        }

        // --- BOT UPDATE ---
        if (!b.dead) {
            Skills.update(b, dt);
            this.updateEntityReload(b, dt);
            this.state.botTimer += dt;
            
            if (this.state.botTimer >= CONFIG.BOT.REACTION_TIME) {
                this.state.botTimer = 0;
                const action = getBotAction(this.state, b, p);
                b.targetMoveX = action.moveX;
                b.targetMoveY = action.moveY;
                b.angle = action.aimAngle;
                
                if (action.dash && Skills.tryDash(b)) this.createParticles(b.x, b.y, '#fff', 5, 2);
                if (action.shield) Skills.tryShield(b);

                if (action.reload && !b.reloading && b.ammo < CONFIG.AMMO.MAX) {
                    b.reloading = true;
                    b.reloadTimer = CONFIG.AMMO.RELOAD_TIME;
                }
                if (action.shoot && !b.reloading && b.ammo > 0 && b.cooldown <= 0 && !b.dashing) {
                    const dmg = b.baseDamage + (b.gold * CONFIG.BOT.DMG_PER_GOLD);
                    this.spawnBullet(b.x, b.y, b.angle, 'bot', dmg, b.id);
                    b.ammo--;
                    b.cooldown = CONFIG.BOT.COOLDOWN;
                }
            }
            b.cooldown -= dt;
            
            let moveX = 0;
            let moveY = 0;
            let speed = CONFIG.BOT.SPEED;

            if (b.dashing) {
                moveX = Math.cos(b.angle);
                moveY = Math.sin(b.angle);
                speed *= CONFIG.DASH.SPEED_MULTIPLIER;
            } else {
                moveX = b.targetMoveX || 0;
                moveY = b.targetMoveY || 0;
            }

            let nextBX = b.x + moveX * speed * dt;
            let nextBY = b.y + moveY * speed * dt;
            if (!this.checkEnemyStructureCollision(nextBX, b.y, CONFIG.BOT.RADIUS, 'bot')) moveEntity(b, moveX, 0, speed, dt, CONFIG.BOT.RADIUS);
            if (!this.checkEnemyStructureCollision(b.x, nextBY, CONFIG.BOT.RADIUS, 'bot')) moveEntity(b, 0, moveY, speed, dt, CONFIG.BOT.RADIUS);

            if (b.hp <= 0) {
                b.dead = true;
                b.respawnTimer = CONFIG.PLAYER.RESPAWN_TIME;
                this.createParticles(b.x, b.y, CONFIG.BOT.COLOR, 15, 3);
            }
        } else {
            b.respawnTimer -= dt;
            if (b.respawnTimer <= 0) this.respawnEntity(b, CONFIG.SPAWNS.BOT);
        }

        updateMinions(this.state, dt);
        updateTowers(this.state, dt);

        // --- BULLETS ---
        for (let i = this.state.bullets.length - 1; i >= 0; i--) {
            const bul = this.state.bullets[i];
            bul.life -= dt;
            const nextX = bul.x + Math.cos(bul.angle) * CONFIG.BULLET.SPEED * dt;
            const nextY = bul.y + Math.sin(bul.angle) * CONFIG.BULLET.SPEED * dt;

            if (nextX < 0 || nextX > CONFIG.WIDTH || nextY < 0 || nextY > CONFIG.HEIGHT || bul.life <= 0) {
                if (bul.life <= 0) this.createParticles(bul.x, bul.y, bul.color || '#fff', 1, 0.5);
                this.state.bullets.splice(i, 1);
                continue;
            }
            if (checkWallCollision(nextX, nextY, CONFIG.BULLET.RADIUS)) {
                this.createParticles(nextX, nextY, '#aaa', 4, 1.5);
                this.state.bullets.splice(i, 1);
                continue;
            }

            let hit = false;
            let owner = bul.team === 'player' ? p : b;
            
            const targets = [p, b];
            for (const t of targets) {
                if (!t.dead && t.team !== bul.team) {
                    const dist = Math.sqrt((nextX - t.x)**2 + (nextY - t.y)**2);
                    const r = t === p ? CONFIG.PLAYER.RADIUS : CONFIG.BOT.RADIUS;
                    if (dist < r + CONFIG.BULLET.RADIUS) {
                        this.applyDamage(t, bul.damage);
                        t.lastDamageTime = this.state.gameTime;
                        this.createParticles(nextX, nextY, t.team === 'player' ? CONFIG.PLAYER.COLOR : CONFIG.BOT.COLOR, 5, 2);
                        this.createHitMarker(nextX, nextY);
                        hit = true;
                        if (t.hp <= 0 && !t.dead) {
                            if (owner.team !== t.team) owner.gold += 300; 
                        }
                        break;
                    }
                }
            }
            if (hit) { this.state.bullets.splice(i, 1); continue; }

            for (const m of this.state.minions) {
                if (!m.dead && m.team !== bul.team) {
                    const dist = Math.sqrt((nextX - m.x)**2 + (nextY - m.y)**2);
                    if (dist < CONFIG.MINION.RADIUS + CONFIG.BULLET.RADIUS) {
                        m.hp -= bul.damage;
                        this.createParticles(nextX, nextY, '#fff', 2, 1);
                        if (m.hp <= 0 && !m.dead) {
                            m.dead = true;
                            this.createParticles(m.x, m.y, m.team === 'player' ? '#93c5fd' : '#fca5a5', 5, 1);
                            if (bul.team === 'player') this.state.player.gold += m.goldValue;
                            if (bul.team === 'bot') this.state.bot.gold += m.goldValue;
                        } 
                        hit = true;
                        break;
                    }
                }
            }
            if (hit) { this.state.bullets.splice(i, 1); continue; }

            for (const t of this.state.towers) {
                if (!t.dead && t.team !== bul.team) {
                    const dist = Math.sqrt((nextX - t.x)**2 + (nextY - t.y)**2);
                    if (dist < t.radius + CONFIG.BULLET.RADIUS) {
                        hit = true;
                        this.createParticles(nextX, nextY, t.color, 3, 1);
                        if (t.invulnerable) break; 
                        
                        let finalDamage = bul.damage;
                        const friendlyMinionsNear = this.state.minions.some(m => 
                            !m.dead && m.team === bul.team && 
                            ((m.x - t.x)**2 + (m.y - t.y)**2) < (CONFIG.TOWER.RANGE + 50)**2
                        );
                        if (!friendlyMinionsNear) finalDamage *= CONFIG.TOWER.BACKDOOR_REDUCTION;
                        
                        if (t.tier === 1 && t.energyShield > 0) {
                            finalDamage *= 0.5;
                            t.energyShield -= finalDamage;
                            if (t.energyShield < 0) t.energyShield = 0;
                        } else {
                            t.hp -= finalDamage;
                        }

                        if (t.hp <= 0) {
                            t.dead = true;
                            this.createParticles(t.x, t.y, t.color, 30, 5); 
                            let reward = 0;
                            if (t.tier === 1) reward = CONFIG.TOWER.TIER_1.GOLD;
                            else if (t.tier === 2) reward = CONFIG.TOWER.TIER_2.GOLD;
                            else if (t.tier === 3) reward = CONFIG.TOWER.TIER_3.GOLD;
                            else reward = CONFIG.TOWER.NEXUS.GOLD;
                            if (bul.team === 'player') this.state.player.gold += reward;
                            else this.state.bot.gold += reward;
                            this.unlockNextTier(t.team, t.tier);
                            if (t.tier === 4) this.checkWin();
                        }
                        break;
                    }
                }
            }
            if (hit) { this.state.bullets.splice(i, 1); continue; }

            bul.x = nextX;
            bul.y = nextY;
        }

        this.state.minions = this.state.minions.filter(m => !m.dead);
        for (let i = this.state.particles.length - 1; i >= 0; i--) {
            const pt = this.state.particles[i];
            pt.life -= dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            if (pt.life <= 0) this.state.particles.splice(i, 1);
        }
        for (let i = this.state.hitMarkers.length - 1; i >= 0; i--) {
            const hm = this.state.hitMarkers[i];
            hm.life -= dt;
            if (hm.life <= 0) this.state.hitMarkers.splice(i, 1);
        }

        this.updateStats(this.state.player);
        this.updateStats(this.state.bot);
    }
}