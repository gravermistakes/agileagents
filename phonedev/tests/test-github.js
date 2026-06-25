T.suite('GitHub.BASE', () => {
    T.eq('correct base URL', GitHub.BASE, 'https://api.github.com');
});

T.suite('GitHub.isConnected', () => {
    const orig = GitHub._token;
    GitHub._token = null;
    T.eq('false when no token', GitHub.isConnected(), false);
    GitHub._token = 'ghp_test';
    T.eq('true when token set', GitHub.isConnected(), true);
    GitHub._token = orig;
});

T.suite('GitHub._fetch guard', () => {
    const orig = GitHub._token;
    GitHub._token = null;
    let threw = false;
    GitHub._fetch('/user').catch(e => { threw = true; });
    T.assert('_fetch is a function', typeof GitHub._fetch === 'function');
    GitHub._token = orig;
});

T.suite('GitHub.getUser caching', () => {
    const orig = GitHub._user;
    GitHub._user = { login: 'cached', public_repos: 5 };
    GitHub.getUser().then(u => {
        T.eq('returns cached user', u.login, 'cached');
    });
    GitHub._user = orig;
});

T.suite('GitHub methods exist', () => {
    T.assert('getRepos', typeof GitHub.getRepos === 'function');
    T.assert('getContents', typeof GitHub.getContents === 'function');
    T.assert('getFileContent', typeof GitHub.getFileContent === 'function');
    T.assert('updateFile', typeof GitHub.updateFile === 'function');
    T.assert('getRepoBranches', typeof GitHub.getRepoBranches === 'function');
    T.assert('setToken', typeof GitHub.setToken === 'function');
    T.assert('clearToken', typeof GitHub.clearToken === 'function');
});
