T.suite('AI.PROVIDERS', () => {
    T.assert('has groq', !!AI.PROVIDERS.groq);
    T.assert('has openrouter', !!AI.PROVIDERS.openrouter);
    T.assert('has mistral', !!AI.PROVIDERS.mistral);
    T.assert('has gemini', !!AI.PROVIDERS.gemini);
    T.assert('has custom', !!AI.PROVIDERS.custom);
    T.assert('each provider has name', Object.values(AI.PROVIDERS).every(p => p.name));
    T.assert('each provider has keyName', Object.values(AI.PROVIDERS).every(p => p.keyName));
    T.eq('groq base url', AI.PROVIDERS.groq.baseUrl, 'https://api.groq.com/openai/v1');
    T.assert('gemini has isGemini flag', AI.PROVIDERS.gemini.isGemini === true);
});

T.suite('AI.MODELS', () => {
    T.assert('groq has models', AI.MODELS.groq.length >= 5);
    T.assert('openrouter has models', AI.MODELS.openrouter.length >= 3);
    T.assert('mistral has models', AI.MODELS.mistral.length >= 2);
    T.assert('gemini has models', AI.MODELS.gemini.length >= 2);
    T.assert('each groq model has id', AI.MODELS.groq.every(m => m.id && m.name && m.ctx));
    T.assert('each openrouter model has id', AI.MODELS.openrouter.every(m => m.id && m.name && m.ctx));
});

T.suite('AI.SYSTEM_PROMPTS', () => {
    T.assert('has default prompt', !!AI.SYSTEM_PROMPTS.default);
    T.assert('has review prompt', !!AI.SYSTEM_PROMPTS.review);
    T.assert('has explain prompt', !!AI.SYSTEM_PROMPTS.explain);
    T.assert('has debug prompt', !!AI.SYSTEM_PROMPTS.debug);
});

T.suite('AI.getModel', () => {
    const origModel = AI._model;
    const origProvider = AI._provider;
    AI._provider = 'groq';
    AI._model = 'llama-3.3-70b-versatile';
    T.eq('returns correct model', AI.getModel().name, 'LLaMA 3.3 70B');

    AI._model = 'nonexistent';
    T.eq('falls back to first model', AI.getModel().id, 'llama-3.3-70b-versatile');
    AI._model = origModel;
    AI._provider = origProvider;
});

T.suite('AI.getProviderModels', () => {
    const orig = AI._provider;
    AI._provider = 'groq';
    T.assert('returns groq models', AI.getProviderModels().length >= 5);
    AI._provider = 'gemini';
    T.assert('returns gemini models', AI.getProviderModels().length >= 2);
    AI._provider = 'custom';
    T.assert('custom returns empty', AI.getProviderModels().length === 0);
    AI._provider = orig;
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

T.suite('AI provider methods', () => {
    T.assert('setProvider exists', typeof AI.setProvider === 'function');
    T.assert('setCustomBaseUrl exists', typeof AI.setCustomBaseUrl === 'function');
    T.assert('_buildOpenAIBody exists', typeof AI._buildOpenAIBody === 'function');
    T.assert('_buildGeminiBody exists', typeof AI._buildGeminiBody === 'function');
});
