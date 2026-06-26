<script>
  import { onMount } from 'svelte';
  import { currentPage, toastQueue } from './stores.js';
  import Storage from './lib/storage.js';
  import GitHub from './lib/github.js';
  import AI from './lib/ai.js';
  import Home from './pages/Home.svelte';
  import Repos from './pages/Repos.svelte';
  import Chat from './pages/Chat.svelte';
  import Projects from './pages/Projects.svelte';
  import Apps from './pages/Apps.svelte';
  import Settings from './pages/Settings.svelte';

  let ready = false;

  onMount(async () => {
    await Storage.init();
    await GitHub.init();
    await AI.init();
    ready = true;
  });

  const NAV = [
    { id: 'home',     label: 'Home',     icon: '⌂' },
    { id: 'repos',    label: 'Repos',    icon: '📁' },
    { id: 'chat',     label: 'AI',       icon: '💬' },
    { id: 'projects', label: 'Tasks',    icon: '📋' },
    { id: 'apps',     label: 'Apps',     icon: '📱' },
  ];
</script>

{#if !ready}
  <div class="splash">
    <div class="splash-logo">$&gt; mob.IDE</div>
    <span class="spinner"></span>
  </div>
{:else}
  <div class="app-shell">
    <main class="page-container">
      {#if $currentPage === 'home'}
        <Home />
      {:else if $currentPage === 'repos'}
        <Repos />
      {:else if $currentPage === 'chat'}
        <Chat />
      {:else if $currentPage === 'projects'}
        <Projects />
      {:else if $currentPage === 'apps'}
        <Apps />
      {:else if $currentPage === 'settings'}
        <Settings />
      {/if}
    </main>

    {#if $currentPage !== 'settings'}
      <nav class="bottom-nav">
        {#each NAV as tab}
          <button
            class="nav-tab {$currentPage === tab.id ? 'active' : ''}"
            on:click={() => currentPage.set(tab.id)}
          >
            <span class="nav-icon">{tab.icon}</span>
            <span class="nav-label">{tab.label}</span>
          </button>
        {/each}
      </nav>
    {/if}
  </div>

  <div class="toast-container">
    {#each $toastQueue as toast (toast.id)}
      <div class="toast">{toast.msg}</div>
    {/each}
  </div>
{/if}

<style>
  .splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100dvh;
    gap: 24px;
    background: var(--bg);
  }

  .splash-logo {
    font-family: var(--font-mono);
    font-size: 28px;
    color: var(--green);
    letter-spacing: 0.05em;
  }

  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg);
  }

  .page-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    padding: 0 0 80px 0;
  }

  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    display: flex;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 100;
  }

  .nav-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: none;
    border: none;
    color: var(--icon-color);
    cursor: pointer;
    padding: 8px 0;
    transition: color 0.15s;
    min-height: 44px;
  }

  .nav-tab.active {
    color: var(--tab-active);
  }

  .nav-icon {
    font-size: 20px;
    line-height: 1;
  }

  .nav-label {
    font-size: 10px;
    letter-spacing: 0.04em;
  }

  .toast-container {
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 200;
    pointer-events: none;
    width: max-content;
    max-width: calc(100vw - 32px);
  }

  .toast {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
