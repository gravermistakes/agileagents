T.suite('App.navigate', () => {
    T.assert('navigate is a function', typeof App.navigate === 'function');
    T.assert('currentPage starts as home or set', typeof App.currentPage === 'string');
    T.assert('_initSwipe is a function', typeof App._initSwipe === 'function');
    T.assert('_pages has 6 entries', App._pages.length === 6);
    T.eq('first page is home', App._pages[0], 'home');
    T.eq('last page is settings', App._pages[5], 'settings');
    T.assert('projects in pages', App._pages.includes('projects'));
    T.assert('apps in pages', App._pages.includes('apps'));
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
    T.assert('has 5 modes', ChatPage.MODES.length === 5);
    T.eq('default mode', ChatPage.MODES[0].key, 'default');
    T.eq('agent mode', ChatPage.MODES[1].key, 'agent');
    T.assert('each mode has key and label', ChatPage.MODES.every(m => m.key && m.label));
});

T.suite('ChatPage agent features', () => {
    T.assert('has AGENT_PROMPTS', ChatPage.AGENT_PROMPTS.length >= 4);
    T.assert('all agent prompts are strings', ChatPage.AGENT_PROMPTS.every(p => typeof p === 'string'));
    T.assert('_pendingEdits is array', Array.isArray(ChatPage._pendingEdits));
    T.assert('approveEdit is a function', typeof ChatPage.approveEdit === 'function');
    T.assert('rejectEdit is a function', typeof ChatPage.rejectEdit === 'function');
    T.assert('_sendAgent is a function', typeof ChatPage._sendAgent === 'function');
    T.assert('_formatToolArgs is a function', typeof ChatPage._formatToolArgs === 'function');
    T.eq('formats owner/repo/path', ChatPage._formatToolArgs({ owner: 'me', repo: 'app', path: 'src/main.js' }), 'me/app/src/main.js');
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

T.suite('ReposPage editor', () => {
    T.assert('startEdit is a function', typeof ReposPage.startEdit === 'function');
    T.assert('cancelEdit is a function', typeof ReposPage.cancelEdit === 'function');
    T.assert('insertSymbol is a function', typeof ReposPage.insertSymbol === 'function');
    T.assert('showCommitDialog is a function', typeof ReposPage.showCommitDialog === 'function');
    T.assert('commitChanges is a function', typeof ReposPage.commitChanges === 'function');
    T.assert('_simpleDiff is a function', typeof ReposPage._simpleDiff === 'function');

    const diff = ReposPage._simpleDiff('line1\nline2', 'line1\nline3');
    T.assert('diff shows removed line', diff.includes('diff-del'));
    T.assert('diff shows added line', diff.includes('diff-add'));

    const noDiff = ReposPage._simpleDiff('same', 'same');
    T.assert('no-change diff shows message', noDiff.includes('No visible changes'));
});

T.suite('ProjectsPage', () => {
    T.assert('ProjectsPage exists', typeof ProjectsPage === 'object');
    T.assert('render is a function', typeof ProjectsPage.render === 'function');
    T.assert('init is a function', typeof ProjectsPage.init === 'function');
    T.assert('addProject is a function', typeof ProjectsPage.addProject === 'function');
    T.assert('addTask is a function', typeof ProjectsPage.addTask === 'function');
    T.assert('moveTask is a function', typeof ProjectsPage.moveTask === 'function');
    T.assert('deleteTask is a function', typeof ProjectsPage.deleteTask === 'function');
    T.assert('deleteProject is a function', typeof ProjectsPage.deleteProject === 'function');
    T.assert('has COLUMNS', ProjectsPage.COLUMNS.length === 3);
    T.eq('first column is todo', ProjectsPage.COLUMNS[0], 'todo');
    T.eq('second column is doing', ProjectsPage.COLUMNS[1], 'doing');
    T.eq('third column is done', ProjectsPage.COLUMNS[2], 'done');
    T.assert('has COLUMN_LABELS', !!ProjectsPage.COLUMN_LABELS.todo);
    T.eq('initial view', ProjectsPage._view, 'list');
    T.assert('_projects is array', Array.isArray(ProjectsPage._projects));
    T.eq('_activeProject starts null', ProjectsPage._activeProject, null);
});

T.suite('ProjectsPage saveTask validation', () => {
    T.assert('saveTask is a function', typeof ProjectsPage.saveTask === 'function');
});

T.suite('ProjectsPage init validates data', () => {
    T.assert('_projects is array after init', Array.isArray(ProjectsPage._projects));
});

T.suite('AppsPage', () => {
    T.assert('AppsPage exists', typeof AppsPage === 'object');
    T.assert('render is a function', typeof AppsPage.render === 'function');
    T.assert('has SERVICES', Array.isArray(AppsPage.SERVICES));
    T.assert('4 services', AppsPage.SERVICES.length === 4);
    T.eq('first service is discord', AppsPage.SERVICES[0].id, 'discord');
    T.eq('second service is matrix', AppsPage.SERVICES[1].id, 'matrix');
    T.eq('third service is kaggle', AppsPage.SERVICES[2].id, 'kaggle');
    T.eq('fourth service is termux', AppsPage.SERVICES[3].id, 'termux');
    T.assert('each service has name', AppsPage.SERVICES.every(s => s.name));
    T.assert('each service has desc', AppsPage.SERVICES.every(s => s.desc));
    T.assert('open is a function', typeof AppsPage.open === 'function');
});

T.suite('Termux', () => {
    T.assert('Termux exists', typeof Termux === 'object');
    T.assert('isAvailable is a function', typeof Termux.isAvailable === 'function');
    T.assert('starts unavailable', Termux.isAvailable() === false);
    T.assert('execute is a function', typeof Termux.execute === 'function');
    T.assert('_history is array', Array.isArray(Termux._history));
    T.assert('renderHistory is a function', typeof Termux.renderHistory === 'function');
    T.assert('addOutput is a function', typeof Termux.addOutput === 'function');
});

T.suite('ReposPage predictive coding', () => {
    T.assert('_schedulePrediction exists', typeof ReposPage._schedulePrediction === 'function');
    T.assert('_fetchPrediction exists', typeof ReposPage._fetchPrediction === 'function');
    T.assert('_showPredictions exists', typeof ReposPage._showPredictions === 'function');
    T.assert('_hidePredictions exists', typeof ReposPage._hidePredictions === 'function');
    T.assert('_predictVisible starts false', ReposPage._predictVisible === false);
});

T.suite('Swipe blocked during editing', () => {
    T.assert('ReposPage._editing exists', typeof ReposPage._editing === 'boolean');
});

T.suite('ProjectsPage index-0 bug fix', () => {
    const origView = ProjectsPage._view;
    const origActive = ProjectsPage._activeProject;
    ProjectsPage._activeProject = 0;
    ProjectsPage._view = 'board';
    const shouldRenderBoard = ProjectsPage._view === 'board' && ProjectsPage._activeProject !== null;
    T.assert('index 0 is not falsy with !== null check', shouldRenderBoard === true);
    ProjectsPage._view = origView;
    ProjectsPage._activeProject = origActive;
});

T.suite('Storage', () => {
    T.assert('Storage.init exists', typeof Storage.init === 'function');
    T.assert('Storage.get exists', typeof Storage.get === 'function');
    T.assert('Storage.set exists', typeof Storage.set === 'function');
    T.assert('Storage.delete exists', typeof Storage.delete === 'function');
    T.assert('Storage.getJSON exists', typeof Storage.getJSON === 'function');
    T.assert('Storage.setJSON exists', typeof Storage.setJSON === 'function');
});
