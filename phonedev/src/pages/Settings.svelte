<script>
  import { onMount } from 'svelte';
  import { currentPage, showToast } from '../stores.js';
  import GitHub from '../lib/github.js';
  import AI from '../lib/ai.js';

  let ghConnected = GitHub.isConnected();
  let aiConnected = AI.isConnected();
  let ghUser = null;
  let ghToken = '';
  let aiKey = '';
  let customUrl = AI.PROVIDERS.custom.baseUrl || '';
  let selectedProvider = AI._provider;
  let selectedModel = AI._model;

  onMount(async () => {
    ghConnected = GitHub.isConnected();
    aiConnected = AI.isConnected();
    selectedProvider = AI._provider;
    selectedModel = AI._model;
    if (ghConnected) loadGHUser();
  });

  async function loadGHUser() {
    try { ghUser = await GitHub.getUser(); } catch {}
  }

  async function connectGitHub() {
    if (!ghToken.trim()) { showToast('Enter a token'); return; }
    try {
      await GitHub.setToken(ghToken.trim());
      await GitHub.getUser();
      ghConnected = true;
      ghToken = '';
      showToast('GitHub connected!');
      loadGHUser();
    } catch (e) {
      await GitHub.clearToken();
      ghConnected = false;
      showToast('Invalid token: ' + e.message);
    }
  }

  async function disconnectGitHub() {
    await GitHub.clearToken();
    ghConnected = false;
    ghUser = null;
    showToast('GitHub disconnected');
  }

  async function changeProvider(pid) {
    await AI.setProvider(pid);
    selectedProvider = AI._provider;
    selectedModel = AI._model;
    aiConnected = AI.isConnected();
    customUrl = AI.PROVIDERS.custom.baseUrl || '';
  }

  async function connectAI() {
    if (!aiKey.trim()) { showToast('Enter a key'); return; }
    if (selectedProvider === 'custom' && !customUrl.trim()) { showToast('Enter a base URL'); return; }
    try {
      if (selectedProvider === 'custom') await AI.setCustomBaseUrl(customUrl.trim());
      await AI.setKey(aiKey.trim());
      const provider = AI.PROVIDERS[selectedProvider];

      if (provider.isGemini) {
        const res = await fetch(`${provider.baseUrl}/models?key=${aiKey.trim()}`);
        if (!res.ok) throw new Error(`${res.status}`);
      } else if (provider.validatePath) {
        const base = provider.baseUrl || AI.PROVIDERS.custom.baseUrl;
        const res = await fetch(base + provider.validatePath, {
          headers: { 'Authorization': `Bearer ${aiKey.trim()}` },
        });
        if (!res.ok) throw new Error(`${res.status}`);
      }

      aiConnected = true;
      aiKey = '';
      showToast(`${provider.name} connected!`);
    } catch (e) {
      await AI.clearKey();
      aiConnected = false;
      showToast('Invalid key: ' + e.message);
    }
  }

  async function disconnectAI() {
    await AI.clearKey();
    aiConnected = false;
    showToast('Disconnected');
  }

  async function changeModel(modelId) {
    await AI.setModel(modelId);
    selectedModel = modelId;
    showToast('Model: ' + AI.getModel().name);
  }

  async function clearChat() {
    if (!confirm('Clear all chat history?')) return;
    await AI.clearHistory();
    showToast('Chat history cleared');
  }

  function exportData() {
    const data = {
      chatHistory: AI._messages,
      provider: AI._provider,
      model: AI._model,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mobide-export.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported!');
  }

  async function clearAll() {
    if (!confirm('Delete all data? This cannot be undone.')) return;
    await GitHub.clearToken();
    await AI.clearKey();
    await AI.clearHistory();
    indexedDB.deleteDatabase('mobide');
    showToast('All data cleared');
    setTimeout(() => location.reload(), 500);
  }

  const keyHints = {
    groq: 'Free at console.groq.com → API Keys',
    openrouter: 'Free at openrouter.ai → Keys',
    mistral: 'Free at console.mistral.ai → API Keys',
    gemini: 'Free at aistudio.google.com → API keys',
    custom: "Enter your provider's API key",
  };

  const keyPlaceholders = {
    groq: 'gsk_xxxxx...', openrouter: 'sk-or-...', mistral: 'xxx...', gemini: 'AIza...', custom: 'sk-...',
  };
</script>

<div class="page">
  <div class="page-header">
    <button class="back-btn" on:click={() => currentPage.set('home')}>← Back</button>
    <h1>Settings</h1>
  </div>

  <!-- GitHub -->
  <div class="card">
    <div class="card-header">GitHub</div>
    {#if ghConnected}
      {#if ghUser}
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <img src={ghUser.avatar_url} alt="" style="width:32px;height:32px;border-radius:50%">
          <div>
            <div style="font-weight:600">{ghUser.login}</div>
            <div style="font-size:12px;color:var(--text-muted)">{ghUser.public_repos} repos</div>
          </div>
          <span class="badge connected" style="margin-left:auto">Connected</span>
        </div>
      {:else}
        <span class="badge connected" style="display:inline-block;margin-bottom:12px">Connected</span>
      {/if}
      <button class="btn btn-danger" on:click={disconnectGitHub}>Disconnect GitHub</button>
    {:else}
      <div class="key-input-group">
        <label>Personal Access Token</label>
        <input type="password" bind:value={ghToken} placeholder="ghp_xxxxx..." autocomplete="off" spellcheck="false">
        <div class="key-status">Create at github.com/settings/tokens → Fine-grained → repo access</div>
      </div>
      <button class="btn" on:click={connectGitHub}>Connect</button>
    {/if}
  </div>

  <!-- AI Provider -->
  <div class="card">
    <div class="card-header">AI Provider</div>
    <div class="key-input-group">
      <label>Provider</label>
      <select bind:value={selectedProvider} on:change={() => changeProvider(selectedProvider)}>
        {#each Object.entries(AI.PROVIDERS) as [key, p]}
          <option value={key}>{p.name} ({p.limits})</option>
        {/each}
      </select>
    </div>
    {#if aiConnected}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span class="badge connected">Connected</span>
        <span style="color:var(--text-muted);font-size:13px">{AI.getModel().name}</span>
      </div>
      {#if AI.getProviderModels().length}
        <div class="key-input-group">
          <label>Model</label>
          <select bind:value={selectedModel} on:change={() => changeModel(selectedModel)}>
            {#each AI.getProviderModels() as m}
              <option value={m.id}>{m.name} ({m.ctx})</option>
            {/each}
          </select>
        </div>
      {/if}
      <button class="btn btn-danger" on:click={disconnectAI} style="margin-top:8px">
        Disconnect {AI.PROVIDERS[selectedProvider].name}
      </button>
    {:else}
      {#if selectedProvider === 'custom'}
        <div class="key-input-group">
          <label>Base URL (OpenAI-compatible)</label>
          <input type="url" bind:value={customUrl} placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false">
        </div>
      {/if}
      <div class="key-input-group">
        <label>API Key</label>
        <input type="password" bind:value={aiKey} placeholder={keyPlaceholders[selectedProvider] || 'API key...'} autocomplete="off" spellcheck="false">
        <div class="key-status">{keyHints[selectedProvider] || ''}</div>
      </div>
      <button class="btn" on:click={connectAI}>Connect</button>
    {/if}
  </div>

  <!-- Chat -->
  <div class="card">
    <div class="card-header">Chat</div>
    <button class="btn btn-secondary" on:click={clearChat}>Clear Chat History</button>
  </div>

  <!-- About -->
  <div class="card">
    <div class="card-header">About</div>
    <p style="color:var(--text-muted);font-size:13px">
      $&gt; mob.IDE v0.2.0<br>
      Mobile-first developer workspace<br>
      Built for phone-only developers<br><br>
      All data stored locally on your device.<br>
      API keys stored in IndexedDB.
    </p>
  </div>

  <!-- Data -->
  <div class="card">
    <div class="card-header">Data</div>
    <button class="btn btn-secondary" on:click={exportData} style="margin-bottom:8px">Export Data</button>
    <button class="btn btn-danger" on:click={clearAll}>Clear All Data</button>
  </div>
</div>

<style>
  .page { padding: 16px; }
  .page-header { display:flex;align-items:center;gap:12px;margin-bottom:16px; }
  select {
    width:100%;
    background:var(--bg-tertiary);
    border:1px solid var(--border);
    border-radius:var(--radius-sm);
    color:var(--text);
    padding:12px;
    font-size:16px;
    font-family: var(--font-sans);
  }
</style>
