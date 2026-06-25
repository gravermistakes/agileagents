T.suite('AI.MODELS', () => {
    T.assert('has models defined', AI.MODELS.length >= 5);
    T.assert('each model has id', AI.MODELS.every(m => m.id && m.name && m.ctx));
    T.eq('default model', AI._model, 'llama-3.3-70b-versatile');
});

T.suite('AI.SYSTEM_PROMPTS', () => {
    T.assert('has default prompt', !!AI.SYSTEM_PROMPTS.default);
    T.assert('has review prompt', !!AI.SYSTEM_PROMPTS.review);
    T.assert('has explain prompt', !!AI.SYSTEM_PROMPTS.explain);
    T.assert('has debug prompt', !!AI.SYSTEM_PROMPTS.debug);
});

T.suite('AI.getModel', () => {
    const orig = AI._model;
    AI._model = 'llama-3.3-70b-versatile';
    T.eq('returns correct model', AI.getModel().name, 'LLaMA 3.3 70B');

    AI._model = 'nonexistent';
    T.eq('falls back to first model', AI.getModel().id, 'llama-3.3-70b-versatile');
    AI._model = orig;
});

T.suite('AI.isConnected', () => {
    const orig = AI._key;
    AI._key = null;
    T.eq('false when no key', AI.isConnected(), false);
    AI._key = 'test-key';
    T.eq('true when key set', AI.isConnected(), true);
    AI._key = orig;
});

T.suite('AI.clearHistory', () => {
    const orig = AI._messages;
    AI._messages = [{ role: 'user', content: 'hi' }];
    AI.clearHistory();
    T.eq('empties messages', AI._messages.length, 0);
    AI._messages = orig;
});

T.suite('AI.send guards', () => {
    const orig = AI._key;
    AI._key = null;
    let threw = false;
    AI.send('test').catch(() => { threw = true; });
    T.assert('send is a function', typeof AI.send === 'function');
    AI._key = orig;
});

T.suite('AI.sendStream guards', () => {
    T.assert('sendStream is a function', typeof AI.sendStream === 'function');
});
