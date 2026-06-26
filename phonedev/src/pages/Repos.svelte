<script>
  import { onMount, tick } from 'svelte';
  import { currentPage, repoContext, pendingAIContext, showToast } from '../stores.js';
  import GitHub from '../lib/github.js';
  import AI from '../lib/ai.js';
  import UI from '../lib/ui.js';

  // view: 'list' | 'tree' | 'file' | 'edit' | 'commit'
  let view = 'list';

  let owner = '';
  let repo = '';
  let path = '';
  let allRepos = null;
  let treeItems = null;
  let fileContent = null;
  let fileSha = null;
  let editContent = '';

  let searchRepos = '';
  let searchTree = '';
  let commitMsg = '';
  let loading = false;
  let error = '';

  // Predictive coding
  let predictTimer = null;
  let predictions = [];
  let editorEl;
  let hljsLoaded = false;
  let codeEl;

  onMount(async () => {
    // Handle navigation from Home page
    if (window._pendingRepo) {
      const { owner: o, repo: r } = window._pendingRepo;
      delete window._pendingRepo;
      await openRepo(o, r);
    } else {
      await loadRepos();
    }
  });

  async function loadRepos() {
    loading = true; error = '';
    try {
      allRepos = await GitHub.getRepos();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  $: filteredRepos = allRepos
    ? (searchRepos
      ? allRepos.filter(r =>
          r.name.toLowerCase().includes(searchRepos.toLowerCase()) ||
          (r.language || '').toLowerCase().includes(searchRepos.toLowerCase()) ||
          (r.description || '').toLowerCase().includes(searchRepos.toLowerCase()))
      : allRepos)
    : [];

  $: filteredTree = treeItems
    ? (searchTree
      ? treeItems.filter(i => i.name.toLowerCase().includes(searchTree.toLowerCase()))
      : treeItems)
    : [];

  async function openRepo(o, r) {
    owner = o; repo = r; path = '';
    repoContext.set({ owner: o, repo: r, path: '' });
    view = 'tree';
    await loadTree();
  }

  async function loadTree() {
    loading = true; error = '';
    treeItems = null;
    try {
      const contents = await GitHub.getContents(owner, repo, path);
      treeItems = (Array.isArray(contents) ? contents : [contents]).sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function navigateTo(p) {
    path = p;
    repoContext.set({ owner, repo, path });
    view = 'tree';
    await loadTree();
  }

  async function openFile(p) {
    path = p;
    repoContext.set({ owner, repo, path });
    view = 'file';
    loading = true; error = '';
    fileContent = null; fileSha = null;
    try {
      const file = await GitHub.getFileContent(owner, repo, p);
      fileContent = file.content;
      fileSha = file.sha;
      await tick();
      if (codeEl && getLang(p.split('/').pop())) {
        await loadHljs();
        if (window.hljs) hljs.highlightElement(codeEl);
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function goBack() {
    if (view === 'commit') { view = 'edit'; return; }
    if (view === 'edit') { view = 'file'; editContent = ''; predictions = []; return; }
    if (view === 'file') {
      const parts = path.split('/');
      parts.pop();
      path = parts.join('/');
      repoContext.set({ owner, repo, path });
      view = 'tree';
      loadTree();
      return;
    }
    if (view === 'tree') {
      if (path) {
        const parts = path.split('/');
        parts.pop();
        path = parts.join('/');
        repoContext.set({ owner, repo, path });
        loadTree();
      } else {
        view = 'list';
        owner = ''; repo = ''; path = '';
        repoContext.set({ owner: '', repo: '', path: '' });
      }
      return;
    }
  }

  function startEdit() {
    if (!fileContent) return;
    editContent = fileContent;
    view = 'edit';
    setTimeout(() => editorEl?.focus(), 50);
  }

  function cancelEdit() {
    editContent = '';
    predictions = [];
    view = 'file';
  }

  function insertSymbol(sym) {
    if (!editorEl) return;
    const start = editorEl.selectionStart;
    const end = editorEl.selectionEnd;
    const pairs = { '{}': 1, '()': 1, '[]': 1, '""': 1, "''": 1 };
    editorEl.value = editorEl.value.substring(0, start) + sym + editorEl.value.substring(end);
    const cursor = pairs[sym] ? start + 1 : start + sym.length;
    editorEl.selectionStart = editorEl.selectionEnd = cursor;
    editorEl.focus();
    editContent = editorEl.value;
  }

  function handleEditorKey(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertSymbol('    ');
      return;
    }
    if (e.key === 'Enter') {
      const pos = editorEl.selectionStart;
      const before = editorEl.value.substring(0, pos);
      const currentLine = before.split('\n').pop();
      const indent = currentLine.match(/^\s*/)[0];
      if (indent) {
        e.preventDefault();
        insertSymbol('\n' + indent);
      }
    }
  }

  function handleEditorInput() {
    editContent = editorEl.value;
    schedulePrediction();
  }

  function schedulePrediction() {
    if (predictTimer) clearTimeout(predictTimer);
    predictions = [];
    if (!AI.isConnected()) return;
    predictTimer = setTimeout(fetchPrediction, 800);
  }

  async function fetchPrediction() {
    if (!editorEl || view !== 'edit') return;
    const pos = editorEl.selectionStart;
    const text = editorEl.value;
    if (!text.trim()) return;

    const before = text.substring(Math.max(0, pos - 500), pos);
    const after = text.substring(pos, Math.min(text.length, pos + 100));
    const name = (path || '').split('/').pop() || 'file';
    const lang = getLang(name) || '';

    const prompt = `Complete the code at the cursor (marked <CURSOR>). Return ONLY 1-3 short completions, each on its own line, no explanation.\n\nLanguage: ${lang}\nFile: ${name}\n\n${before}<CURSOR>${after}`;

    try {
      const saved = [...AI._messages];
      AI._messages = [];
      AI._messages.push({ role: 'user', content: prompt });
      const res = await AI._sendOpenAI('default').catch(() => null)
        || await AI._sendGemini('default').catch(() => null);
      AI._messages = saved;
      if (!res || view !== 'edit') return;
      predictions = res.split('\n')
        .map(l => l.trim())
        .filter(l => l && l.length > 1 && l.length < 120 && !l.startsWith('```'))
        .slice(0, 3);
    } catch {
      // silently fail
    }
  }

  function applyPrediction(p) {
    insertSymbol(p);
    predictions = [];
  }

  function showCommitDialog() {
    if (editContent === fileContent) { showToast('No changes to commit'); return; }
    commitMsg = 'Update ' + path.split('/').pop();
    view = 'commit';
  }

  async function commitChanges() {
    if (!commitMsg.trim()) { showToast('Enter a commit message'); return; }
    try {
      const result = await GitHub.updateFile(owner, repo, path, editContent, fileSha, commitMsg.trim());
      fileSha = result.content.sha;
      fileContent = editContent;
      editContent = '';
      predictions = [];
      showToast('Committed!');
      view = 'file';
    } catch (e) {
      showToast('Commit failed: ' + e.message);
    }
  }

  function copyFileContent() {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent)
      .then(() => showToast('Copied!'))
      .catch(() => showToast('Copy failed'));
  }

  function sendToAI() {
    if (!fileContent) return;
    const name = path.split('/').pop();
    const fence = '`'.repeat(Math.max(3, (fileContent.match(/`{3,}/g) || []).reduce((m, s) => Math.max(m, s.length), 0) + 1));
    pendingAIContext.set({ text: `\`${name}\`:\n${fence}\n${fileContent}\n${fence}\n\n`, fileName: name });
    currentPage.set('chat');
    showToast('File attached');
  }

  function getLang(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
      py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', swift: 'swift',
      c: 'c', h: 'c', cpp: 'cpp', cs: 'csharp', php: 'php',
      html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
      css: 'css', scss: 'scss', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
      md: 'markdown', sh: 'bash', bash: 'bash', sql: 'sql', zig: 'zig', lua: 'lua',
    };
    return map[ext] || null;
  }

  async function loadHljs() {
    if (hljsLoaded || window.hljs) { hljsLoaded = true; return; }
    return new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js';
      script.onload = () => { hljsLoaded = true; resolve(); };
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  function simpleDiff(oldText, newText) {
    const oldLines = (oldText || '').split('\n');
    const newLines = (newText || '').split('\n');
    let html = '';
    for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
      if (oldLines[i] === newLines[i]) continue;
      if (newLines[i] === undefined) html += `<div class="diff-del">- ${UI.escapeHtml(oldLines[i])}</div>`;
      else if (oldLines[i] === undefined) html += `<div class="diff-add">+ ${UI.escapeHtml(newLines[i])}</div>`;
      else {
        html += `<div class="diff-del">- ${UI.escapeHtml(oldLines[i])}</div>`;
        html += `<div class="diff-add">+ ${UI.escapeHtml(newLines[i])}</div>`;
      }
    }
    return html || '<div style="color:var(--text-muted);padding:8px">No visible changes</div>';
  }

  $: pathParts = path ? path.split('/') : [];
  $: fileName = path ? path.split('/').pop() : '';
  $: fileLines = fileContent ? fileContent.split('\n') : [];
  $: fileLang = getLang(fileName);
</script>

<div class="page" class:has-editor={view === 'edit'}>

  <!-- REPO LIST -->
  {#if view === 'list'}
    {#if !GitHub.isConnected()}
      <div class="page-header"><h1>Repos</h1></div>
      <div class="empty-state">
        <div class="emoji">🔗</div>
        <p>Connect GitHub in Settings first</p>
        <button class="btn" on:click={() => currentPage.set('settings')}>Open Settings</button>
      </div>
    {:else}
      <div class="page-header"><h1>Repos</h1></div>
      <input type="search" bind:value={searchRepos} placeholder="Filter repos..." style="margin-bottom:12px">
      {#if loading}
        <div class="center-pad"><span class="spinner"></span></div>
      {:else if error}
        <p style="color:var(--red);padding:16px">{error}</p>
      {:else}
        {#each filteredRepos as r}
          <div class="list-item" on:click={() => openRepo(r.owner.login, r.name)} role="button" tabindex="0">
            <div class="icon">{r.private ? '🔒' : '📦'}</div>
            <div>
              <div class="title">{r.name}</div>
              <div class="subtitle">{r.language || ''} · {UI.timeAgo(r.updated_at)} · {UI.formatSize(r.size * 1024)}</div>
            </div>
            <span class="chevron">›</span>
          </div>
        {:else}
          <p style="color:var(--text-muted);padding:16px;text-align:center">No matching repos</p>
        {/each}
      {/if}
    {/if}

  <!-- FILE TREE -->
  {:else if view === 'tree'}
    <div class="page-header">
      <button class="back-btn" on:click={goBack}>← Back</button>
      <h1>{repo}</h1>
    </div>
    <div class="breadcrumbs">
      <button class="crumb" on:click={() => navigateTo('')}>root</button>
      {#each pathParts as part, i}
        <span class="sep">/</span>
        <button class="crumb" on:click={() => navigateTo(pathParts.slice(0, i + 1).join('/'))}>{part}</button>
      {/each}
    </div>
    <input type="search" bind:value={searchTree} placeholder="Filter files..." style="margin-bottom:8px">
    {#if loading}
      <div class="center-pad"><span class="spinner"></span></div>
    {:else if error}
      <p style="color:var(--red);padding:16px">{error}</p>
    {:else}
      {#each filteredTree as item}
        <div class="file-item {item.type === 'dir' ? 'dir' : ''}"
             on:click={() => item.type === 'dir' ? navigateTo(item.path) : openFile(item.path)}
             role="button" tabindex="0">
          <span class="file-icon">{UI.fileIcon(item.name, item.type === 'dir')}</span>
          <span class="file-name">{item.name}</span>
          {#if item.size}
            <span style="color:var(--text-muted);font-size:12px">{UI.formatSize(item.size)}</span>
          {/if}
        </div>
      {:else}
        <p style="color:var(--text-muted);padding:16px;text-align:center">No matching files</p>
      {/each}
    {/if}

  <!-- FILE VIEW -->
  {:else if view === 'file'}
    <div class="page-header">
      <button class="back-btn" on:click={goBack}>← Back</button>
      <h1 style="font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{fileName}</h1>
    </div>
    {#if loading}
      <div class="center-pad"><span class="spinner"></span></div>
    {:else if error}
      <p style="color:var(--red);padding:16px">{error}</p>
    {:else if fileContent !== null}
      <div class="code-viewer">
        <div class="code-viewer-header">
          <span>{fileName}</span>
          <span class="text-muted">{fileLines.length} lines · {UI.formatSize(fileContent.length)}</span>
        </div>
        <div class="code-viewer-body">
          <div class="line-numbers">{#each fileLines as _, i}<span>{i + 1}</span>{/each}</div>
          <pre><code bind:this={codeEl} class={fileLang ? 'language-' + fileLang : ''}>{fileContent}</code></pre>
        </div>
      </div>
    {/if}
    <div class="file-actions">
      <button class="btn btn-secondary" on:click={copyFileContent} style="flex:1">Copy</button>
      <button class="btn btn-secondary" on:click={startEdit} style="flex:1">Edit</button>
      <button class="btn btn-secondary" on:click={sendToAI} style="flex:1">Ask AI</button>
    </div>

  <!-- EDITOR -->
  {:else if view === 'edit'}
    <div class="page-header">
      <button class="back-btn" on:click={cancelEdit}>Cancel</button>
      <h1 style="font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{fileName}</h1>
    </div>

    {#if predictions.length}
      <div class="predict-chips">
        {#each predictions as p}
          <button class="predict-chip" on:click={() => applyPrediction(p)}
                  title={p}>{p.length > 50 ? p.substring(0, 47) + '...' : p}</button>
        {/each}
      </div>
    {/if}

    <div class="symbol-bar">
      <button on:click={() => insertSymbol('    ')}>Tab</button>
      <button on:click={() => insertSymbol('{}')}>{ }</button>
      <button on:click={() => insertSymbol('()')}>( )</button>
      <button on:click={() => insertSymbol('[]')}>[ ]</button>
      <button on:click={() => insertSymbol('""')}>" "</button>
      <button on:click={() => insertSymbol("''")}>' '</button>
      <button on:click={() => insertSymbol(';')}>;</button>
      <button on:click={() => insertSymbol('=')}>=</button>
      <button on:click={() => insertSymbol('=>')}>=&gt;</button>
      <button on:click={() => insertSymbol('//')}>//</button>
    </div>

    <textarea
      bind:this={editorEl}
      class="code-editor"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      value={editContent}
      on:keydown={handleEditorKey}
      on:input={handleEditorInput}
    ></textarea>

    <div class="file-actions" style="margin-top:8px">
      <button class="btn" on:click={showCommitDialog} style="flex:1">Commit</button>
    </div>

  <!-- COMMIT DIALOG -->
  {:else if view === 'commit'}
    <div class="page-header">
      <button class="back-btn" on:click={() => view = 'edit'}>← Back</button>
      <h1 style="font-size:16px">Commit Changes</h1>
    </div>
    <div class="card">
      <div class="card-header">Diff Preview</div>
      <div class="diff-view">{@html simpleDiff(fileContent, editContent)}</div>
    </div>
    <div class="card">
      <div class="card-header">Commit Message</div>
      <input type="text" bind:value={commitMsg} placeholder="Update {fileName}">
    </div>
    <button class="btn" on:click={commitChanges} id="commit-btn">Commit &amp; Push</button>
  {/if}
</div>

<style>
  .page { padding: 16px; }
  .page.has-editor { padding: 0; }
  .page.has-editor .page-header,
  .page.has-editor .symbol-bar,
  .page.has-editor .predict-chips,
  .page.has-editor .file-actions { padding: 0 16px; }
  .page-header { display:flex;align-items:center;gap:12px;margin-bottom:16px; }
  .center-pad { text-align:center;padding:24px; }

  .breadcrumbs { display:flex;align-items:center;flex-wrap:wrap;gap:2px;margin-bottom:12px;font-size:13px;color:var(--text-muted); }
  .crumb { background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 4px;font-size:13px;font-family:var(--font-sans); }
  .crumb:hover { color:var(--text); }
  .sep { color:var(--border); }

  .code-viewer { border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:12px; }
  .code-viewer-header { display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary);border-bottom:1px solid var(--border);font-size:12px;color:var(--text-muted); }
  .code-viewer-body { display:flex;overflow-x:auto;max-height:60vh; }
  .line-numbers { padding:12px 8px;background:var(--bg-secondary);border-right:1px solid var(--border);text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);user-select:none;display:flex;flex-direction:column;min-width:36px; }
  .code-viewer-body pre { margin:0;padding:12px;overflow:visible;flex:1; }
  .code-viewer-body code { font-family:var(--font-mono);font-size:12px;line-height:1.5;white-space:pre; }

  .file-actions { display:flex;gap:8px;margin-bottom:16px; }

  .code-editor {
    width: 100%;
    flex: 1;
    min-height: calc(100dvh - 220px);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    padding: 12px;
    resize: none;
    tab-size: 4;
    white-space: pre;
    overflow: auto;
    box-sizing: border-box;
    display: block;
    margin: 8px 16px;
  }

  .symbol-bar { display:flex;gap:4px;overflow-x:auto;padding:8px 0;margin-bottom:8px; }
  .symbol-bar button {
    background:var(--bg-tertiary);
    border:1px solid var(--border);
    border-radius:var(--radius-sm);
    color:var(--text);
    padding:6px 10px;
    font-family:var(--font-mono);
    font-size:13px;
    cursor:pointer;
    white-space:nowrap;
    min-height:36px;
  }

  .predict-chips { display:flex;gap:6px;overflow-x:auto;padding:4px 0;margin-bottom:4px; }
  .predict-chip {
    background:var(--bg-secondary);
    border:1px solid var(--tab-active);
    border-radius:var(--radius-sm);
    color:var(--tab-active);
    padding:4px 10px;
    font-family:var(--font-mono);
    font-size:12px;
    cursor:pointer;
    white-space:nowrap;
    max-width:200px;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .text-muted { color:var(--text-muted); }
</style>
