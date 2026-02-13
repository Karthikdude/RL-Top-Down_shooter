# RL Documentation

## State Space
Normalized values [0, 1] where possible.
- HP Pct
- Enemy HP Pct
- Distance to Enemy
- Angle to Enemy
- Ammo Pct
- Can Dash (Binary)
- Can Shield (Binary)

## Action Space
- **Move**: 9 discrete directions (Stop, N, NE, E, SE, S, SW, W, NW).
- **Aim**: 8 discrete angles.
- **Shoot**: Boolean.
- **Skill**: None, Dash, Shield.

## Reward Function
- +10 Victory
- -10 Defeat
- +Damage Dealt
- -Damage Taken
- -Time Step (encourage speed)
