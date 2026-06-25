/**
 * Generic WASM module loader for C3-compiled binaries.
 * Works in browsers and Node.js.
 *
 * Usage:
 *   const instance = await loadC3Wasm('hello.wasm');
 *   instance.exports.main();
 *
 * AI Disclosure: AI-assisted. Reviewed and owned by contributor.
 */

const WASI_ESUCCESS = 0;
const WASI_EBADF = 8;
const WASI_ENOSYS = 52;

function createWasiImports(memory, outputCallback) {
    const decoder = new TextDecoder();
    const output = outputCallback || console.log;

    return {
        fd_write(fd, iovs_ptr, iovs_len, nwritten_ptr) {
            if (fd !== 1 && fd !== 2) return WASI_EBADF;

            const mem = new DataView(memory.buffer);
            let totalWritten = 0;

            for (let i = 0; i < iovs_len; i++) {
                const base = iovs_ptr + i * 8;
                const ptr = mem.getUint32(base, true);
                const len = mem.getUint32(base + 4, true);
                const bytes = new Uint8Array(memory.buffer, ptr, len);
                output(decoder.decode(bytes));
                totalWritten += len;
            }

            mem.setUint32(nwritten_ptr, totalWritten, true);
            return WASI_ESUCCESS;
        },

        fd_read() { return WASI_ENOSYS; },
        fd_close() { return WASI_ESUCCESS; },
        fd_seek() { return WASI_ENOSYS; },
        fd_fdstat_get() { return WASI_ENOSYS; },

        proc_exit(code) {
            if (code !== 0) {
                throw new Error(`Process exited with code ${code}`);
            }
        },

        environ_sizes_get(count_ptr, buf_size_ptr) {
            const mem = new DataView(memory.buffer);
            mem.setUint32(count_ptr, 0, true);
            mem.setUint32(buf_size_ptr, 0, true);
            return WASI_ESUCCESS;
        },

        environ_get() { return WASI_ESUCCESS; },

        args_sizes_get(argc_ptr, argv_buf_size_ptr) {
            const mem = new DataView(memory.buffer);
            mem.setUint32(argc_ptr, 0, true);
            mem.setUint32(argv_buf_size_ptr, 0, true);
            return WASI_ESUCCESS;
        },

        args_get() { return WASI_ESUCCESS; },

        clock_time_get(clock_id, precision, time_ptr) {
            const mem = new DataView(memory.buffer);
            const now = BigInt(Date.now()) * 1000000n; // ms to ns
            mem.setBigUint64(time_ptr, now, true);
            return WASI_ESUCCESS;
        },

        random_get(buf_ptr, buf_len) {
            const bytes = new Uint8Array(memory.buffer, buf_ptr, buf_len);
            crypto.getRandomValues(bytes);
            return WASI_ESUCCESS;
        },
    };
}

async function loadC3Wasm(wasmPath, options = {}) {
    const memory = new WebAssembly.Memory({
        initial: options.initialPages || 16,
        maximum: options.maxPages || 256,
    });

    const wasiImports = createWasiImports(memory, options.output);

    const importObject = {
        wasi_snapshot_preview1: wasiImports,
        env: {
            memory,
            ...(options.imports || {}),
        },
    };

    let wasmModule;
    if (typeof fetch === 'function') {
        // Browser
        const response = await fetch(wasmPath);
        const bytes = await response.arrayBuffer();
        wasmModule = await WebAssembly.instantiate(bytes, importObject);
    } else {
        // Node.js
        const fs = await import('fs');
        const bytes = fs.readFileSync(wasmPath);
        wasmModule = await WebAssembly.instantiate(bytes, importObject);
    }

    return wasmModule.instance;
}

// Export for both ESM and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadC3Wasm, createWasiImports };
}
if (typeof globalThis !== 'undefined') {
    globalThis.loadC3Wasm = loadC3Wasm;
}
