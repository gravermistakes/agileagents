<script>
  import { onMount } from 'svelte';
  import { currentPage, projects, showToast } from '../stores.js';
  import GitHub from '../lib/github.js';
  import AI from '../lib/ai.js';
  import UI from '../lib/ui.js';

  let ghConnected = GitHub.isConnected();
  let aiConnected = AI.isConnected();
  let recentRepos = [];
  let reposLoading = false;
  let reposError = '';

  onMount(async () => {
    ghConnected = GitHub.isConnected();
    aiConnected = AI.isConnected();
    if (ghConnected) loadRecentRepos();
  });

  async function loadRecentRepos() {
    reposLoading = true;
    reposError = '';
    try {
      const repos = await GitHub.getRepos();
      recentRepos = repos.slice(0, 5);
    } catch (e) {
      reposError = e.message;
    } finally {
      reposLoading = false;
    }
  }

  function openRepo(owner, repo) {
    import('../lib/github.js').then(() => {
      currentPage.set('repos');
      import('./Repos.svelte').then(m => {
        window._pendingRepo = { owner, repo };
      });
    });
    window._pendingRepo = { owner, repo };
    currentPage.set('repos');
  }

  $: activeTasks = (() => {
    const doing = [];
    $projects.forEach((p, pi) => {
      p.tasks.forEach((t, ti) => {
        if (t.status === 'doing') doing.push({ project: p.name, text: t.text, pi });
      });
    });
    return doing.slice(0, 5);
  })();
</script>

<div class="page">
  <div class="page-header">
    <h1>$&gt; mob.IDE</h1>
    <button class="icon-btn" on:click={() => currentPage.set('settings')} aria-label="Settings">⚙</button>
  </div>

  <div class="card">
    <div class="card-header">Status</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span class="badge {ghConnected ? 'connected' : 'disconnected'}">
        GitHub {ghConnected ? 'Connected' : 'Not Set'}
      </span>
      <span class="badge {aiConnected ? 'connected' : 'disconnected'}">
        {AI.PROVIDERS[AI._provider].name} {aiConnected ? 'Connected' : 'Not Set'}
      </span>
    </div>
    {#if !ghConnected || !aiConnected}
      <p style="color:var(--text-muted);font-size:13px;margin-top:12px">
        Go to Settings to add your API keys
      </p>
    {/if}
  </div>

  {#if ghConnected}
    <div class="card">
      <div class="card-header">Recent Repos</div>
      {#if reposLoading}
        <div style="text-align:center;padding:16px"><span class="spinner"></span></div>
      {:else if reposError}
        <p style="color:var(--red);font-size:13px">{reposError}</p>
      {:else if recentRepos.length}
        {#each recentRepos as repo}
          <div class="list-item" on:click={() => openRepo(repo.owner.login, repo.name)} role="button" tabindex="0">
            <div>
              <div class="title">{repo.name}</div>
              <div class="subtitle">{UI.timeAgo(repo.updated_at)} · {repo.language || 'Unknown'}</div>
            </div>
            <span class="chevron">›</span>
          </div>
        {/each}
      {:else}
        <p style="color:var(--text-muted);font-size:13px;padding:8px 0">No repos found</p>
      {/if}
    </div>
  {:else}
    <div class="card">
      <div class="empty-state">
        <div class="emoji">🔑</div>
        <p>Add your GitHub token in Settings to get started</p>
        <button class="btn" on:click={() => currentPage.set('settings')}>Open Settings</button>
      </div>
    </div>
  {/if}

  <div class="card">
    <div class="card-header">Quick Actions</div>
    <button class="btn btn-secondary" on:click={() => currentPage.set('chat')} style="margin-bottom:8px">💬 Ask AI</button>
    <button class="btn btn-secondary" on:click={() => currentPage.set('repos')} style="margin-bottom:8px">📁 Browse Repos</button>
    <button class="btn btn-secondary" on:click={() => currentPage.set('projects')} style="margin-bottom:8px">📋 Task Board</button>
    <button class="btn btn-secondary" on:click={() => currentPage.set('apps')}>📱 Apps & Terminal</button>
  </div>

  {#if activeTasks.length}
    <div class="card">
      <div class="card-header">In Progress</div>
      {#each activeTasks as t}
        <div class="list-item" on:click={() => currentPage.set('projects')} role="button" tabindex="0">
          <div>
            <div class="title">{t.text}</div>
            <div class="subtitle">{t.project}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 16px; }
  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .icon-btn { background:none; border:none; font-size:20px; color:var(--icon-color); cursor:pointer; padding:8px; min-height:44px; min-width:44px; }
</style>
