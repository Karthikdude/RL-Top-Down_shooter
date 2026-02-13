const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// CONFIG
const PORT = 8080;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)){
    fs.mkdirSync(DATA_DIR);
}

// Create a unique filename based on timestamp
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const filename = path.join(DATA_DIR, `training_session_${timestamp}.jsonl`);

// Create Write Stream (JSONL format - one JSON object per line)
const stream = fs.createWriteStream(filename, { flags: 'a' });

console.log(`[Server] Saving training data to: ${filename}`);

// Start WebSocket Server
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[Server] Game connected!');

    ws.on('message', (message) => {
        // We expect stringified JSON
        stream.write(message + '\n');
    });

    ws.on('close', () => {
        console.log('[Server] Game disconnected.');
    });
});

console.log(`[Server] Listening on ws://localhost:${PORT}`);
console.log(`[Server] Play the game to record data!`);