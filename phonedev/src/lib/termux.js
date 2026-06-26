import { showToast } from '../stores.js';

const Termux = {
    _available: false,
    _history: [],

    isAvailable() { return this._available; },

    tryConnect() {
        try {
            const intent = 'intent:#Intent;action=com.termux.RUN_COMMAND;' +
                'S.com.termux.RUN_COMMAND_PATH=/data/data/com.termux/files/usr/bin/echo;' +
                'S.com.termux.RUN_COMMAND_ARGUMENTS=mobide-ping;' +
                'component=com.termux/.app.RunCommandService;end';
            window.location.href = intent;
            this._available = true;
            showToast('Termux intent sent');
        } catch {
            this._available = false;
            showToast('Termux not detected');
        }
    },

    async execute(cmd) {
        this._history.push({ type: 'cmd', text: '$ ' + cmd, ts: Date.now() });
        if (!cmd) return { output: '', error: false };

        try {
            const intent = 'intent:#Intent;action=com.termux.RUN_COMMAND;' +
                `S.com.termux.RUN_COMMAND_PATH=/data/data/com.termux/files/usr/bin/bash;` +
                `S.com.termux.RUN_COMMAND_ARGUMENTS=-c ${encodeURIComponent(cmd)};` +
                'component=com.termux/.app.RunCommandService;end';
            window.location.href = intent;
            this._available = true;
            const msg = `Sent to Termux: ${cmd}`;
            this._history.push({ type: 'result', text: msg, ts: Date.now() });
            return { output: msg, error: false };
        } catch (e) {
            const msg = 'Termux not available. Install from F-Droid and grant permissions.';
            this._history.push({ type: 'error', text: msg, ts: Date.now() });
            return { output: msg, error: true };
        }
    },

    addOutput(text, type) {
        this._history.push({ type, text, ts: Date.now() });
        if (this._history.length > 200) this._history.splice(0, 50);
    },

    getHistory() { return this._history; },
};

export default Termux;
