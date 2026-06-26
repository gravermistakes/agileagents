import Storage from './storage.js';

const GitHub = {
    BASE: 'https://api.github.com',
    _token: null,
    _user: null,

    async init() {
        this._token = await Storage.get('github_pat');
    },

    isConnected() { return !!this._token; },

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
        return {
            content: atob(data.content.replace(/\n/g, '')),
            sha: data.sha,
            name: data.name,
            size: data.size,
        };
    },

    async commitFile(owner, repo, path, content, message, sha) {
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        return this._fetch(`/repos/${owner}/${repo}/contents/${encoded}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                content: btoa(unescape(encodeURIComponent(content))),
                sha,
            }),
        });
    },

    async getIssues(owner, repo, state = 'open') {
        return this._fetch(`/repos/${owner}/${repo}/issues?state=${state}&per_page=20`);
    },

    async getPRs(owner, repo, state = 'open') {
        return this._fetch(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`);
    },

    async updateFile(owner, repo, path, content, sha, message) {
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        return this._fetch(`/repos/${owner}/${repo}/contents/${encoded}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                content: btoa(unescape(encodeURIComponent(content))),
                sha,
            }),
        });
    },
};

export default GitHub;
