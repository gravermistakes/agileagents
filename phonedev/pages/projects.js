const ProjectsPage = {
    _projects: [],
    _activeProject: null,
    _view: 'list',

    COLUMNS: ['todo', 'doing', 'done'],
    COLUMN_LABELS: { todo: 'To Do', doing: 'In Progress', done: 'Done' },

    async init() {
        const data = await Storage.getJSON('projects');
        if (data) this._projects = data;
    },

    async _save() {
        await Storage.setJSON('projects', this._projects);
    },

    render() {
        const container = document.getElementById('page-container');
        if (this._view === 'board' && this._activeProject !== null) {
            this.renderBoard(container);
        } else {
            this.renderList(container);
        }
    },

    renderList(container) {
        container.innerHTML = `
            <div class="page active" id="page-projects">
                <div class="page-header">
                    <h1>Projects</h1>
                    <button class="back-btn" onclick="ProjectsPage.showAddProject()" style="margin-left:auto;font-size:24px;color:var(--accent)">+</button>
                </div>
                <div id="add-project-form" style="display:none;margin-bottom:12px">
                    <input id="new-project-name" type="text" placeholder="Project name..." style="margin-bottom:8px">
                    <div style="display:flex;gap:8px">
                        <button class="btn" onclick="ProjectsPage.addProject()" style="flex:1">Create</button>
                        <button class="btn btn-secondary" onclick="document.getElementById('add-project-form').style.display='none'" style="flex:1">Cancel</button>
                    </div>
                </div>
                ${this._projects.length ? this._projects.map((p, i) => {
                    const taskCount = p.tasks.length;
                    const doneCount = p.tasks.filter(t => t.status === 'done').length;
                    const progress = taskCount ? Math.round((doneCount / taskCount) * 100) : 0;
                    return `
                        <div class="list-item" onclick="ProjectsPage.openProject(${i})">
                            <div style="flex:1">
                                <div class="title">${UI.escapeHtml(p.name)}</div>
                                <div class="subtitle">${taskCount} tasks · ${doneCount} done · ${progress}%</div>
                                <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
                            </div>
                            <span class="chevron">›</span>
                        </div>`;
                }).join('') : `
                    <div class="empty-state">
                        <div class="emoji">📋</div>
                        <p>No projects yet</p>
                        <p style="font-size:13px;color:var(--text-muted)">Tap + to create one</p>
                    </div>
                `}
            </div>`;
    },

    showAddProject() {
        document.getElementById('add-project-form').style.display = 'block';
        document.getElementById('new-project-name').focus();
    },

    async addProject() {
        const input = document.getElementById('new-project-name');
        const name = input.value.trim();
        if (!name) { UI.toast('Enter a name'); return; }
        this._projects.push({ name, tasks: [], createdAt: new Date().toISOString() });
        await this._save();
        this.renderList(document.getElementById('page-container'));
        UI.toast('Project created');
    },

    openProject(index) {
        this._activeProject = index;
        this._view = 'board';
        this.render();
    },

    renderBoard(container) {
        const project = this._projects[this._activeProject];
        if (!project) { this._view = 'list'; this.render(); return; }

        container.innerHTML = `
            <div class="page active" id="page-projects">
                <div class="page-header">
                    <button class="back-btn" onclick="ProjectsPage._view='list';ProjectsPage._activeProject=null;ProjectsPage.render()">← Back</button>
                    <h1 style="font-size:18px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.escapeHtml(project.name)}</h1>
                    <button class="back-btn" onclick="ProjectsPage.showAddTask()" style="font-size:24px;color:var(--accent)">+</button>
                </div>
                <div id="add-task-form" style="display:none;margin-bottom:12px">
                    <input id="new-task-text" type="text" placeholder="Task description..." style="margin-bottom:8px">
                    <div style="display:flex;gap:8px">
                        <button class="btn" onclick="ProjectsPage.addTask()" style="flex:1">Add</button>
                        <button class="btn btn-secondary" onclick="document.getElementById('add-task-form').style.display='none'" style="flex:1">Cancel</button>
                    </div>
                </div>
                <div class="kanban-columns">
                    ${this.COLUMNS.map(col => `
                        <div class="kanban-column">
                            <div class="kanban-column-header">
                                <span>${this.COLUMN_LABELS[col]}</span>
                                <span class="kanban-count">${project.tasks.filter(t => t.status === col).length}</span>
                            </div>
                            <div class="kanban-cards" data-column="${col}">
                                ${project.tasks
                                    .map((t, i) => ({ ...t, _idx: i }))
                                    .filter(t => t.status === col)
                                    .map(t => `
                                        <div class="kanban-card" data-task="${t._idx}">
                                            <div class="kanban-card-text">${UI.escapeHtml(t.text)}</div>
                                            ${t.note ? `<div class="kanban-card-note">${UI.escapeHtml(t.note.substring(0, 80))}${t.note.length > 80 ? '...' : ''}</div>` : ''}
                                            <div class="kanban-card-actions">
                                                ${col !== 'todo' ? `<button onclick="ProjectsPage.moveTask(${t._idx},'${this.COLUMNS[this.COLUMNS.indexOf(col) - 1]}')">←</button>` : ''}
                                                <button onclick="ProjectsPage.editTask(${t._idx})">✏️</button>
                                                <button onclick="ProjectsPage.deleteTask(${t._idx})">🗑️</button>
                                                ${col !== 'done' ? `<button onclick="ProjectsPage.moveTask(${t._idx},'${this.COLUMNS[this.COLUMNS.indexOf(col) + 1]}')">→</button>` : ''}
                                            </div>
                                        </div>
                                    `).join('') || '<div class="kanban-empty">No tasks</div>'}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:16px">
                    <button class="btn btn-danger" onclick="ProjectsPage.deleteProject()" style="font-size:13px">Delete Project</button>
                </div>
            </div>`;
    },

    showAddTask() {
        document.getElementById('add-task-form').style.display = 'block';
        document.getElementById('new-task-text').focus();
    },

    async addTask() {
        const input = document.getElementById('new-task-text');
        const text = input.value.trim();
        if (!text) { UI.toast('Enter a task'); return; }
        const project = this._projects[this._activeProject];
        project.tasks.push({ text, status: 'todo', note: '', createdAt: new Date().toISOString() });
        await this._save();
        this.renderBoard(document.getElementById('page-container'));
        UI.toast('Task added');
    },

    async moveTask(taskIdx, newStatus) {
        const project = this._projects[this._activeProject];
        project.tasks[taskIdx].status = newStatus;
        await this._save();
        this.renderBoard(document.getElementById('page-container'));
    },

    editTask(taskIdx) {
        const project = this._projects[this._activeProject];
        const task = project.tasks[taskIdx];
        const container = document.getElementById('page-container');

        container.innerHTML = `
            <div class="page active" id="page-projects">
                <div class="page-header">
                    <button class="back-btn" onclick="ProjectsPage.renderBoard(document.getElementById('page-container'))">← Back</button>
                    <h1 style="font-size:18px">Edit Task</h1>
                </div>
                <div class="card">
                    <div class="key-input-group">
                        <label>Task</label>
                        <input id="edit-task-text" type="text" value="${UI.escapeAttr(task.text)}">
                    </div>
                    <div class="key-input-group">
                        <label>Notes (markdown)</label>
                        <textarea id="edit-task-note" rows="6" style="min-height:120px">${UI.escapeHtml(task.note || '')}</textarea>
                    </div>
                    <div class="key-input-group">
                        <label>Status</label>
                        <select id="edit-task-status" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px;font-size:16px">
                            ${this.COLUMNS.map(c => `<option value="${c}" ${task.status === c ? 'selected' : ''}>${this.COLUMN_LABELS[c]}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn" onclick="ProjectsPage.saveTask(${taskIdx})">Save</button>
                </div>
            </div>`;
    },

    async saveTask(taskIdx) {
        const project = this._projects[this._activeProject];
        project.tasks[taskIdx].text = document.getElementById('edit-task-text').value.trim();
        project.tasks[taskIdx].note = document.getElementById('edit-task-note').value;
        project.tasks[taskIdx].status = document.getElementById('edit-task-status').value;
        await this._save();
        this.renderBoard(document.getElementById('page-container'));
        UI.toast('Task saved');
    },

    async deleteTask(taskIdx) {
        if (!confirm('Delete this task?')) return;
        const project = this._projects[this._activeProject];
        project.tasks.splice(taskIdx, 1);
        await this._save();
        this.renderBoard(document.getElementById('page-container'));
        UI.toast('Task deleted');
    },

    async deleteProject() {
        if (!confirm('Delete this entire project and all its tasks?')) return;
        this._projects.splice(this._activeProject, 1);
        this._activeProject = null;
        this._view = 'list';
        await this._save();
        this.render();
        UI.toast('Project deleted');
    },
};
