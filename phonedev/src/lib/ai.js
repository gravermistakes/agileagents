import { get } from 'svelte/store';
import Storage from './storage.js';
import GitHub from './github.js';
import { repoContext, pendingEdits } from '../stores.js';

const AI = {
    _key: null,
    _model: 'llama-3.3-70b-versatile',
    _provider: 'groq',
    _messages: [],

    PROVIDERS: {
        groq: {
            name: 'Groq',
            baseUrl: 'https://api.groq.com/openai/v1',
            keyName: 'groq_key',
            limits: '30 RPM, free',
            validatePath: '/models',
        },
        openrouter: {
            name: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            keyName: 'openrouter_key',
            limits: 'Varies, free models available',
            validatePath: '/models',
        },
        mistral: {
            name: 'Mistral',
            baseUrl: 'https://api.mistral.ai/v1',
            keyName: 'mistral_key',
            limits: '2 RPM, 1B tokens/mo free',
            validatePath: '/models',
        },
        gemini: {
            name: 'Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            keyName: 'gemini_key',
            limits: '500 req/day free',
            validatePath: null,
            isGemini: true,
        },
        custom: {
            name: 'Custom',
            baseUrl: null,
            keyName: 'custom_key',
            limits: 'Depends on provider',
            validatePath: '/models',
        },
    },

    MODELS: {
        groq: [
            { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B', ctx: '128k' },
            { id: 'llama-4-maverick-17b-128e-instruct', name: 'LLaMA 4 Maverick', ctx: '128k' },
            { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'LLaMA 4 Scout', ctx: '512k' },
            { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', ctx: '128k' },
            { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', ctx: '128k' },
        ],
        openrouter: [
            { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (free)', ctx: '64k' },
            { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'LLaMA 3.3 70B (free)', ctx: '128k' },
            { id: 'qwen/qwen3-32b:free', name: 'Qwen3 32B (free)', ctx: '128k' },
            { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (free)', ctx: '96k' },
        ],
        mistral: [
            { id: 'mistral-small-latest', name: 'Mistral Small', ctx: '32k' },
            { id: 'codestral-latest', name: 'Codestral', ctx: '32k' },
        ],
        gemini: [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', ctx: '1M' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', ctx: '1M' },
        ],
        custom: [],
    },

    SYSTEM_PROMPTS: {
        default: 'You are a helpful coding assistant. Be concise. Use code blocks with language tags.',
        review: 'You are a code reviewer. Point out bugs, security issues, and improvements. Be direct.',
        explain: 'You explain code clearly and concisely. Use examples when helpful.',
        debug: 'You are a debugging expert. Analyze errors systematically. Ask clarifying questions if needed.',
        agent: 'You are a coding agent with access to GitHub repositories via tools. When asked about code, USE your tools to read the actual files — never guess. When asked to fix or change code, read the file first with read_file, then propose an edit with edit_file. Be concise. Show brief reasoning before acting.',
    },

    AGENT_TOOLS: [
        {
            type: 'function',
            function: {
                name: 'read_file',
                description: 'Read a file from a GitHub repository. Returns the file content.',
                parameters: {
                    type: 'object',
                    properties: {
                        owner: { type: 'string', description: 'Repository owner (GitHub username)' },
                        repo: { type: 'string', description: 'Repository name' },
                        path: { type: 'string', description: 'File path in the repository' },
                    },
                    required: ['owner', 'repo', 'path'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'list_files',
                description: 'List files and directories at a path in a GitHub repository.',
                parameters: {
                    type: 'object',
                    properties: {
                        owner: { type: 'string', description: 'Repository owner' },
                        repo: { type: 'string', description: 'Repository name' },
                        path: { type: 'string', description: 'Directory path (empty string for root)' },
                    },
                    required: ['owner', 'repo'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'edit_file',
                description: 'Propose an edit to a file. The user sees a diff and must approve before the commit happens. Provide the complete new file content.',
                parameters: {
                    type: 'object',
                    properties: {
                        owner: { type: 'string', description: 'Repository owner' },
                        repo: { type: 'string', description: 'Repository name' },
                        path: { type: 'string', description: 'File path' },
                        new_content: { type: 'string', description: 'The complete new file content' },
                        commit_message: { type: 'string', description: 'Commit message describing the change' },
                    },
                    required: ['owner', 'repo', 'path', 'new_content', 'commit_message'],
                },
            },
        },
    ],

    _geminiToolDeclarations() {
        return this.AGENT_TOOLS.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: this._toGeminiSchema(t.function.parameters),
        }));
    },

    _toGeminiSchema(schema) {
        const typeMap = { string: 'STRING', number: 'NUMBER', integer: 'INTEGER', object: 'OBJECT', array: 'ARRAY', boolean: 'BOOLEAN' };
        const result = { type: typeMap[schema.type] || schema.type };
        if (schema.description) result.description = schema.description;
        if (schema.properties) {
            result.properties = {};
            for (const [k, v] of Object.entries(schema.properties)) {
                result.properties[k] = this._toGeminiSchema(v);
            }
        }
        if (schema.required) result.required = schema.required;
        return result;
    },

    async _executeTool(name, args) {
        if (!GitHub.isConnected()) return 'Error: GitHub not connected';
        switch (name) {
            case 'read_file': {
                const file = await GitHub.getFileContent(args.owner, args.repo, args.path);
                if (typeof file.content !== 'string') return `Error: ${args.path} is not a regular file`;
                return `File: ${args.path} (${file.content.length} chars)\n\n${file.content}`;
            }
            case 'list_files': {
                const items = await GitHub.getContents(args.owner, args.repo, args.path || '');
                const list = Array.isArray(items) ? items : [items];
                return list.map(i => `${i.type === 'dir' ? '📁' : '📄'} ${i.name}${i.size ? ` (${i.size}B)` : ''}`).join('\n');
            }
            case 'edit_file': {
                const file = await GitHub.getFileContent(args.owner, args.repo, args.path);
                if (typeof file.content !== 'string') return `Error: ${args.path} is not a regular file — cannot edit`;
                const editId = Date.now();
                pendingEdits.update(list => [...list, {
                    id: editId,
                    owner: args.owner,
                    repo: args.repo,
                    path: args.path,
                    oldContent: file.content,
                    newContent: args.new_content,
                    sha: file.sha,
                    message: args.commit_message,
                    status: 'pending',
                }]);
                return `Edit proposed for ${args.path}. Diff shown to user for approval. (edit_id: ${editId})`;
            }
            default:
                return `Unknown tool: ${name}`;
        }
    },

    async sendAgentic(userMessage, onProgress) {
        if (!this._key) throw new Error('API key not set');
        const p = this.PROVIDERS[this._provider];

        const ctx = get(repoContext);
        const contextHint = (ctx.owner && ctx.repo)
            ? `\nThe user is currently browsing: ${ctx.owner}/${ctx.repo}${ctx.path ? ` at path: ${ctx.path}` : ''}`
            : '';

        const workingMessages = [{ role: 'user', content: userMessage }];
        const history = this._messages.slice(-16).filter(m => m.role === 'user' || (m.role === 'assistant' && m.content));

        this._messages.push({ role: 'user', content: userMessage });

        let iterations = 0;
        try {
            while (iterations++ < 10) {
                onProgress('thinking', null);
                let response;
                if (p.isGemini) {
                    response = await this._agentCallGemini(history, workingMessages, contextHint);
                } else {
                    response = await this._agentCallOpenAI(history, workingMessages, contextHint, p);
                }

                if (response.tool_calls && response.tool_calls.length > 0) {
                    workingMessages.push({ role: 'assistant', content: response.content || null, tool_calls: response.tool_calls });
                    for (const tc of response.tool_calls) {
                        const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
                        onProgress('tool_call', { name: tc.name, args });
                        let result;
                        try {
                            result = await this._executeTool(tc.name, args);
                        } catch (e) {
                            result = 'Error: ' + e.message;
                        }
                        onProgress('tool_result', { name: tc.name, result: typeof result === 'string' ? result.slice(0, 500) : result });
                        workingMessages.push({ role: 'tool', tool_call_id: tc.id, name: tc.name, content: typeof result === 'string' ? result : JSON.stringify(result) });
                    }
                } else {
                    const text = response.content || '';
                    if (!text) throw new Error('Empty agent response');
                    this._messages.push({ role: 'assistant', content: text });
                    await Storage.setJSON('chat_history', this._messages);
                    return text;
                }
            }
            throw new Error('Agent reached max tool iterations (10)');
        } catch (e) {
            this._messages.pop();
            throw e;
        }
    },

    async _agentCallOpenAI(history, workingMessages, contextHint, provider) {
        const sysContent = this.SYSTEM_PROMPTS.agent + contextHint;
        const messages = [
            { role: 'system', content: sysContent },
            ...history,
            ...workingMessages.map(m => {
                if (m.role === 'tool') return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content };
                if (m.role === 'assistant' && m.tool_calls) return {
                    role: 'assistant', content: m.content,
                    tool_calls: m.tool_calls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments) } })),
                };
                return { role: m.role, content: m.content };
            }),
        ];
        const body = { model: this._model, messages, tools: this.AGENT_TOOLS, temperature: 0.3, max_tokens: 4096 };
        const res = await fetch(provider.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this._key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const msg = data.choices[0].message;
        if (msg.tool_calls) {
            return {
                content: msg.content,
                tool_calls: msg.tool_calls.map(tc => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })),
            };
        }
        return { content: msg.content, tool_calls: null };
    },

    async _agentCallGemini(history, workingMessages, contextHint) {
        const sysContent = this.SYSTEM_PROMPTS.agent + contextHint;
        const contents = [];
        for (const m of [...history, ...workingMessages]) {
            if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.content }] });
            else if (m.role === 'assistant' && m.tool_calls) {
                contents.push({ role: 'model', parts: m.tool_calls.map(tc => ({
                    functionCall: { name: tc.name, args: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments }
                })) });
            }
            else if (m.role === 'assistant') contents.push({ role: 'model', parts: [{ text: m.content }] });
            else if (m.role === 'tool') contents.push({ role: 'user', parts: [{ functionResponse: { name: m.name, response: { content: m.content } } }] });
        }
        const body = {
            system_instruction: { parts: [{ text: sysContent }] },
            contents,
            tools: [{ functionDeclarations: this._geminiToolDeclarations() }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        };
        const url = `${this.PROVIDERS.gemini.baseUrl}/models/${this._model}:generateContent?key=${this._key}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const candidate = data.candidates?.[0];
        if (!candidate?.content?.parts?.length) throw new Error('Gemini: response blocked by safety filter');
        const parts = candidate.content.parts;
        const functionCalls = parts.filter(p => p.functionCall);
        if (functionCalls.length > 0) {
            return {
                content: parts.find(p => p.text)?.text || null,
                tool_calls: functionCalls.map((p, i) => ({ id: 'gemini_' + i, name: p.functionCall.name, arguments: p.functionCall.args })),
            };
        }
        return { content: parts.map(p => p.text).filter(Boolean).join(''), tool_calls: null };
    },

    async init() {
        const provider = await Storage.get('ai_provider');
        if (provider && this.PROVIDERS[provider]) this._provider = provider;

        const p = this.PROVIDERS[this._provider];
        this._key = await Storage.get(p.keyName);

        if (this._provider === 'custom') {
            const baseUrl = await Storage.get('custom_base_url');
            if (baseUrl) this.PROVIDERS.custom.baseUrl = baseUrl;
        }

        const model = await Storage.get('ai_model');
        if (model) this._model = model;
        const history = await Storage.getJSON('chat_history');
        if (history) this._messages = history;
    },

    isConnected() { return !!this._key; },

    getProviderModels() { return this.MODELS[this._provider] || []; },

    getModel() {
        const models = this.getProviderModels();
        return models.find(m => m.id === this._model) || models[0] || { id: this._model, name: this._model, ctx: '?' };
    },

    async setProvider(providerId) {
        if (!this.PROVIDERS[providerId]) return;
        this._provider = providerId;
        await Storage.set('ai_provider', providerId);
        const p = this.PROVIDERS[providerId];
        this._key = await Storage.get(p.keyName);
        const models = this.getProviderModels();
        if (models.length && !models.find(m => m.id === this._model)) {
            this._model = models[0].id;
            await Storage.set('ai_model', this._model);
        }
    },

    async setKey(key) {
        this._key = key;
        const p = this.PROVIDERS[this._provider];
        await Storage.set(p.keyName, key);
    },

    async clearKey() {
        this._key = null;
        const p = this.PROVIDERS[this._provider];
        await Storage.delete(p.keyName);
    },

    async setCustomBaseUrl(url) {
        this.PROVIDERS.custom.baseUrl = url;
        await Storage.set('custom_base_url', url);
    },

    async setModel(modelId) {
        this._model = modelId;
        await Storage.set('ai_model', modelId);
    },

    async clearHistory() {
        this._messages = [];
        await Storage.delete('chat_history');
    },

    _buildOpenAIBody(systemPrompt, stream) {
        const sysPrompt = this.SYSTEM_PROMPTS[systemPrompt] || this.SYSTEM_PROMPTS.default;
        return {
            model: this._model,
            messages: [
                { role: 'system', content: sysPrompt },
                ...this._messages.slice(-20),
            ],
            temperature: 0.7,
            max_tokens: 4096,
            stream,
        };
    },

    _buildGeminiBody(systemPrompt) {
        const sysPrompt = this.SYSTEM_PROMPTS[systemPrompt] || this.SYSTEM_PROMPTS.default;
        const contents = [];
        for (const msg of this._messages.slice(-20)) {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            });
        }
        return {
            system_instruction: { parts: [{ text: sysPrompt }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        };
    },

    async send(userMessage, systemPrompt = 'default') {
        if (!this._key) throw new Error('API key not set');
        const p = this.PROVIDERS[this._provider];

        this._messages.push({ role: 'user', content: userMessage });

        try {
            let reply;
            if (p.isGemini) {
                reply = await this._sendGemini(systemPrompt);
            } else {
                reply = await this._sendOpenAI(systemPrompt);
            }
            this._messages.push({ role: 'assistant', content: reply });
            await Storage.setJSON('chat_history', this._messages);
            return { content: reply };
        } catch (e) {
            this._messages.pop();
            throw e;
        }
    },

    async _sendOpenAI(systemPrompt) {
        const p = this.PROVIDERS[this._provider];
        const body = this._buildOpenAIBody(systemPrompt, false);
        const res = await fetch(p.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this._key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${p.name} ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.choices[0].message.content;
    },

    async _sendGemini(systemPrompt) {
        const body = this._buildGeminiBody(systemPrompt);
        const url = `${this.PROVIDERS.gemini.baseUrl}/models/${this._model}:generateContent?key=${this._key}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const candidate = data.candidates?.[0];
        if (!candidate?.content?.parts?.[0]?.text) throw new Error('Gemini: response blocked by safety filter');
        return candidate.content.parts[0].text;
    },

    async sendStream(userMessage, onChunk, systemPrompt = 'default') {
        if (!this._key) throw new Error('API key not set');
        const p = this.PROVIDERS[this._provider];

        this._messages.push({ role: 'user', content: userMessage });

        try {
            let fullReply;
            if (p.isGemini) {
                fullReply = await this._streamGemini(onChunk, systemPrompt);
            } else {
                fullReply = await this._streamOpenAI(onChunk, systemPrompt);
            }
            if (!fullReply) throw new Error('Empty response — may be blocked by content filter');
            this._messages.push({ role: 'assistant', content: fullReply });
            await Storage.setJSON('chat_history', this._messages);
            return fullReply;
        } catch (e) {
            this._messages.pop();
            throw e;
        }
    },

    async _streamOpenAI(onChunk, systemPrompt) {
        const p = this.PROVIDERS[this._provider];
        const body = this._buildOpenAIBody(systemPrompt, true);
        const res = await fetch(p.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this._key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${p.name} ${res.status}: ${await res.text()}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') break;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices[0]?.delta?.content;
                    if (delta) { fullReply += delta; onChunk(delta, fullReply); }
                } catch {}
            }
        }
        return fullReply;
    },

    async _streamGemini(onChunk, systemPrompt) {
        const body = this._buildGeminiBody(systemPrompt);
        const url = `${this.PROVIDERS.gemini.baseUrl}/models/${this._model}:streamGenerateContent?alt=sse&key=${this._key}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                try {
                    const parsed = JSON.parse(data);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) { fullReply += text; onChunk(text, fullReply); }
                } catch {}
            }
        }
        return fullReply;
    },
};

export default AI;
