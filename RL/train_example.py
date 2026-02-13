import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import glob
import os

# ==========================================
# 1. CONFIGURATION
# ==========================================
DATA_DIR = 'data' # Look in data folder
BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 0.001
INPUT_SIZE = 7  # [hp, enemyHp, dist, angle, ammo, canDash, canShield]
OUTPUT_MOVE = 9 # [Stop, N, NE, E, SE, S, SW, W, NW]
OUTPUT_AIM = 8  # [E, SE, S, SW, W, NW, N, NE]
OUTPUT_SHOOT = 2 # [No, Yes]
OUTPUT_SKILL = 3 # [None, Dash, Shield]

# ==========================================
# 2. DEFINE THE MODEL
# ==========================================
class BotBrain(nn.Module):
    def __init__(self):
        super(BotBrain, self).__init__()
        # Shared Layers
        self.fc1 = nn.Linear(INPUT_SIZE, 128)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(128, 128)
        
        # Output Heads (Multi-Head Architecture)
        self.head_move = nn.Linear(128, OUTPUT_MOVE)
        self.head_aim = nn.Linear(128, OUTPUT_AIM)
        self.head_shoot = nn.Linear(128, OUTPUT_SHOOT)
        self.head_skill = nn.Linear(128, OUTPUT_SKILL)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        
        move = self.head_move(x)
        aim = self.head_aim(x)
        shoot = self.head_shoot(x)
        skill = self.head_skill(x)
        
        return move, aim, shoot, skill

# ==========================================
# 3. LOAD & PROCESS DATA
# ==========================================
class NeonDataset(Dataset):
    def __init__(self, data_dir):
        self.samples = []
        
        # Find all .jsonl files in data folder
        files = glob.glob(os.path.join(data_dir, '*.jsonl'))
        
        # Fallback to legacy .json if no .jsonl found
        if not files:
            files = glob.glob('*.json')

        print(f"Found {len(files)} log files. Loading...")

        for file_path in files:
            with open(file_path, 'r') as f:
                if file_path.endswith('.jsonl'):
                    # JSON Lines format
                    for line in f:
                        if line.strip():
                            try:
                                entry = json.loads(line)
                                self._add_entry(entry)
                            except:
                                pass # Skip bad lines
                else:
                    # Legacy JSON Array format
                    try:
                        data = json.load(f)
                        for entry in data:
                            self._add_entry(entry)
                    except:
                        pass

    def _add_entry(self, entry):
        # Inputs: "state"
        s = entry['state']
        obs = [s['hp'], s['enemyHp'], s['distToEnemy'], s['angleToEnemy'], 
               s['ammo'], s['canDash'], s['canShield']]
        
        # Targets: "action" (Discrete Indices)
        a = entry['action']
        
        self.samples.append({
            'obs': torch.tensor(obs, dtype=torch.float32),
            'move': torch.tensor(a['moveIndex'], dtype=torch.long),
            'aim': torch.tensor(a['aimIndex'], dtype=torch.long),
            'shoot': torch.tensor(a['shoot'], dtype=torch.long),
            'skill': torch.tensor(a['skillIndex'], dtype=torch.long)
        })

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]

# ==========================================
# 4. TRAINING LOOP
# ==========================================
def train():
    dataset = NeonDataset(DATA_DIR)
    if len(dataset) == 0: 
        print("No training data found in /data folder!")
        return

    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    model = BotBrain()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.CrossEntropyLoss() # Standard for classification

    print(f"Training on {len(dataset)} samples for {EPOCHS} epochs...")

    for epoch in range(EPOCHS):
        total_loss = 0
        for batch in dataloader:
            obs = batch['obs']
            target_move = batch['move']
            target_aim = batch['aim']
            target_shoot = batch['shoot']
            target_skill = batch['skill']

            # Forward Pass
            out_move, out_aim, out_shoot, out_skill = model(obs)

            # Calculate Loss (Sum of losses from all heads)
            loss_move = criterion(out_move, target_move)
            loss_aim = criterion(out_aim, target_aim)
            loss_shoot = criterion(out_shoot, target_shoot)
            loss_skill = criterion(out_skill, target_skill)
            
            loss = loss_move + loss_aim + loss_shoot + loss_skill

            # Backward Pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        print(f"Epoch {epoch+1}/{EPOCHS} | Loss: {total_loss/len(dataloader):.4f}")

    print("Training Complete!")
    
    # Save Model
    torch.save(model.state_dict(), 'bot_brain.pth')
    print("Model saved to 'bot_brain.pth'")

    # Export to ONNX (For use in Web)
    dummy_input = torch.randn(1, INPUT_SIZE)
    torch.onnx.export(model, dummy_input, "bot_brain.onnx", 
                      input_names=['observation'], 
                      output_names=['move', 'aim', 'shoot', 'skill'])
    print("Model exported to 'bot_brain.onnx' for web usage!")

if __name__ == "__main__":
    train()
