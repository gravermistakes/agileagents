const App = {
    currentPage: 'home',

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

        this.navigate('home');
    },

    navigate(page, pushState = true) {
        this.currentPage = page;

        // Update nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        // Render page
        switch (page) {
            case 'home': HomePage.render(); break;
            case 'repos': ReposPage.render(); break;
            case 'chat': ChatPage.render(); break;
            case 'projects': ProjectsPage.render(); break;
            case 'settings': SettingsPage.render(); break;
        }

        // Push history state
        if (pushState) {
            history.pushState({ page }, '', `#${page}`);
        }

        // Scroll to top
        document.getElementById('page-container').scrollTop = 0;
    },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
