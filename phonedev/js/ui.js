const UI = {
    toast(msg, duration = 2500) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    timeAgo(dateStr) {
        const now = Date.now();
        const then = new Date(dateStr).getTime();
        const diff = Math.floor((now - then) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
        return new Date(dateStr).toLocaleDateString();
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeAttr(str) {
        return String(str).replace(/[&'"\\]/g, c => ({
            '&': '&amp;', "'": '&#39;', '"': '&quot;', '\\': '\\\\'
        })[c]);
    },

    _codeBlockId: 0,

    renderMarkdown(text) {
        let html = this.escapeHtml(text);
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const id = 'cb-' + (++this._codeBlockId);
            return `<div class="code-block-wrap"><button class="copy-code-btn" onclick="UI.copyCode('${id}')">Copy</button><pre id="${id}"><code>${code.trim()}</code></pre></div>`;
        });
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    },

    copyCode(id) {
        const el = document.getElementById(id);
        if (!el) return;
        navigator.clipboard.writeText(el.textContent)
            .then(() => this.toast('Copied!'))
            .catch(() => this.toast('Copy failed'));
    },

    fileIcon(name, isDir) {
        if (isDir) return '📁';
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            js: '🟡', ts: '🔵', py: '🐍', rs: '🦀',
            zig: '⚡', c3: '🔶', go: '🐹', rb: '💎',
            html: '🌐', css: '🎨', json: '📋', md: '📝',
            yml: '⚙️', yaml: '⚙️', toml: '⚙️',
            sh: '📟', bash: '📟',
            png: '🖼️', jpg: '🖼️', svg: '🖼️',
        };
        return icons[ext] || '📄';
    },
};
