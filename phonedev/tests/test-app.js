T.suite('App.navigate', () => {
    T.assert('navigate is a function', typeof App.navigate === 'function');
    T.assert('currentPage starts as home or set', typeof App.currentPage === 'string');
});

T.suite('App pages', () => {
    T.assert('HomePage exists', typeof HomePage === 'object');
    T.assert('ReposPage exists', typeof ReposPage === 'object');
    T.assert('ChatPage exists', typeof ChatPage === 'object');
    T.assert('SettingsPage exists', typeof SettingsPage === 'object');

    T.assert('HomePage.render', typeof HomePage.render === 'function');
    T.assert('ReposPage.render', typeof ReposPage.render === 'function');
    T.assert('ChatPage.render', typeof ChatPage.render === 'function');
    T.assert('SettingsPage.render', typeof SettingsPage.render === 'function');
});

T.suite('ChatPage.MODES', () => {
    T.assert('has modes', ChatPage.MODES.length === 4);
    T.eq('default mode', ChatPage.MODES[0].key, 'default');
    T.assert('each mode has key and label', ChatPage.MODES.every(m => m.key && m.label));
});

T.suite('ChatPage.QUICK_PROMPTS', () => {
    T.assert('has quick prompts', ChatPage.QUICK_PROMPTS.length >= 4);
    T.assert('all strings', ChatPage.QUICK_PROMPTS.every(p => typeof p === 'string'));
});

T.suite('ReposPage state', () => {
    T.eq('initial view', ReposPage._view, 'list');
    T.eq('initial path', ReposPage._currentPath, '');
    T.eq('initial owner', ReposPage._currentOwner, null);
    T.assert('filterRepos is a function', typeof ReposPage.filterRepos === 'function');
    T.assert('filterTree is a function', typeof ReposPage.filterTree === 'function');
    T.assert('_getLang is a function', typeof ReposPage._getLang === 'function');
    T.eq('detects javascript', ReposPage._getLang('app.js'), 'javascript');
    T.eq('detects python', ReposPage._getLang('main.py'), 'python');
    T.eq('detects typescript', ReposPage._getLang('index.ts'), 'typescript');
    T.eq('returns null for unknown', ReposPage._getLang('readme.xyz'), null);
    T.eq('detects rust', ReposPage._getLang('lib.rs'), 'rust');
    T.eq('detects css', ReposPage._getLang('style.css'), 'css');
    T.eq('detects json', ReposPage._getLang('package.json'), 'json');
});

T.suite('Storage', () => {
    T.assert('Storage.init exists', typeof Storage.init === 'function');
    T.assert('Storage.get exists', typeof Storage.get === 'function');
    T.assert('Storage.set exists', typeof Storage.set === 'function');
    T.assert('Storage.delete exists', typeof Storage.delete === 'function');
    T.assert('Storage.getJSON exists', typeof Storage.getJSON === 'function');
    T.assert('Storage.setJSON exists', typeof Storage.setJSON === 'function');
});
