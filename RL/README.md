# RL Training Module

This folder contains the infrastructure to train a Reinforcement Learning agent for the game.

## Files

- **environment.ts**: Wraps the game logic into an OpenAI Gym-like interface (`reset`, `step`).
- **storage.ts**: Handles data persistence. In the browser, it downloads a JSON file. In a Node environment, it can be extended to use SQLite.
- **types.ts**: Definitions for State, Action, and Experience.

## How to Train

1. Import `RLEnvironment` and `RLStorage`.
2. Create a training loop (Agent -> Action -> Env.step -> Reward).
3. Call `storage.saveExperience`.
4. Call `storage.downloadLogs()` to export data.

## Database Note

Per requirements, a SQLite database implementation is preferred. However, as this is a client-side web application, direct file system access to create a `.db` file is blocked by browser security.
Therefore, `storage.ts` defaults to **JSON Download**.

To use SQLite:
1. Run the game logic in a Node.js environment.
2. Install `better-sqlite3`.
3. Uncomment the Node.js specific code in a dedicated server script.
