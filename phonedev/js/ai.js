const AI = {
    _key: null,
    _model: 'llama-3.3-70b-versatile',
    _messages: [],

    MODELS: [
        { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B', ctx: '128k' },
        { id: 'llama-4-maverick-17b-128e-instruct', name: 'LLaMA 4 Maverick', ctx: '128k' },
        { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'LLaMA 4 Scout', ctx: '512k' },
        { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', ctx: '128k' },
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', ctx: '128k' },
    ],

    SYSTEM_PROMPTS: {
        default: 'You are a helpful coding assistant. Be concise. Use code blocks with language tags.',
        review: 'You are a code reviewer. Point out bugs, security issues, and improvements. Be direct.',
        explain: 'You explain code clearly and concisely. Use examples when helpful.',
        debug: 'You are a debugging expert. Analyze errors systematically. Ask clarifying questions if needed.',
    },

    async init() {
        this._key = await Storage.get('groq_key');
        const model = await Storage.get('ai_model');
        if (model) this._model = model;
        const history = await Storage.getJSON('chat_history');
        if (history) this._messages = history;
    },

    isConnected() {
        return !!this._key;
    },

    async setKey(key) {
        this._key = key;
        await Storage.set('groq_key', key);
    },

    async clearKey() {
        this._key = null;
        await Storage.delete('groq_key');
    },

    async setModel(modelId) {
        this._model = modelId;
        await Storage.set('ai_model', modelId);
    },

    getModel() {
        return this.MODELS.find(m => m.id === this._model) || this.MODELS[0];
    },

    clearHistory() {
        this._messages = [];
        Storage.delete('chat_history');
    },

    async send(userMessage, systemPrompt = 'default') {
        if (!this._key) throw new Error('Groq API key not set');

        this._messages.push({ role: 'user', content: userMessage });

        const sysPrompt = this.SYSTEM_PROMPTS[systemPrompt] || this.SYSTEM_PROMPTS.default;

        const body = {
            model: this._model,
            messages: [
                { role: 'system', content: sysPrompt },
                ...this._messages.slice(-20), // keep last 20 messages for context
            ],
            temperature: 0.7,
            max_tokens: 4096,
            stream: false,
        };

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            this._messages.pop(); // remove failed user message
            throw new Error(`Groq ${res.status}: ${err}`);
        }

        const data = await res.json();
        const reply = data.choices[0].message.content;

        this._messages.push({ role: 'assistant', content: reply });
        await Storage.setJSON('chat_history', this._messages);

        return {
            content: reply,
            model: data.model,
            usage: data.usage,
        };
    },

    async sendStream(userMessage, onChunk, systemPrompt = 'default') {
        if (!this._key) throw new Error('Groq API key not set');

        this._messages.push({ role: 'user', content: userMessage });

        const sysPrompt = this.SYSTEM_PROMPTS[systemPrompt] || this.SYSTEM_PROMPTS.default;

        const body = {
            model: this._model,
            messages: [
                { role: 'system', content: sysPrompt },
                ...this._messages.slice(-20),
            ],
            temperature: 0.7,
            max_tokens: 4096,
            stream: true,
        };

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            this._messages.pop();
            throw new Error(`Groq ${res.status}: ${err}`);
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

        this._messages.push({ role: 'assistant', content: fullReply });
        await Storage.setJSON('chat_history', this._messages);

        return fullReply;
    },
};
