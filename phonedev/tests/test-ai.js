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
    T.assert('has agent prompt', !!AI.SYSTEM_PROMPTS.agent);
    T.assert('agent prompt mentions tools', AI.SYSTEM_PROMPTS.agent.includes('tools'));
});

T.suite('AI.AGENT_TOOLS', () => {
    T.assert('has tools array', Array.isArray(AI.AGENT_TOOLS));
    T.assert('has 3 tools', AI.AGENT_TOOLS.length === 3);
    T.eq('first tool is read_file', AI.AGENT_TOOLS[0].function.name, 'read_file');
    T.eq('second tool is list_files', AI.AGENT_TOOLS[1].function.name, 'list_files');
    T.eq('third tool is edit_file', AI.AGENT_TOOLS[2].function.name, 'edit_file');
    T.assert('each tool has parameters', AI.AGENT_TOOLS.every(t => t.function.parameters));
    T.assert('read_file requires owner/repo/path', AI.AGENT_TOOLS[0].function.parameters.required.length === 3);
});

T.suite('AI agentic methods', () => {
    T.assert('sendAgentic exists', typeof AI.sendAgentic === 'function');
    T.assert('_executeTool exists', typeof AI._executeTool === 'function');
    T.assert('_agentCallOpenAI exists', typeof AI._agentCallOpenAI === 'function');
    T.assert('_agentCallGemini exists', typeof AI._agentCallGemini === 'function');
    T.assert('_geminiToolDeclarations exists', typeof AI._geminiToolDeclarations === 'function');
    T.assert('_toGeminiSchema exists', typeof AI._toGeminiSchema === 'function');
});

T.suite('AI._toGeminiSchema', () => {
    const result = AI._toGeminiSchema({ type: 'object', properties: { name: { type: 'string', description: 'test' } }, required: ['name'] });
    T.eq('converts object type', result.type, 'OBJECT');
    T.eq('converts string type', result.properties.name.type, 'STRING');
    T.assert('preserves required', result.required.includes('name'));
});

T.suite('AI._geminiToolDeclarations', () => {
    const decls = AI._geminiToolDeclarations();
    T.eq('has 3 declarations', decls.length, 3);
    T.eq('first is read_file', decls[0].name, 'read_file');
    T.eq('params type is OBJECT', decls[0].parameters.type, 'OBJECT');
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
