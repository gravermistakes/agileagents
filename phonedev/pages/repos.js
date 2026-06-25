const ReposPage = {
    _currentOwner: null,
    _currentRepo: null,
    _currentPath: '',
    _view: 'list',
    _fileSha: null,
    _fileContent: null,
    _allRepos: null,
    _treeItems: null,
    _hljsLoaded: false,

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
                <input id="repo-search" type="search" placeholder="Filter repos..." oninput="ReposPage.filterRepos(this.value)" style="margin-bottom:12px">
                <div id="repo-list">
                    <div style="text-align:center;padding:24px"><span class="spinner"></span></div>
                </div>
            </div>`;
        this.loadRepos();
    },

    async loadRepos() {
        try {
            const repos = await GitHub.getRepos();
            this._allRepos = repos;
            this.renderRepoItems(repos);
        } catch (e) {
            document.getElementById('repo-list').innerHTML =
                `<p style="color:var(--red);padding:16px">${UI.escapeHtml(e.message)}</p>`;
        }
    },

    renderRepoItems(repos) {
        const el = document.getElementById('repo-list');
        if (!el) return;
        if (!repos.length) {
            el.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center">No matching repos</p>';
            return;
        }
        el.innerHTML = repos.map(repo => `
            <div class="list-item" onclick="ReposPage.openRepo('${UI.escapeAttr(repo.owner.login)}', '${UI.escapeAttr(repo.name)}')">
                <div class="icon">${repo.private ? '🔒' : '📦'}</div>
                <div>
                    <div class="title">${UI.escapeHtml(repo.name)}</div>
                    <div class="subtitle">${repo.language || ''} · ${UI.timeAgo(repo.updated_at)} · ${UI.formatSize(repo.size * 1024)}</div>
                </div>
                <span class="chevron">›</span>
            </div>
        `).join('');
    },

    filterRepos(query) {
        if (!this._allRepos) return;
        const q = query.toLowerCase();
        const filtered = q ? this._allRepos.filter(r =>
            r.name.toLowerCase().includes(q) ||
            (r.language || '').toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q)
        ) : this._allRepos;
        this.renderRepoItems(filtered);
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
                        return `<span class="sep">/</span><a onclick="ReposPage.navigateTo('${UI.escapeAttr(path)}')">${UI.escapeHtml(part)}</a>`;
                    }).join('')}
                </div>
                <input id="tree-search" type="search" placeholder="Filter files..." oninput="ReposPage.filterTree(this.value)" style="margin-bottom:8px">
                <div id="file-tree">
                    <div style="text-align:center;padding:24px"><span class="spinner"></span></div>
                </div>
            </div>`;
        this.loadTree();
    },

    async loadTree() {
        try {
            const contents = await GitHub.getContents(this._currentOwner, this._currentRepo, this._currentPath);
            this._treeItems = Array.isArray(contents) ?
                contents.sort((a, b) => {
                    if (a.type === 'dir' && b.type !== 'dir') return -1;
                    if (a.type !== 'dir' && b.type === 'dir') return 1;
                    return a.name.localeCompare(b.name);
                }) : [contents];
            this.renderTreeItems(this._treeItems);
        } catch (e) {
            document.getElementById('file-tree').innerHTML =
                `<p style="color:var(--red);padding:16px">${UI.escapeHtml(e.message)}</p>`;
        }
    },

    renderTreeItems(items) {
        const el = document.getElementById('file-tree');
        if (!el) return;
        if (!items.length) {
            el.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center">No matching files</p>';
            return;
        }
        el.innerHTML = items.map(item => `
            <div class="file-item ${item.type === 'dir' ? 'dir' : ''}"
                 onclick="ReposPage.${item.type === 'dir' ? 'navigateTo' : 'openFile'}('${UI.escapeAttr(item.path)}')">
                <span class="file-icon">${UI.fileIcon(item.name, item.type === 'dir')}</span>
                <span class="file-name">${UI.escapeHtml(item.name)}</span>
                ${item.size ? `<span style="color:var(--text-muted);font-size:12px">${UI.formatSize(item.size)}</span>` : ''}
            </div>
        `).join('');
    },

    filterTree(query) {
        if (!this._treeItems) return;
        const q = query.toLowerCase();
        const filtered = q ? this._treeItems.filter(item =>
            item.name.toLowerCase().includes(q)
        ) : this._treeItems;
        this.renderTreeItems(filtered);
    },

    navigateTo(path) {
        this._currentPath = path;
        this._view = 'tree';
        this.render();
    },

    _getLang(name) {
        const ext = name.split('.').pop().toLowerCase();
        const map = {
            js: 'javascript', mjs: 'javascript', cjs: 'javascript',
            ts: 'typescript', tsx: 'typescript',
            jsx: 'javascript',
            py: 'python', pyw: 'python',
            rb: 'ruby', rs: 'rust', go: 'go',
            java: 'java', kt: 'kotlin', swift: 'swift',
            c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
            cs: 'csharp', php: 'php',
            html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
            css: 'css', scss: 'scss', less: 'less',
            json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
            md: 'markdown', sh: 'bash', bash: 'bash', zsh: 'bash',
            sql: 'sql', zig: 'zig', lua: 'lua', r: 'r',
            dockerfile: 'dockerfile', makefile: 'makefile',
        };
        return map[ext] || null;
    },

    async _loadHljs() {
        if (this._hljsLoaded) return;
        if (window.hljs) { this._hljsLoaded = true; return; }
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js';
            script.onload = () => { this._hljsLoaded = true; resolve(); };
            script.onerror = () => resolve();
            document.head.appendChild(script);
        });
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
                <div class="file-actions">
                    <button class="btn btn-secondary" onclick="ReposPage.copyFileContent()" style="flex:1">Copy</button>
                    <button class="btn btn-secondary" onclick="ReposPage.sendToAI()" style="flex:1">Send to AI</button>
                </div>
            </div>`;

        try {
            const file = await GitHub.getFileContent(this._currentOwner, this._currentRepo, path);
            this._fileContent = file.content;
            this._fileSha = file.sha;

            const lang = this._getLang(name);
            const lines = file.content.split('\n');
            const lineNums = lines.map((_, i) => `<span>${i + 1}</span>`).join('\n');
            const codeHtml = UI.escapeHtml(file.content);

            const el = document.getElementById('file-content');
            el.innerHTML = `
                <div class="code-viewer">
                    <div class="code-viewer-header">
                        <span>${UI.escapeHtml(name)}</span>
                        <span class="text-muted">${lines.length} lines · ${UI.formatSize(file.content.length)}</span>
                    </div>
                    <div class="code-viewer-body">
                        <div class="line-numbers">${lineNums}</div>
                        <pre><code id="file-code" class="${lang ? 'language-' + lang : ''}">${codeHtml}</code></pre>
                    </div>
                </div>`;

            if (lang) {
                this._loadHljs().then(() => {
                    if (window.hljs) {
                        const codeEl = document.getElementById('file-code');
                        if (codeEl) hljs.highlightElement(codeEl);
                    }
                });
            }
        } catch (e) {
            document.getElementById('file-content').innerHTML =
                `<p style="color:var(--red)">${UI.escapeHtml(e.message)}</p>`;
        }
    },

    renderFileView(container) {
        this.openFile(this._currentPath);
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
            const fence = '`'.repeat(Math.max(3, (this._fileContent.match(/`{3,}/g) || []).reduce((m, s) => Math.max(m, s.length), 0) + 1));
            ChatPage._pendingContext = `\`${name}\`:\n${fence}\n${this._fileContent}\n${fence}\n\n`;
            ChatPage._pendingFileName = name;
            App.navigate('chat');
            UI.toast('File attached');
        }
    },
};
