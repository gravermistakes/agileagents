<script>
  import { onMount, tick } from 'svelte';
  import { currentPage, pendingAIContext, pendingEdits, showToast } from '../stores.js';
  import AI from '../lib/ai.js';
  import GitHub from '../lib/github.js';
  import UI from '../lib/ui.js';

  const MODES = [
    { key: 'default', label: 'Code' },
    { key: 'agent',   label: 'Agent' },
    { key: 'review',  label: 'Review' },
    { key: 'explain', label: 'Explain' },
    { key: 'debug',   label: 'Debug' },
  ];

  const QUICK_PROMPTS  = ['Explain this error', 'Review my code', 'How do I...', 'Refactor this', 'Write tests for', 'Debug this'];
  const AGENT_PROMPTS  = ['Read the README', 'List files in this repo', 'Find bugs in this file', 'Fix the issue in...', 'Refactor this function', 'Add error handling'];

  let mode = 'default';
  let inputText = '';
  let streaming = false;
  let messages = [...AI._messages];
  let chatEl;

  // Streaming / agent progress state
  let streamingMsg = null;   // { role:'assistant', content:'', toolLog:'' }
  let toolLog = '';

  // File context injected from Repos page
  let fileContextText = '';
  let fileContextName = '';

  let localEdits = [];

  const unsubContext = pendingAIContext.subscribe(ctx => {
    if (ctx.text) {
      fileContextText = ctx.text;
      fileContextName = ctx.fileName;
    }
  });

  const unsubEdits = pendingEdits.subscribe(e => { localEdits = e; });

  onMount(() => {
    scrollBottom();
    return () => { unsubContext(); unsubEdits(); };
  });

  function clearFileContext() {
    fileContextText = '';
    fileContextName = '';
    pendingAIContext.set({ text: '', fileName: '' });
  }

  function scrollBottom() {
    if (chatEl) setTimeout(() => { chatEl.scrollTop = chatEl.scrollHeight; }, 10);
  }

  function setMode(m) {
    mode = m;
    showToast('Mode: ' + MODES.find(x => x.key === m)?.label);
  }

  function useQuickPrompt(p) { inputText = p; }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  async function send() {
    if (streaming) return;
    let text = inputText.trim();
    if (!text) return;

    if (fileContextText) {
      text = fileContextText + '\n\n' + text;
      clearFileContext();
    }

    inputText = '';
    streaming = true;
    messages = [...AI._messages, { role: 'user', content: text }];
    streamingMsg = { role: 'assistant', content: '', toolLog: '' };
    toolLog = '';
    await tick();
    scrollBottom();

    try {
      if (mode === 'agent') {
        await sendAgent(text);
      } else {
        await sendStream(text);
      }
    } catch (e) {
      if (streamingMsg) streamingMsg = { ...streamingMsg, content: '', error: e.message };
    }

    streaming = false;
    messages = [...AI._messages];
    streamingMsg = null;
    toolLog = '';
    scrollBottom();
  }

  async function sendStream(text) {
    await AI.sendStream(text, (chunk, full) => {
      streamingMsg = { ...streamingMsg, content: full };
      scrollBottom();
    }, mode);
  }

  async function sendAgent(text) {
    const reply = await AI.sendAgentic(text, (type, data) => {
      if (type === 'thinking') {
        streamingMsg = { ...streamingMsg, content: '', toolLog };
      } else if (type === 'tool_call') {
        toolLog += `<div class="tool-call-entry">
          <div class="tool-call-header">🔧 ${UI.escapeHtml(data.name)}</div>
          <div class="tool-call-args">${UI.escapeHtml(formatToolArgs(data.args))}</div>
        </div>`;
        streamingMsg = { ...streamingMsg, toolLog };
        scrollBottom();
      } else if (type === 'tool_result') {
        const preview = (typeof data.result === 'string' ? data.result : JSON.stringify(data.result)).slice(0, 200);
        toolLog = toolLog.replace(/<\/div>\s*$/, '') +
          `<div class="tool-call-result">${UI.escapeHtml(preview)}${data.result?.length > 200 ? '...' : ''}</div></div>`;
        streamingMsg = { ...streamingMsg, toolLog };
        scrollBottom();
      }
    });
    streamingMsg = { ...streamingMsg, content: reply };
  }

  function formatToolArgs(args) {
    if (args.owner && args.repo && args.path) return `${args.owner}/${args.repo}/${args.path}`;
    if (args.owner && args.repo) return `${args.owner}/${args.repo}`;
    return Object.entries(args).map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 50 ? v.slice(0, 50) + '...' : v}`).join(', ');
  }

  function simpleDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
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

  async function approveEdit(edit) {
    pendingEdits.update(list => list.map(e => e.id === edit.id ? { ...e, status: 'approving' } : e));
    try {
      await GitHub.updateFile(edit.owner, edit.repo, edit.path, edit.newContent, edit.sha, edit.message);
      pendingEdits.update(list => list.map(e => e.id === edit.id ? { ...e, status: 'approved' } : e));
      showToast('Committed!');
    } catch (e) {
      pendingEdits.update(list => list.map(e => e.id === edit.id ? { ...e, status: 'error', errorMsg: e.message } : e));
      showToast('Commit failed');
    }
  }

  function rejectEdit(edit) {
    pendingEdits.update(list => list.map(e => e.id === edit.id ? { ...e, status: 'rejected' } : e));
    showToast('Edit rejected');
  }

  async function clearChat() {
    if (AI._messages.length === 0) return;
    if (!confirm('Clear chat history?')) return;
    await AI.clearHistory();
    pendingEdits.set([]);
    messages = [];
    showToast('Chat cleared');
  }

  $: isAgent = mode === 'agent';
  $: quickPrompts = isAgent ? AGENT_PROMPTS : QUICK_PROMPTS;
  $: model = AI.getModel();
  $: pendingEditsList = localEdits.filter(e => e.status === 'pending');
</script>

<div class="chat-page">
  {#if !AI.isConnected()}
    <div class="empty-state">
      <div class="emoji">🤖</div>
      <p>Add an AI API key in Settings</p>
      <p style="font-size:13px;color:var(--text-muted)">Groq, Gemini, OpenRouter, Mistral — all free tiers</p>
      <button class="btn" on:click={() => currentPage.set('settings')}>Open Settings</button>
    </div>
  {:else}
    <div class="chat-top">
      <div class="chat-meta">
        <span>{AI.PROVIDERS[AI._provider].name} · {model.name}{isAgent ? ' · 🤖 Agent' : ''}</span>
        <button class="clear-btn" on:click={clearChat}>Clear</button>
      </div>
      <div class="chat-modes">
        {#each MODES as m}
          <button class="chat-mode-pill {mode === m.key ? 'active' : ''}" on:click={() => setMode(m.key)}>{m.label}</button>
        {/each}
      </div>
    </div>

    <div class="chat-messages" bind:this={chatEl}>
      {#if messages.length === 0 && !streamingMsg}
        <div class="empty-state" style="padding:24px 0">
          <div class="emoji">{isAgent ? '🤖' : '💬'}</div>
          <p>{isAgent ? 'Agent mode — AI can read & edit your repos' : 'Start a conversation'}</p>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            {#if isAgent}
              {GitHub.isConnected() ? 'Connected to GitHub — agent has repo access' : '⚠️ Connect GitHub in Settings for agent to work'}
            {:else}
              Powered by {AI.PROVIDERS[AI._provider].name}
            {/if}
          </p>
          <div class="quick-prompts">
            {#each quickPrompts as p}
              <button class="quick-prompt-chip" on:click={() => useQuickPrompt(p)}>{p}</button>
            {/each}
          </div>
        </div>
      {:else}
        {#each messages as msg}
          <div class="chat-msg {msg.role}">
            <div class="role">{msg.role === 'user' ? 'You' : 'AI'}</div>
            <div class="content">{@html UI.renderMarkdown(msg.content)}</div>
          </div>
        {/each}

        {#if streamingMsg}
          <div class="chat-msg assistant">
            <div class="role">AI</div>
            <div class="content">
              {#if streamingMsg.toolLog}
                {@html streamingMsg.toolLog}
              {/if}
              {#if streamingMsg.error}
                <span style="color:var(--red)">{streamingMsg.error}</span>
              {:else if streamingMsg.content}
                {@html UI.renderMarkdown(streamingMsg.content)}
              {:else}
                <span class="spinner"></span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Pending AI-proposed edits -->
        {#each pendingEditsList as edit (edit.id)}
          <div class="edit-proposal">
            <div class="edit-proposal-header">
              📝 Edit proposed: <strong>{edit.path}</strong>
              <span style="color:var(--text-muted);font-size:12px">{edit.message}</span>
            </div>
            <div class="diff-view" style="max-height:200px;overflow:auto;margin:8px 0">
              {@html simpleDiff(edit.oldContent, edit.newContent)}
            </div>
            {#if edit.status === 'approving'}
              <div class="agent-thinking"><span class="spinner"></span> Committing...</div>
            {:else if edit.status === 'approved'}
              <div style="color:var(--green)">✅ Committed: {edit.message}</div>
            {:else if edit.status === 'rejected'}
              <div style="color:var(--text-muted)">Edit rejected</div>
            {:else if edit.status === 'error'}
              <div style="color:var(--red)">❌ Commit failed: {edit.errorMsg}</div>
            {:else}
              <div style="display:flex;gap:8px">
                <button class="btn" on:click={() => approveEdit(edit)} style="flex:1">✅ Approve & Commit</button>
                <button class="btn btn-secondary" on:click={() => rejectEdit(edit)} style="flex:1">❌ Reject</button>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    {#if fileContextName}
      <div class="file-context-tag">
        📎 {fileContextName}
        <button on:click={clearFileContext}>✕</button>
      </div>
    {/if}

    <div class="chat-input-area">
      <textarea
        bind:value={inputText}
        placeholder={isAgent ? 'Ask the agent to read, edit, or fix code...' : 'Ask anything...'}
        rows="1"
        disabled={streaming}
        on:keydown={handleKey}
        on:input={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
      ></textarea>
      <button class="send-btn" on:click={send} disabled={streaming} aria-label="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  {/if}
</div>

<style>
  .chat-page {
    display: flex;
    flex-direction: column;
    height: calc(100dvh - 64px);
    padding: 0;
  }

  .chat-top {
    padding: 8px 16px 0;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .chat-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .clear-btn {
    background: none; border: none; color: var(--text-muted);
    font-size: 12px; cursor: pointer; padding: 4px 8px;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    -webkit-overflow-scrolling: touch;
  }

  .edit-proposal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px;
    margin: 12px 0;
  }

  .edit-proposal-header {
    font-size: 13px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chat-input-area {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }

  .chat-input-area textarea {
    flex: 1;
    resize: none;
    min-height: 44px;
    max-height: 120px;
    overflow-y: auto;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 16px;
    padding: 10px 12px;
    line-height: 1.4;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px;
    text-align: center;
  }
</style>
