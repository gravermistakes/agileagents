<script>
  import { onMount } from 'svelte';
  import Termux from '../lib/termux.js';

  const SERVICES = [
    { id: 'discord', name: 'Discord', icon: '💬', url: 'https://discord.com/app', color: '#5865F2', desc: 'Chat with dev communities' },
    { id: 'matrix', name: 'Matrix', icon: '🔐', url: 'https://app.element.io', color: '#0DBD8B', desc: 'Encrypted dev chat (Element)' },
    { id: 'kaggle', name: 'Kaggle', icon: '📊', url: 'https://www.kaggle.com', color: '#20BEFF', desc: 'Datasets, notebooks, competitions' },
    { id: 'termux', name: 'Terminal', icon: '⬛', url: null, color: '#2b2b2b', desc: 'Termux terminal bridge' },
  ];

  let showTerminal = false;
  let termInput = '';
  let termHistory = [...Termux.getHistory()];
  let termOutput;

  function open(id) {
    const svc = SERVICES.find(s => s.id === id);
    if (!svc) return;
    if (id === 'termux') {
      showTerminal = true;
      termHistory = [...Termux.getHistory()];
      setTimeout(scrollTerm, 50);
      return;
    }
    window.open(svc.url, '_blank', 'noopener');
  }

  function scrollTerm() {
    if (termOutput) termOutput.scrollTop = termOutput.scrollHeight;
  }

  async function runCommand() {
    const cmd = termInput.trim();
    if (!cmd) return;
    termInput = '';
    Termux.addOutput('$ ' + cmd, 'cmd');
    const result = await Termux.execute(cmd);
    Termux.addOutput(result.output, result.error ? 'error' : 'result');
    termHistory = [...Termux.getHistory()];
    setTimeout(scrollTerm, 50);
  }

  function quickCmd(cmd) {
    termInput = cmd;
    runCommand();
  }

  function handleKey(e) {
    if (e.key === 'Enter') runCommand();
  }

  const QUICK = ['ls -la', 'pwd', 'git status', 'node -v', 'python3 --version', 'pkg list-installed'];
</script>

<div class="page">
  {#if showTerminal}
    <div class="page-header">
      <button class="back-btn" on:click={() => showTerminal = false}>← Back</button>
      <h1 style="font-size:18px">Terminal</h1>
      <span class="badge {Termux.isAvailable() ? 'connected' : 'disconnected'}" style="margin-left:auto;font-size:11px">
        {Termux.isAvailable() ? 'Termux Ready' : 'Not Connected'}
      </span>
    </div>

    <div class="term-output" bind:this={termOutput}>
      {#each termHistory as h}
        <div class="term-line {h.type}">{h.text}</div>
      {/each}
    </div>

    <div class="term-input-row">
      <span class="term-prompt">$</span>
      <input
        type="text"
        bind:value={termInput}
        placeholder="Enter command..."
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        on:keydown={handleKey}
      >
      <button class="btn" style="width:auto;min-height:40px;padding:8px 14px" on:click={runCommand}>Run</button>
    </div>

    {#if !Termux.isAvailable()}
      <div class="card" style="margin-top:12px">
        <div class="card-header">Setup</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px">
          Install <strong>Termux</strong> and <strong>Termux:API</strong> from F-Droid, then grant mob.IDE storage access.
        </p>
        <button class="btn btn-secondary" on:click={() => Termux.tryConnect()}>Detect Termux</button>
      </div>
    {/if}

    <div class="card" style="margin-top:12px">
      <div class="card-header">Quick Commands</div>
      <div class="quick-prompts">
        {#each QUICK as cmd}
          <button class="quick-prompt-chip" on:click={() => quickCmd(cmd)}>{cmd}</button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="page-header"><h1>Apps</h1></div>
    <div class="apps-grid">
      {#each SERVICES as s}
        <div class="app-card" on:click={() => open(s.id)} role="button" tabindex="0" style="--card-accent:{s.color}">
          <div class="app-card-icon">{s.icon}</div>
          <div class="app-card-name">{s.name}</div>
          <div class="app-card-desc">{s.desc}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 16px; }
  .page-header { display:flex;align-items:center;gap:12px;margin-bottom:16px; }

  .term-line { font-family: var(--font-mono); font-size: 13px; padding: 1px 0; white-space: pre-wrap; word-break: break-all; }
  .term-line.cmd { color: var(--tab-active); }
  .term-line.error { color: var(--red, #ff6b6b); }
  .term-line.result { color: var(--text); }
</style>
