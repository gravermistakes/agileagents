const GitHub = {
    BASE: 'https://api.github.com',
    _token: null,
    _user: null,

    async init() {
        this._token = await Storage.get('github_pat');
    },

    isConnected() {
        return !!this._token;
    },

    async setToken(token) {
        this._token = token;
        await Storage.set('github_pat', token);
        this._user = null;
    },

    async clearToken() {
        this._token = null;
        this._user = null;
        await Storage.delete('github_pat');
    },

    async _fetch(path, opts = {}) {
        if (!this._token) throw new Error('Not authenticated');
        const res = await fetch(this.BASE + path, {
            ...opts,
            headers: {
                'Authorization': `Bearer ${this._token}`,
                'Accept': 'application/vnd.github.v3+json',
                ...(opts.headers || {}),
            },
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`GitHub ${res.status}: ${body}`);
        }
        if (res.status === 204) return null;
        return res.json();
    },

    async getUser() {
        if (this._user) return this._user;
        this._user = await this._fetch('/user');
        return this._user;
    },

    async getRepos(page = 1) {
        return this._fetch(`/user/repos?sort=updated&per_page=30&page=${page}`);
    },

    async getContents(owner, repo, path = '') {
        const encoded = path ? '/' + path.split('/').map(encodeURIComponent).join('/') : '';
        return this._fetch(`/repos/${owner}/${repo}/contents${encoded}`);
    },

    async getFileContent(owner, repo, path) {
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        const data = await this._fetch(`/repos/${owner}/${repo}/contents/${encoded}`);
        if (data.encoding === 'base64') {
            return { content: atob(data.content), sha: data.sha, name: data.name, size: data.size };
        }
        return data;
    },

    async updateFile(owner, repo, path, content, sha, message) {
        return this._fetch(`/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message || `Update ${path}`,
                content: btoa(unescape(encodeURIComponent(content))),
                sha,
            }),
        });
    },

    async getRepoBranches(owner, repo) {
        return this._fetch(`/repos/${owner}/${repo}/branches`);
    },
};
