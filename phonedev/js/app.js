const App = {
    currentPage: 'home',
    _pages: ['home', 'repos', 'chat', 'projects', 'settings'],
    _touchStartX: 0,
    _touchStartY: 0,

    async init() {
        try {
            await Storage.init();
        } catch (e) {
            document.getElementById('page-container').innerHTML =
                '<div class="empty-state"><p>Storage unavailable. Try disabling private browsing or clearing site data.</p></div>';
            return;
        }
        await GitHub.init();
        await AI.init();
        await ProjectsPage.init();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigate(btn.dataset.page);
            });
        });

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigate(e.state.page, false);
            }
        });

        this._initSwipe();
        this.navigate('home');
    },

    _initSwipe() {
        const container = document.getElementById('page-container');
        container.addEventListener('touchstart', (e) => {
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - this._touchStartX;
            const dy = e.changedTouches[0].clientY - this._touchStartY;
            if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
            if (ChatPage._streaming) return;

            const idx = this._pages.indexOf(this.currentPage);
            if (dx > 0 && idx > 0) {
                this.navigate(this._pages[idx - 1]);
            } else if (dx < 0 && idx < this._pages.length - 1) {
                this.navigate(this._pages[idx + 1]);
            }
        }, { passive: true });
    },

    navigate(page, pushState = true) {
        this.currentPage = page;

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        switch (page) {
            case 'home': HomePage.render(); break;
            case 'repos': ReposPage.render(); break;
            case 'chat': ChatPage.render(); break;
            case 'projects': ProjectsPage.render(); break;
            case 'settings': SettingsPage.render(); break;
        }

        if (pushState) {
            history.pushState({ page }, '', `#${page}`);
        }

        document.getElementById('page-container').scrollTop = 0;
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
