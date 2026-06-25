T.suite('UI.escapeHtml', () => {
    T.eq('escapes angle brackets', UI.escapeHtml('<script>'), '&lt;script&gt;');
    T.eq('escapes ampersand', UI.escapeHtml('a & b'), 'a &amp; b');
    T.eq('passes quotes through', UI.escapeHtml('"hello"'), '"hello"');
    T.eq('passes plain text through', UI.escapeHtml('hello world'), 'hello world');
    T.eq('handles empty string', UI.escapeHtml(''), '');
});

T.suite('UI.escapeAttr', () => {
    T.eq('escapes single quotes', UI.escapeAttr("it's"), "it&#39;s");
    T.eq('escapes double quotes', UI.escapeAttr('say "hi"'), 'say &quot;hi&quot;');
    T.eq('escapes backslashes', UI.escapeAttr('a\\b'), 'a\\\\b');
    T.eq('escapes ampersand', UI.escapeAttr('a&b'), 'a&amp;b');
    T.eq('handles XSS payload', UI.escapeAttr("'); alert(1)//"), "&#39;); alert(1)//");
    T.eq('passes safe strings', UI.escapeAttr('hello-world'), 'hello-world');
});

T.suite('UI.formatSize', () => {
    T.eq('bytes', UI.formatSize(500), '500 B');
    T.eq('kilobytes', UI.formatSize(2048), '2.0 KB');
    T.eq('megabytes', UI.formatSize(1500000), '1.4 MB');
    T.eq('zero', UI.formatSize(0), '0 B');
    T.eq('exact 1KB', UI.formatSize(1024), '1.0 KB');
});

T.suite('UI.timeAgo', () => {
    const now = new Date();
    T.eq('just now', UI.timeAgo(new Date(now - 30000).toISOString()), 'just now');
    T.eq('minutes ago', UI.timeAgo(new Date(now - 300000).toISOString()), '5m ago');
    T.eq('hours ago', UI.timeAgo(new Date(now - 7200000).toISOString()), '2h ago');
    T.eq('days ago', UI.timeAgo(new Date(now - 172800000).toISOString()), '2d ago');
});

T.suite('UI.fileIcon', () => {
    T.eq('directory', UI.fileIcon('src', true), '📁');
    T.eq('javascript', UI.fileIcon('app.js', false), '🟡');
    T.eq('typescript', UI.fileIcon('app.ts', false), '🔵');
    T.eq('python', UI.fileIcon('main.py', false), '🐍');
    T.eq('unknown', UI.fileIcon('data.xyz', false), '📄');
    T.eq('markdown', UI.fileIcon('README.md', false), '📝');
    T.eq('zig', UI.fileIcon('main.zig', false), '⚡');
});

T.suite('UI.renderMarkdown', () => {
    T.assert('escapes HTML in input', UI.renderMarkdown('<script>alert(1)</script>').includes('&lt;script&gt;'));
    T.assert('renders bold', UI.renderMarkdown('**bold**').includes('<strong>bold</strong>'));
    T.assert('renders italic', UI.renderMarkdown('*italic*').includes('<em>italic</em>'));
    T.assert('renders inline code', UI.renderMarkdown('use `foo()`').includes('<code>foo()</code>'));
    T.assert('renders code blocks with copy button', UI.renderMarkdown('```js\nconst x = 1;\n```').includes('copy-code-btn'));
    T.assert('code blocks have pre tags', UI.renderMarkdown('```\nhello\n```').includes('<pre'));
    T.assert('line breaks', UI.renderMarkdown('a\nb').includes('<br>'));
});

T.suite('UI.copyCode', () => {
    T.assert('copyCode is a function', typeof UI.copyCode === 'function');
});

T.suite('UI.toast', () => {
    UI.toast('test message', 100);
    const el = document.getElementById('toast');
    T.assert('toast shows message', el && el.textContent === 'test message');
    T.assert('toast is visible', el && !el.classList.contains('hidden'));
});
