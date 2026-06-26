import { writable } from 'svelte/store';

export const currentPage = writable('home');
export const toastQueue = writable([]);
export const projects = writable([]);
export const pendingAIContext = writable({ text: '', fileName: '' });
export const repoContext = writable({ owner: '', repo: '', path: '' });
export const pendingEdits = writable([]);

let _toastId = 0;
export function showToast(msg, duration = 2500) {
    const id = ++_toastId;
    toastQueue.update(q => [...q, { id, msg }]);
    setTimeout(() => {
        toastQueue.update(q => q.filter(t => t.id !== id));
    }, duration);
}
