const T = {
    _passed: 0,
    _failed: 0,
    _errors: [],
    _current: '',

    suite(name, fn) {
        this._current = name;
        try { fn(); } catch (e) {
            this._failed++;
            this._errors.push({ suite: name, test: '(suite threw)', error: e.message });
        }
    },

    assert(description, condition) {
        if (condition) {
            this._passed++;
        } else {
            this._failed++;
            this._errors.push({ suite: this._current, test: description, error: 'assertion failed' });
        }
    },

    eq(description, actual, expected) {
        if (actual === expected) {
            this._passed++;
        } else {
            this._failed++;
            this._errors.push({
                suite: this._current, test: description,
                error: `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            });
        }
    },

    throws(description, fn) {
        try { fn(); this._failed++; this._errors.push({ suite: this._current, test: description, error: 'expected throw' }); }
        catch { this._passed++; }
    },

    report() {
        const total = this._passed + this._failed;
        const el = document.getElementById('test-results');
        if (el) {
            let html = `<h2>${this._failed === 0 ? '✅' : '❌'} ${this._passed}/${total} passed</h2>`;
            if (this._errors.length) {
                html += '<div class="failures">';
                this._errors.forEach(e => {
                    html += `<div class="fail"><strong>${e.suite} → ${e.test}</strong><br>${e.error}</div>`;
                });
                html += '</div>';
            }
            el.innerHTML = html;
        }
        console.log(`${this._passed}/${total} passed, ${this._failed} failed`);
        this._errors.forEach(e => console.error(`FAIL: ${e.suite} → ${e.test}: ${e.error}`));
        return this._failed === 0;
    }
};
