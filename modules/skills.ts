import { Entity } from './types';
import { CONFIG } from './config';

export const Skills = {
    tryDash(entity: Entity) {
        if (entity.dashCooldown <= 0 && !entity.dashing && !entity.dead) {
            entity.dashing = true;
            entity.dashTimeLeft = CONFIG.DASH.DURATION;
            entity.dashCooldown = CONFIG.DASH.COOLDOWN;
            return true;
        }
        return false;
    },

    tryShield(entity: Entity) {
        if (entity.shieldSkillCooldown <= 0 && !entity.shieldSkillActive && !entity.dead) {
            entity.shieldSkillActive = true;
            entity.shieldSkillTimeLeft = CONFIG.SHIELD_SKILL.DURATION;
            entity.shieldSkillCooldown = CONFIG.SHIELD_SKILL.COOLDOWN;
            return true;
        }
        return false;
    },

    update(entity: Entity, dt: number) {
        // --- DASH ---
        if (entity.dashCooldown > 0) {
            entity.dashCooldown -= dt;
        }
        if (entity.dashing) {
            entity.dashTimeLeft -= dt;
            if (entity.dashTimeLeft <= 0) {
                entity.dashing = false;
            }
        }

        // --- SHIELD ---
        if (entity.shieldSkillCooldown > 0) {
            entity.shieldSkillCooldown -= dt;
        }
        if (entity.shieldSkillActive) {
            entity.shieldSkillTimeLeft -= dt;
            if (entity.shieldSkillTimeLeft <= 0) {
                entity.shieldSkillActive = false;
            }
        }
    }
};