const HomePage = {
    render() {
        const container = document.getElementById('page-container');
        const ghConnected = GitHub.isConnected();
        const aiConnected = AI.isConnected();

        container.innerHTML = `
            <div class="page active" id="page-home">
                <div class="page-header">
                    <h1>PhoneDev</h1>
                </div>

                <div class="card">
                    <div class="card-header">Status</div>
                    <div style="display:flex;gap:12px;flex-wrap:wrap">
                        <span class="badge ${ghConnected ? 'connected' : 'disconnected'}">
                            GitHub ${ghConnected ? 'Connected' : 'Not Set'}
                        </span>
                        <span class="badge ${aiConnected ? 'connected' : 'disconnected'}">
                            ${UI.escapeHtml(AI.PROVIDERS[AI._provider].name)} ${aiConnected ? 'Connected' : 'Not Set'}
                        </span>
                    </div>
                    ${(!ghConnected || !aiConnected) ? `
                        <p style="color:var(--text-muted);font-size:13px;margin-top:12px">
                            Go to Settings to add your API keys
                        </p>
                    ` : ''}
                </div>

                ${ghConnected ? `
                    <div class="card" id="home-recent">
                        <div class="card-header">Recent Repos</div>
                        <div id="home-repos-list">
                            <div style="text-align:center;padding:16px"><span class="spinner"></span></div>
                        </div>
                    </div>
                ` : `
                    <div class="card">
                        <div class="empty-state">
                            <div class="emoji">🔑</div>
                            <p>Add your GitHub token in Settings to get started</p>
                            <button class="btn" onclick="App.navigate('settings')">Open Settings</button>
                        </div>
                    </div>
                `}

                <div class="card">
                    <div class="card-header">Quick Actions</div>
                    <button class="btn btn-secondary" onclick="App.navigate('chat')" style="margin-bottom:8px">
                        💬 Ask AI
                    </button>
                    <button class="btn btn-secondary" onclick="App.navigate('repos')" style="margin-bottom:8px">
                        📁 Browse Repos
                    </button>
                    <button class="btn btn-secondary" onclick="App.navigate('projects')" style="margin-bottom:8px">
                        📋 Task Board
                    </button>
                    <button class="btn btn-secondary" onclick="App.navigate('apps')">
                        📱 Apps & Terminal
                    </button>
                </div>

                ${ProjectsPage._projects.length ? `
                    <div class="card">
                        <div class="card-header">Active Tasks</div>
                        <div id="home-tasks-list">
                            ${this._renderActiveTasks()}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        if (ghConnected) this.loadRecentRepos();
    },

    _renderActiveTasks() {
        const doing = [];
        ProjectsPage._projects.forEach((p, pi) => {
            p.tasks.forEach((t, ti) => {
                if (t.status === 'doing') doing.push({ project: p.name, text: t.text, pi, ti });
            });
        });
        if (!doing.length) return '<p style="color:var(--text-muted);font-size:13px;padding:4px 0">No tasks in progress</p>';
        return doing.slice(0, 5).map(t => `
            <div class="list-item" onclick="ProjectsPage.openProject(${t.pi}); App.navigate('projects')">
                <div>
                    <div class="title">${UI.escapeHtml(t.text)}</div>
                    <div class="subtitle">${UI.escapeHtml(t.project)}</div>
                </div>
            </div>
        `).join('');
    },

    async loadRecentRepos() {
        try {
            const repos = await GitHub.getRepos();
            const list = document.getElementById('home-repos-list');
            if (!list) return;

            list.innerHTML = repos.slice(0, 5).map(repo => `
                <div class="list-item" onclick="ReposPage.openRepo('${UI.escapeAttr(repo.owner.login)}', '${UI.escapeAttr(repo.name)}'); App.navigate('repos')">
                    <div>
                        <div class="title">${UI.escapeHtml(repo.name)}</div>
                        <div class="subtitle">${UI.timeAgo(repo.updated_at)} · ${repo.language || 'Unknown'}</div>
                    </div>
                    <span class="chevron">›</span>
                </div>
            `).join('');
        } catch (e) {
            const list = document.getElementById('home-repos-list');
            if (list) list.innerHTML = `<p style="color:var(--red);padding:8px">${UI.escapeHtml(e.message)}</p>`;
        }
    },
};
