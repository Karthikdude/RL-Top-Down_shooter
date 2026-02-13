import { Experience } from './types';

export class RLStorage {
    private logs: Experience[] = [];
    private socket: WebSocket | null = null;
    private isConnected: boolean = false;

    constructor() {
        this.connectToServer();
    }

    connectToServer() {
        try {
            // Attempt to connect to local Node.js server
            this.socket = new WebSocket('ws://localhost:8080');
            
            this.socket.onopen = () => {
                console.log("%c[RLStorage] Connected to Local Data Server", "color: #4ade80");
                this.isConnected = true;
                this.toggleRecordUI(true);
            };

            this.socket.onclose = () => {
                console.warn("[RLStorage] Local Server disconnected. Falling back to browser memory.");
                this.isConnected = false;
                this.toggleRecordUI(false);
            };

            this.socket.onerror = () => {
                // Silent fail: User probably didn't run server.js
                // We don't want to spam the console
                this.isConnected = false;
                this.toggleRecordUI(false);
            };

        } catch (e) {
            console.log("Server not available, using local storage.");
            this.isConnected = false;
        }
    }

    // Helper to update UI based on server status
    toggleRecordUI(connected: boolean) {
        const dwnBtn = document.getElementById('download-btn');
        const recBtn = document.getElementById('record-btn');
        
        if (dwnBtn && recBtn) {
            if (connected) {
                dwnBtn.style.display = 'none'; // No need to download manually
                if (recBtn.innerText.includes('Start')) {
                    recBtn.innerText = "Start Recording (Server Active)";
                }
            } else {
                dwnBtn.style.display = 'block';
                if (recBtn.innerText.includes('Server Active')) {
                    recBtn.innerText = "Start Recording";
                }
            }
        }
    }

    saveExperience(exp: Experience) {
        if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            // STREAM MODE: Send directly to server
            this.socket.send(JSON.stringify(exp));
        } else {
            // FALLBACK MODE: Save to RAM
            this.logs.push(exp);
            // Limit RAM usage to last 10k frames (approx 3 mins) to prevent crashes
            if (this.logs.length > 10000) this.logs.shift();
        }
    }

    downloadLogs() {
        if (this.isConnected) {
            alert("Data is already saved in the /data folder via server.js!");
            return;
        }

        if (this.logs.length === 0) {
            alert("No data recorded yet! Play a game while recording first.");
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.logs));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "rl_training_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        console.log("Logs downloaded.");
    }
}