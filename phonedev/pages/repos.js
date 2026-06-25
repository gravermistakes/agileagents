const ReposPage = {
    _currentOwner: null,
    _currentRepo: null,
    _currentPath: '',
    _view: 'list', // 'list' | 'tree' | 'file'
    _fileSha: null,
    _fileContent: null,

    render() {
        const container = document.getElementById('page-container');

        if (!GitHub.isConnected()) {
            container.innerHTML = `
                <div class="page active" id="page-repos">
                    <div class="empty-state">
                        <div class="emoji">🔗</div>
                        <p>Connect GitHub in Settings first</p>
                        <button class="btn" onclick="App.navigate('settings')">Open Settings</button>
                    </div>
                </div>`;
            return;
        }

        if (this._view === 'file') {
            this.renderFileView(container);
        } else if (this._view === 'tree') {
            this.renderTree(container);
        } else {
            this.renderRepoList(container);
        }
    },

    renderRepoList(container) {
        container.innerHTML = `
            <div class="page active" id="page-repos">
                <div class="page-header"><h1>Repos</h1></div>
                <div id="repo-list">
                    <div style="text-align:center;padding:24px"><span class="spinner"></span></div>
                </div>
            </div>`;
        this.loadRepos();
    },

    async loadRepos() {
        try {
            const repos = await GitHub.getRepos();
            const el = document.getElementById('repo-list');
            if (!el) return;
            el.innerHTML = repos.map(repo => `
                <div class="list-item" onclick="ReposPage.openRepo('${repo.owner.login}', '${repo.name}')">
                    <div class="icon">${repo.private ? '🔒' : '📦'}</div>
                    <div>
                        <div class="title">${UI.escapeHtml(repo.name)}</div>
                        <div class="subtitle">${repo.language || ''} · ${UI.timeAgo(repo.updated_at)} · ${UI.formatSize(repo.size * 1024)}</div>
                    </div>
                    <span class="chevron">›</span>
                </div>
            `).join('');
        } catch (e) {
            document.getElementById('repo-list').innerHTML =
                `<p style="color:var(--red);padding:16px">${UI.escapeHtml(e.message)}</p>`;
        }
    },

    openRepo(owner, repo) {
        this._currentOwner = owner;
        this._currentRepo = repo;
        this._currentPath = '';
        this._view = 'tree';
        this.render();
    },

    renderTree(container) {
        const pathParts = this._currentPath ? this._currentPath.split('/') : [];

        container.innerHTML = `
            <div class="page active" id="page-repos">
                <div class="page-header">
                    <button class="back-btn" onclick="ReposPage.goBack()">← Back</button>
                    <h1>${UI.escapeHtml(this._currentRepo)}</h1>
                </div>
                <div class="breadcrumbs">
                    <a onclick="ReposPage.navigateTo('')">root</a>
                    ${pathParts.map((part, i) => {
                        const path = pathParts.slice(0, i + 1).join('/');
                        return `<span class="sep">/</span><a onclick="ReposPage.navigateTo('${path}')">${UI.escapeHtml(part)}</a>`;
                    }).join('')}
                </div>
                <div id="file-tree">
                    <div style="text-align:center;padding:24px"><span class="spinner"></span></div>
                </div>
            </div>`;
        this.loadTree();
    },

    async loadTree() {
        try {
            const contents = await GitHub.getContents(this._currentOwner, this._currentRepo, this._currentPath);
            const el = document.getElementById('file-tree');
            if (!el) return;

            const sorted = Array.isArray(contents) ?
                contents.sort((a, b) => {
                    if (a.type === 'dir' && b.type !== 'dir') return -1;
                    if (a.type !== 'dir' && b.type === 'dir') return 1;
                    return a.name.localeCompare(b.name);
                }) : [contents];

            el.innerHTML = sorted.map(item => `
                <div class="file-item ${item.type === 'dir' ? 'dir' : ''}"
                     onclick="ReposPage.${item.type === 'dir' ? 'navigateTo' : 'openFile'}('${item.path}')">
                    <span class="file-icon">${UI.fileIcon(item.name, item.type === 'dir')}</span>
                    <span class="file-name">${UI.escapeHtml(item.name)}</span>
                    ${item.size ? `<span style="color:var(--text-muted);font-size:12px">${UI.formatSize(item.size)}</span>` : ''}
                </div>
            `).join('');
        } catch (e) {
            document.getElementById('file-tree').innerHTML =
                `<p style="color:var(--red);padding:16px">${UI.escapeHtml(e.message)}</p>`;
        }
    },

    navigateTo(path) {
        this._currentPath = path;
        this._view = 'tree';
        this.render();
    },

    async openFile(path) {
        this._currentPath = path;
        this._view = 'file';

        const container = document.getElementById('page-container');
        const name = path.split('/').pop();

        container.innerHTML = `
            <div class="page active" id="page-repos">
                <div class="page-header">
                    <button class="back-btn" onclick="ReposPage.goBack()">← Back</button>
                    <h1 style="font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.escapeHtml(name)}</h1>
                </div>
                <div id="file-content">
                    <div style="text-align:center;padding:24px"><span class="spinner"></span></div>
                </div>
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button class="btn btn-secondary" onclick="ReposPage.copyFileContent()" style="flex:1">Copy</button>
                    <button class="btn btn-secondary" onclick="ReposPage.sendToAI()" style="flex:1">Send to AI</button>
                </div>
            </div>`;

        try {
            const file = await GitHub.getFileContent(this._currentOwner, this._currentRepo, path);
            this._fileContent = file.content;
            this._fileSha = file.sha;
            document.getElementById('file-content').innerHTML =
                `<div class="code-view">${UI.escapeHtml(file.content)}</div>`;
        } catch (e) {
            document.getElementById('file-content').innerHTML =
                `<p style="color:var(--red)">${UI.escapeHtml(e.message)}</p>`;
        }
    },

    goBack() {
        if (this._view === 'file') {
            const parts = this._currentPath.split('/');
            parts.pop();
            this._currentPath = parts.join('/');
            this._view = 'tree';
        } else if (this._view === 'tree' && this._currentPath) {
            const parts = this._currentPath.split('/');
            parts.pop();
            this._currentPath = parts.join('/');
        } else {
            this._view = 'list';
            this._currentOwner = null;
            this._currentRepo = null;
            this._currentPath = '';
        }
        this.render();
    },

    copyFileContent() {
        if (this._fileContent) {
            navigator.clipboard.writeText(this._fileContent)
                .then(() => UI.toast('Copied!'))
                .catch(() => UI.toast('Copy failed'));
        }
    },

    sendToAI() {
        if (this._fileContent) {
            const name = this._currentPath.split('/').pop();
            ChatPage._pendingContext = `\`${name}\`:\n\`\`\`\n${this._fileContent}\n\`\`\`\n\n`;
            App.navigate('chat');
            UI.toast('File attached to chat');
        }
    },
};
