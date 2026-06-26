<script>
  import { onMount } from 'svelte';
  import { projects, showToast } from '../stores.js';
  import Storage from '../lib/storage.js';
  import UI from '../lib/ui.js';

  const COLUMNS = ['todo', 'doing', 'done'];
  const COLUMN_LABELS = { todo: 'To Do', doing: 'In Progress', done: 'Done' };

  let view = 'list';         // 'list' | 'board' | 'edit-task'
  let activeProjectIdx = null;
  let editingTaskIdx = null;

  let newProjectName = '';
  let showAddProject = false;
  let newTaskText = '';
  let showAddTask = false;

  let editTaskText = '';
  let editTaskNote = '';
  let editTaskStatus = 'todo';

  onMount(async () => {
    const data = await Storage.getJSON('projects');
    if (Array.isArray(data)) {
      projects.set(data.filter(p => p && typeof p.name === 'string' && Array.isArray(p.tasks)));
    }
  });

  async function save() {
    await Storage.setJSON('projects', $projects);
  }

  async function addProject() {
    const name = newProjectName.trim();
    if (!name) { showToast('Enter a name'); return; }
    projects.update(list => [...list, { name, tasks: [], createdAt: new Date().toISOString() }]);
    await save();
    newProjectName = '';
    showAddProject = false;
    showToast('Project created');
  }

  function openProject(idx) {
    activeProjectIdx = idx;
    view = 'board';
  }

  async function addTask() {
    const text = newTaskText.trim();
    if (!text) { showToast('Enter a task'); return; }
    projects.update(list => {
      list[activeProjectIdx].tasks.push({ text, status: 'todo', note: '', createdAt: new Date().toISOString() });
      return [...list];
    });
    await save();
    newTaskText = '';
    showAddTask = false;
    showToast('Task added');
  }

  async function moveTask(taskIdx, newStatus) {
    projects.update(list => {
      list[activeProjectIdx].tasks[taskIdx].status = newStatus;
      return [...list];
    });
    await save();
  }

  function startEditTask(taskIdx) {
    const task = $projects[activeProjectIdx].tasks[taskIdx];
    editingTaskIdx = taskIdx;
    editTaskText = task.text;
    editTaskNote = task.note || '';
    editTaskStatus = task.status;
    view = 'edit-task';
  }

  async function saveTask() {
    const text = editTaskText.trim();
    if (!text) { showToast('Task cannot be empty'); return; }
    projects.update(list => {
      list[activeProjectIdx].tasks[editingTaskIdx] = {
        ...list[activeProjectIdx].tasks[editingTaskIdx],
        text,
        note: editTaskNote,
        status: editTaskStatus,
      };
      return [...list];
    });
    await save();
    view = 'board';
    showToast('Task saved');
  }

  async function deleteTask(taskIdx) {
    if (!confirm('Delete this task?')) return;
    projects.update(list => {
      list[activeProjectIdx].tasks.splice(taskIdx, 1);
      return [...list];
    });
    await save();
    showToast('Task deleted');
  }

  async function deleteProject() {
    if (!confirm('Delete this entire project and all its tasks?')) return;
    projects.update(list => {
      list.splice(activeProjectIdx, 1);
      return [...list];
    });
    activeProjectIdx = null;
    view = 'list';
    await save();
    showToast('Project deleted');
  }

  $: activeProject = activeProjectIdx !== null ? $projects[activeProjectIdx] : null;
</script>

<div class="page">
  <!-- LIST VIEW -->
  {#if view === 'list'}
    <div class="page-header">
      <h1>Projects</h1>
      <button class="add-btn" on:click={() => showAddProject = !showAddProject}>+</button>
    </div>

    {#if showAddProject}
      <div class="card" style="margin-bottom:12px">
        <input type="text" bind:value={newProjectName} placeholder="Project name..." style="margin-bottom:8px" on:keydown={e => e.key === 'Enter' && addProject()}>
        <div style="display:flex;gap:8px">
          <button class="btn" on:click={addProject} style="flex:1">Create</button>
          <button class="btn btn-secondary" on:click={() => showAddProject = false} style="flex:1">Cancel</button>
        </div>
      </div>
    {/if}

    {#if $projects.length}
      {#each $projects as project, i}
        {@const taskCount = project.tasks.length}
        {@const doneCount = project.tasks.filter(t => t.status === 'done').length}
        {@const progress = taskCount ? Math.round((doneCount / taskCount) * 100) : 0}
        <div class="list-item" on:click={() => openProject(i)} role="button" tabindex="0">
          <div style="flex:1">
            <div class="title">{project.name}</div>
            <div class="subtitle">{taskCount} tasks · {doneCount} done · {progress}%</div>
            <div class="progress-bar"><div class="progress-fill" style="width:{progress}%"></div></div>
          </div>
          <span class="chevron">›</span>
        </div>
      {/each}
    {:else}
      <div class="empty-state">
        <div class="emoji">📋</div>
        <p>No projects yet</p>
        <p style="font-size:13px;color:var(--text-muted)">Tap + to create one</p>
      </div>
    {/if}

  <!-- BOARD VIEW -->
  {:else if view === 'board' && activeProject}
    <div class="page-header">
      <button class="back-btn" on:click={() => { view = 'list'; activeProjectIdx = null; }}>← Back</button>
      <h1 style="font-size:18px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{activeProject.name}</h1>
      <button class="add-btn" on:click={() => showAddTask = !showAddTask}>+</button>
    </div>

    {#if showAddTask}
      <div class="card" style="margin-bottom:12px">
        <input type="text" bind:value={newTaskText} placeholder="Task description..." style="margin-bottom:8px" on:keydown={e => e.key === 'Enter' && addTask()}>
        <div style="display:flex;gap:8px">
          <button class="btn" on:click={addTask} style="flex:1">Add</button>
          <button class="btn btn-secondary" on:click={() => showAddTask = false} style="flex:1">Cancel</button>
        </div>
      </div>
    {/if}

    <div class="kanban-columns">
      {#each COLUMNS as col}
        {@const colTasks = activeProject.tasks.map((t, i) => ({ ...t, _idx: i })).filter(t => t.status === col)}
        <div class="kanban-column">
          <div class="kanban-column-header">
            <span>{COLUMN_LABELS[col]}</span>
            <span class="kanban-count">{colTasks.length}</span>
          </div>
          <div class="kanban-cards">
            {#each colTasks as task}
              <div class="kanban-card">
                <div class="kanban-card-text">{task.text}</div>
                {#if task.note}
                  <div class="kanban-card-note">{task.note.substring(0, 80)}{task.note.length > 80 ? '...' : ''}</div>
                {/if}
                <div class="kanban-card-actions">
                  {#if col !== 'todo'}
                    <button on:click={() => moveTask(task._idx, COLUMNS[COLUMNS.indexOf(col) - 1])}>←</button>
                  {/if}
                  <button on:click={() => startEditTask(task._idx)}>✏️</button>
                  <button on:click={() => deleteTask(task._idx)}>🗑️</button>
                  {#if col !== 'done'}
                    <button on:click={() => moveTask(task._idx, COLUMNS[COLUMNS.indexOf(col) + 1])}>→</button>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="kanban-empty">No tasks</div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div style="margin-top:16px">
      <button class="btn btn-danger" on:click={deleteProject} style="font-size:13px">Delete Project</button>
    </div>

  <!-- EDIT TASK VIEW -->
  {:else if view === 'edit-task'}
    <div class="page-header">
      <button class="back-btn" on:click={() => view = 'board'}>← Back</button>
      <h1 style="font-size:18px">Edit Task</h1>
    </div>
    <div class="card">
      <div class="key-input-group">
        <label>Task</label>
        <input type="text" bind:value={editTaskText}>
      </div>
      <div class="key-input-group">
        <label>Notes (markdown)</label>
        <textarea bind:value={editTaskNote} rows="6" style="min-height:120px"></textarea>
      </div>
      <div class="key-input-group">
        <label>Status</label>
        <select bind:value={editTaskStatus}>
          {#each COLUMNS as c}
            <option value={c}>{COLUMN_LABELS[c]}</option>
          {/each}
        </select>
      </div>
      <button class="btn" on:click={saveTask}>Save</button>
    </div>
  {/if}
</div>

<style>
  .page { padding: 16px; }
  .page-header { display:flex;align-items:center;gap:12px;margin-bottom:16px; }
  .add-btn { margin-left:auto; background:none; border:none; font-size:28px; color:var(--green); cursor:pointer; line-height:1; min-width:44px; min-height:44px; }
  select { width:100%; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text); padding:12px; font-size:16px; font-family:var(--font-sans); }
</style>
