/**
 * Minimal WASI shim for running C3 WASM in browsers.
 *
 * Implements just enough of WASI snapshot_preview1 to run
 * basic C3 programs that use stdout. For full WASI support,
 * use wasmtime or wasmer instead.
 *
 * Usage:
 *   <script src="wasi-shim.js"></script>
 *   <script src="loader.js"></script>
 *   <script>
 *     loadC3Wasm('hello.wasm', {
 *       output: (text) => document.getElementById('out').textContent += text
 *     }).then(instance => instance.exports._start());
 *   </script>
 */

class WasiShim {
    constructor(options = {}) {
        this.outputBuffer = '';
        this.outputCallback = options.output || ((text) => {
            this.outputBuffer += text;
            console.log(text);
        });
        this.memory = null;
    }

    setMemory(memory) {
        this.memory = memory;
    }

    getImports() {
        return {
            wasi_snapshot_preview1: {
                fd_write: this._fd_write.bind(this),
                fd_read: () => 52,
                fd_close: () => 0,
                fd_seek: () => 52,
                fd_fdstat_get: () => 52,
                fd_prestat_get: () => 8,
                fd_prestat_dir_name: () => 8,
                proc_exit: this._proc_exit.bind(this),
                environ_sizes_get: this._environ_sizes_get.bind(this),
                environ_get: () => 0,
                args_sizes_get: this._args_sizes_get.bind(this),
                args_get: () => 0,
                clock_time_get: this._clock_time_get.bind(this),
                random_get: this._random_get.bind(this),
                path_open: () => 52,
                path_filestat_get: () => 52,
            },
        };
    }

    _fd_write(fd, iovs_ptr, iovs_len, nwritten_ptr) {
        if (!this.memory) return 8;
        if (fd !== 1 && fd !== 2) return 8;

        const mem = new DataView(this.memory.buffer);
        const decoder = new TextDecoder();
        let totalWritten = 0;

        for (let i = 0; i < iovs_len; i++) {
            const base = iovs_ptr + i * 8;
            const ptr = mem.getUint32(base, true);
            const len = mem.getUint32(base + 4, true);
            const bytes = new Uint8Array(this.memory.buffer, ptr, len);
            this.outputCallback(decoder.decode(bytes));
            totalWritten += len;
        }

        mem.setUint32(nwritten_ptr, totalWritten, true);
        return 0;
    }

    _proc_exit(code) {
        if (code !== 0) {
            throw new Error(`WASI proc_exit: ${code}`);
        }
    }

    _environ_sizes_get(count_ptr, buf_size_ptr) {
        const mem = new DataView(this.memory.buffer);
        mem.setUint32(count_ptr, 0, true);
        mem.setUint32(buf_size_ptr, 0, true);
        return 0;
    }

    _args_sizes_get(argc_ptr, argv_buf_size_ptr) {
        const mem = new DataView(this.memory.buffer);
        mem.setUint32(argc_ptr, 0, true);
        mem.setUint32(argv_buf_size_ptr, 0, true);
        return 0;
    }

    _clock_time_get(clock_id, precision, time_ptr) {
        const mem = new DataView(this.memory.buffer);
        const now = BigInt(Date.now()) * 1000000n;
        mem.setBigUint64(time_ptr, now, true);
        return 0;
    }

    _random_get(buf_ptr, buf_len) {
        const bytes = new Uint8Array(this.memory.buffer, buf_ptr, buf_len);
        crypto.getRandomValues(bytes);
        return 0;
    }

    getOutput() {
        return this.outputBuffer;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WasiShim };
}
if (typeof globalThis !== 'undefined') {
    globalThis.WasiShim = WasiShim;
}
