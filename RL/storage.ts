import { Experience } from './types';

export class RLStorage {
    private logs: Experience[] = [];

    saveExperience(exp: Experience) {
        this.logs.push(exp);
        // Limit memory usage in browser
        if (this.logs.length > 10000) this.logs.shift();
    }

    // Since we cannot write to SQLite on disk in a static web page without a backend,
    // we offer a JSON download of the training data.
    downloadLogs() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.logs));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "rl_training_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        console.log("Logs downloaded.");
    }

    // If running in a Node.js context (headless training), this would connect to SQLite.
    // For now, we mock the interface.
    async saveToSQLite() {
        console.warn("SQLite save is not available in browser environment. Use downloadLogs() instead.");
        // Placeholder for Node.js logic:
        // const db = new Database('training.db');
        // db.prepare('INSERT INTO experiences ...').run(...);
    }
}