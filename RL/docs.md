# Neon Arena: RL Master Guide (A to Z)

This guide explains how to create, train, and integrate a Reinforcement Learning (RL) agent into the *Neon Arena* web game.

---

## 🏗️ 1. How It Works (The Big Picture)

Since browsers cannot run heavy training efficiently, we split the process into three steps:

1.  **Collect Data (Web)**: You play the game (or let a bot play) in the browser. The game records every move you make.
2.  **Train (Python)**: You download that data to your computer. A Python script reads it and teaches a Neural Network to copy your behavior (Imitation Learning) or maximize score (Reinforcement Learning).
3.  **Deploy (Web)**: You convert the trained Brain back to a web-friendly format (`.onnx` or `.json`) and plug it into the game.

---

## 📊 2. Step-by-Step: Collecting Data

We have added a **Recording System** to the game.

1.  Open the game (`index.html`) in your browser.
2.  Look for the **"Start Recording"** button (Top Right, Green).
3.  Click it. It will turn **Red**.
4.  **Play the game!**
    *   The game is now logging your "Observation" (HP, Ammo, Enemy Pos) and your "Action" (Move, Aim, Shoot).
    *   Try to play well. The AI will learn from *you*.
    *   *Tip: Record 5-10 full games for a decent starting dataset.*
5.  Click **"Stop Recording"**.
6.  Click the blue **"Download Data"** button.
7.  This will save a file called `rl_training_data.json` to your Downloads folder.

---

## 🐍 3. Step-by-Step: Training the AI (Python)

Now we move "Outside" the browser. You need **Python** installed on your computer (or use Google Colab).

1.  **Setup Folder**: Create a folder on your computer.
2.  **Move Files**:
    *   Copy `rl_training_data.json` (from Downloads) into this folder.
    *   Copy `RL/train_example.py` (from this project) into this folder.
3.  **Install Libraries**:
    Open your terminal/command prompt and run:
    ```bash
    pip install torch torchvision
    ```
4.  **Run Training**:
    ```bash
    python train_example.py
    ```
5.  **What happens?**
    *   The script loads your JSON data.
    *   It creates a Neural Network with 4 "Heads" (Movement, Aiming, Shooting, Skills).
    *   It loops through your data (Epochs) and adjusts the brain to match your actions.
    *   Finally, it saves `bot_brain.pth` (PyTorch model) and `bot_brain.onnx` (Web model).

---

## 🤖 4. Step-by-Step: Integrating Back to Game

Now you have a smart brain (`bot_brain.onnx`). How do we use it?

1.  **Install ONNX Runtime for Web**:
    Add this to your `index.html` head:
    ```html
    <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
    ```

2.  **Update `modules/ai.ts`**:
    You need to write code to load the model.

    *Pseudo-code implementation:*
    ```typescript
    // In modules/ai.ts
    let session: any = null;

    // Load model once
    async function loadModel() {
        session = await ort.InferenceSession.create('./bot_brain.onnx');
    }

    export async function getBotAction(gameState: GameState) {
        if (!session) await loadModel();

        // 1. Get Observation [hp, enemyHp, dist, angle, ammo, dash, shield]
        const obs = [
             gameState.bot.hp / gameState.bot.maxHp,
             // ... normalize other inputs ...
        ];
        
        // 2. Run Inference
        const tensor = new ort.Tensor('float32', Float32Array.from(obs), [1, 7]);
        const results = await session.run({ observation: tensor });

        // 3. Decode Output
        // results.move.data contains logits for movement
        // Find index of max value -> That is your move!
        
        return {
             moveX: ..., 
             moveY: ...
        };
    }
    ```

---

## 🧠 5. Deep Dive: The Brain (Neural Network)

The AI architecture in `train_example.py` is a **Multi-Head Perceptron**.

**Inputs (7 Neurons):**
1.  **HP**: Am I dying? (0.0 - 1.0)
2.  **Enemy HP**: Is he dying? (0.0 - 1.0)
3.  **Distance**: How far is he? (0.0 - 1.0)
4.  **Angle**: Where is he? (-3.14 to 3.14)
5.  **Ammo**: Do I need to reload? (0.0 - 1.0)
6.  **Dash Ready**: Can I zoom? (0 or 1)
7.  **Shield Ready**: Can I block? (0 or 1)

**Hidden Layers:**
*   Layer 1: 128 Neurons (ReLU activation)
*   Layer 2: 128 Neurons (ReLU activation)

**Outputs (4 Heads):**
1.  **Move Head (9 Neurons)**: Probability of Stop, N, NE, E, SE, S, SW, W, NW.
2.  **Aim Head (8 Neurons)**: Probability of aiming in 8 directions.
3.  **Shoot Head (2 Neurons)**: Probability of Shoot vs Don't Shoot.
4.  **Skill Head (3 Neurons)**: Probability of None vs Dash vs Shield.

---

## 🏆 6. The Reward System

When recording data, we calculate a "Reward" to tell the AI if it did good or bad.

*   **Doing Damage**: `+20 points` (Scaled by damage amount).
*   **Taking Damage**: `-10 points` (We prefer aggression over safety, so penalty is lower than reward).
*   **Winning Game**: `+1000 points`.
*   **Losing Game**: `-1000 points`.
*   **Existing**: `-0.01 points` per frame (Encourages finishing the game fast).

*Note: In the provided `train_example.py`, we use **Imitation Learning** (Cross Entropy Loss), which tries to copy your moves exactly. The Rewards are logged for future use if you switch to **Reinforcement Learning (PPO/DQN)**.*
