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

    isConnected() {
        return !!this._key;
    },

    getProviderModels() {
        return this.MODELS[this._provider] || [];
    },

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

    _buildOpenAIBody(userMessage, systemPrompt, stream) {
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

    _buildGeminiBody(userMessage, systemPrompt) {
        const sysPrompt = this.SYSTEM_PROMPTS[systemPrompt] || this.SYSTEM_PROMPTS.default;
        const contents = [];
        const history = this._messages.slice(-20);
        for (const msg of history) {
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
                reply = await this._sendGemini(userMessage, systemPrompt);
            } else {
                reply = await this._sendOpenAI(userMessage, systemPrompt);
            }
            this._messages.push({ role: 'assistant', content: reply });
            await Storage.setJSON('chat_history', this._messages);
            return { content: reply };
        } catch (e) {
            this._messages.pop();
            throw e;
        }
    },

    async _sendOpenAI(userMessage, systemPrompt) {
        const p = this.PROVIDERS[this._provider];
        const body = this._buildOpenAIBody(userMessage, systemPrompt, false);
        const res = await fetch(p.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`${p.name} ${res.status}: ${err}`);
        }
        const data = await res.json();
        return data.choices[0].message.content;
    },

    async _sendGemini(userMessage, systemPrompt) {
        const body = this._buildGeminiBody(userMessage, systemPrompt);
        const url = `${this.PROVIDERS.gemini.baseUrl}/models/${this._model}:generateContent?key=${this._key}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini ${res.status}: ${err}`);
        }
        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
    },

    async sendStream(userMessage, onChunk, systemPrompt = 'default') {
        if (!this._key) throw new Error('API key not set');
        const p = this.PROVIDERS[this._provider];

        this._messages.push({ role: 'user', content: userMessage });

        try {
            let fullReply;
            if (p.isGemini) {
                fullReply = await this._streamGemini(userMessage, onChunk, systemPrompt);
            } else {
                fullReply = await this._streamOpenAI(userMessage, onChunk, systemPrompt);
            }
            this._messages.push({ role: 'assistant', content: fullReply });
            await Storage.setJSON('chat_history', this._messages);
            return fullReply;
        } catch (e) {
            this._messages.pop();
            throw e;
        }
    },

    async _streamOpenAI(userMessage, onChunk, systemPrompt) {
        const p = this.PROVIDERS[this._provider];
        const body = this._buildOpenAIBody(userMessage, systemPrompt, true);
        const res = await fetch(p.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`${p.name} ${res.status}: ${err}`);
        }

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
                    if (delta) {
                        fullReply += delta;
                        onChunk(delta, fullReply);
                    }
                } catch {}
            }
        }
        return fullReply;
    },

    async _streamGemini(userMessage, onChunk, systemPrompt) {
        const body = this._buildGeminiBody(userMessage, systemPrompt);
        const url = `${this.PROVIDERS.gemini.baseUrl}/models/${this._model}:streamGenerateContent?alt=sse&key=${this._key}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini ${res.status}: ${err}`);
        }

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
                    if (text) {
                        fullReply += text;
                        onChunk(text, fullReply);
                    }
                } catch {}
            }
        }
        return fullReply;
    },
};
