import '../css/app.css';
import '../css/fonts.css';
import '../css/mobile.css';
import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, { target: document.getElementById('app') });

export default app;
