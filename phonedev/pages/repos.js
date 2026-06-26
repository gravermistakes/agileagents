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
    _editing: false,
    _editContent: null,
    _predictTimer: null,
    _predictVisible: false,

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
                    <button class="btn btn-secondary" onclick="ReposPage.startEdit()" style="flex:1">Edit</button>
                    <button class="btn btn-secondary" onclick="ReposPage.sendToAI()" style="flex:1">Ask AI</button>
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

    startEdit() {
        if (!this._fileContent) return;
        this._editing = true;
        this._editContent = this._fileContent;
        const name = this._currentPath.split('/').pop();
        const container = document.getElementById('page-container');

        container.innerHTML = `
            <div class="page active" id="page-repos">
                <div class="page-header">
                    <button class="back-btn" onclick="ReposPage.cancelEdit()">Cancel</button>
                    <h1 style="font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.escapeHtml(name)}</h1>
                </div>
                <div class="symbol-bar" id="symbol-bar">
                    <button onclick="ReposPage.insertSymbol('\\t')">Tab</button>
                    <button onclick="ReposPage.insertSymbol('{}')">{ }</button>
                    <button onclick="ReposPage.insertSymbol('()')">( )</button>
                    <button onclick="ReposPage.insertSymbol('[]')">[ ]</button>
                    <button onclick="ReposPage.insertSymbol('&quot;&quot;')">" "</button>
                    <button onclick="ReposPage.insertSymbol(&quot;''&quot;)">' '</button>
                    <button onclick="ReposPage.insertSymbol(';')">;</button>
                    <button onclick="ReposPage.insertSymbol('=')">=</button>
                    <button onclick="ReposPage.insertSymbol('=&gt;')">=&gt;</button>
                    <button onclick="ReposPage.insertSymbol('//')">//</button>
                </div>
                <textarea id="code-editor" class="code-editor" spellcheck="false" autocomplete="off" autocapitalize="off">${UI.escapeHtml(this._fileContent)}</textarea>
                <div class="file-actions" style="margin-top:8px">
                    <button class="btn" onclick="ReposPage.showCommitDialog()" style="flex:1">Commit</button>
                </div>
            </div>`;

        const editor = document.getElementById('code-editor');
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertSymbol('    ');
            }
            if (e.key === 'Enter') {
                const pos = editor.selectionStart;
                const before = editor.value.substring(0, pos);
                const currentLine = before.split('\n').pop();
                const indent = currentLine.match(/^\s*/)[0];
                if (indent) {
                    e.preventDefault();
                    this.insertSymbol('\n' + indent);
                }
            }
        });
        editor.addEventListener('input', () => {
            this._editContent = editor.value;
            this._schedulePrediction(editor);
        });
    },

    insertSymbol(sym) {
        const editor = document.getElementById('code-editor');
        if (!editor) return;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const val = editor.value;
        const pairs = { '{}': 1, '()': 1, '[]': 1, '""': 1, "''": 1 };

        editor.value = val.substring(0, start) + sym + val.substring(end);
        const cursorPos = pairs[sym] ? start + 1 : start + sym.length;
        editor.selectionStart = editor.selectionEnd = cursorPos;
        editor.focus();
        this._editContent = editor.value;
    },

    cancelEdit() {
        this._editing = false;
        this._editContent = null;
        this._view = 'file';
        this.render();
    },

    showCommitDialog() {
        if (this._editContent === this._fileContent) {
            UI.toast('No changes to commit');
            return;
        }

        const name = this._currentPath.split('/').pop();
        const diff = this._simpleDiff(this._fileContent, this._editContent);

        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page active" id="page-repos">
                <div class="page-header">
                    <button class="back-btn" onclick="ReposPage.startEdit()">← Back</button>
                    <h1 style="font-size:16px">Commit Changes</h1>
                </div>
                <div class="card">
                    <div class="card-header">Diff Preview</div>
                    <div class="diff-view">${diff}</div>
                </div>
                <div class="card">
                    <div class="card-header">Commit Message</div>
                    <input id="commit-msg" type="text" placeholder="Update ${UI.escapeAttr(name)}" value="Update ${UI.escapeAttr(name)}">
                </div>
                <button class="btn" onclick="ReposPage.commitChanges()" id="commit-btn">Commit & Push</button>
            </div>`;
    },

    _simpleDiff(oldText, newText) {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const maxLines = Math.max(oldLines.length, newLines.length);
        let html = '';
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];
            if (oldLine === newLine) continue;
            if (oldLine !== undefined && newLine === undefined) {
                html += `<div class="diff-del">- ${UI.escapeHtml(oldLine)}</div>`;
            } else if (oldLine === undefined && newLine !== undefined) {
                html += `<div class="diff-add">+ ${UI.escapeHtml(newLine)}</div>`;
            } else {
                html += `<div class="diff-del">- ${UI.escapeHtml(oldLine)}</div>`;
                html += `<div class="diff-add">+ ${UI.escapeHtml(newLine)}</div>`;
            }
        }
        return html || '<div style="color:var(--text-muted);padding:8px">No visible changes</div>';
    },

    async commitChanges() {
        const msgEl = document.getElementById('commit-msg');
        const btn = document.getElementById('commit-btn');
        const message = msgEl ? msgEl.value.trim() : '';
        if (!message) { UI.toast('Enter a commit message'); return; }

        btn.disabled = true;
        btn.textContent = 'Committing...';

        try {
            const result = await GitHub.updateFile(
                this._currentOwner, this._currentRepo,
                this._currentPath, this._editContent, this._fileSha, message
            );
            this._fileSha = result.content.sha;
            this._fileContent = this._editContent;
            this._editing = false;
            this._editContent = null;
            UI.toast('Committed!');
            this._view = 'file';
            this.render();
        } catch (e) {
            btn.disabled = false;
            btn.textContent = 'Commit & Push';
            UI.toast('Commit failed: ' + e.message);
        }
    },

    _schedulePrediction(editor) {
        if (this._predictTimer) clearTimeout(this._predictTimer);
        this._hidePredictions();
        if (!AI.isConnected()) return;

        this._predictTimer = setTimeout(() => {
            this._fetchPrediction(editor);
        }, 800);
    },

    async _fetchPrediction(editor) {
        if (!editor || !this._editing) return;
        const pos = editor.selectionStart;
        const text = editor.value;
        if (!text.trim()) return;

        const before = text.substring(Math.max(0, pos - 500), pos);
        const after = text.substring(pos, Math.min(text.length, pos + 100));
        const name = (this._currentPath || '').split('/').pop() || 'file';
        const lang = this._getLang(name) || '';

        const prompt = `Complete the code at the cursor position (marked with <CURSOR>). Return ONLY 1-3 short completions, each on its own line, no explanation, no markdown. Each completion should be a single statement or expression.\n\nLanguage: ${lang}\nFile: ${name}\n\n${before}<CURSOR>${after}`;

        try {
            const response = await AI.send([
                { role: 'system', content: 'You are a code autocomplete engine. Return only raw completion text, one per line. No markdown, no explanation. Max 3 lines.' },
                { role: 'user', content: prompt }
            ]);
            if (!response || !this._editing) return;

            const completions = response.split('\n')
                .map(l => l.trim())
                .filter(l => l && l.length > 1 && l.length < 120 && !l.startsWith('```'))
                .slice(0, 3);

            if (completions.length) this._showPredictions(completions, editor);
        } catch {
            // silently fail — predictive coding is best-effort
        }
    },

    _showPredictions(completions, editor) {
        this._hidePredictions();
        const bar = document.getElementById('symbol-bar');
        if (!bar) return;

        const wrap = document.createElement('div');
        wrap.id = 'predict-chips';
        wrap.className = 'predict-chips';
        completions.forEach(c => {
            const chip = document.createElement('button');
            chip.className = 'predict-chip';
            chip.textContent = c.length > 50 ? c.substring(0, 47) + '...' : c;
            chip.title = c;
            chip.addEventListener('click', () => {
                this.insertSymbol(c);
                this._hidePredictions();
            });
            wrap.appendChild(chip);
        });

        bar.parentNode.insertBefore(wrap, bar);
        this._predictVisible = true;
    },

    _hidePredictions() {
        const el = document.getElementById('predict-chips');
        if (el) el.remove();
        this._predictVisible = false;
    },
};
