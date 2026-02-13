
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
                this.isConnected = false;
            };

        } catch (e) {
            console.log("Server not available.");
        }
    }

    // Helper to update UI based on server status
    toggleRecordUI(connected: boolean) {
        const dwnBtn = document.getElementById('download-btn');
        if (dwnBtn) {
            if (connected) {
                dwnBtn.style.display = 'none'; // No need to download manually
                const recBtn = document.getElementById('record-btn');
                if(recBtn) recBtn.innerText = "Start Recording (Server Active)";
            } else {
                dwnBtn.style.display = 'block';
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
            if (this.logs.length > 10000) this.logs.shift();
        }
    }

    downloadLogs() {
        if (this.isConnected) {
            alert("Data is already saved in the /data folder via server.js!");
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
