# C3 WASM Support Status

**Compiler version**: C3 v0.8.1 (June 2026)
**Last updated**: 2026-06-18

## Summary

C3 has functional but experimental WebAssembly support. The compiler can target
both wasm32 and wasm64 architectures. Emscripten support was added in v0.8.0.

## What Works

- Direct wasm32/wasm64 compilation (`c3c compile --target wasm32`)
- `@wasm` attribute for WASM module imports
- Emscripten toolchain integration (`--target wasm32 --emscripten`)
- Basic integer and float arithmetic
- Stack-allocated buffers and arrays
- String literals and slicing
- Simple function calls and control flow

## Known Limitations

- **Standard library is NOT usable in WASM** — most stdlib functions assume
  native OS capabilities (file I/O, networking, etc.)
- **Memory overallocation** — WASM memory can overallocate unnecessarily
  (known issue in the allocator)
- **No wasm-bindgen equivalent** — JS interop requires manual glue code
- **Limited WASI support** — basic fd_write works, but complex WASI
  operations may not
- **Freestanding by default** — wasm32/wasm64 are treated as freestanding
  targets, not hosted

## Test Matrix

| Example | Freestanding | WASI (wasmtime) | Emscripten | Notes |
|---------|:---:|:---:|:---:|-------|
| hello.c3 | ? | ? | N/A | WASI fd_write for stdout |
| strings.c3 | ? | ? | N/A | String ops validation |
| math.c3 | ? | ? | N/A | Arithmetic codegen |
| arena.c3 | ? | ? | N/A | Stack allocation |
| json_parse.c3 | ? | ? | N/A | Requires heap allocator |
| json_stream.c3 | ? | ? | N/A | Zero-allocation path |
| emscripten/app.c3 | N/A | N/A | ? | Browser canvas |

Legend: ? = untested (fill in after running), PASS, FAIL, PARTIAL

## Community Projects

- [c3_wasm](https://github.com/search?q=c3+wasm) — Raylib on WASM with C3
- [c3-wasm-check](https://github.com/search?q=c3-wasm-check) — WASM validation

## Upstream Issues

Search `is:issue wasm` on https://github.com/c3lang/c3c/issues for current
WASM-related bug reports and feature requests.

## Recommendations for Contributors

1. **Use freestanding builds** unless you specifically need WASI or Emscripten
2. **Avoid stdlib I/O** — use direct WASI calls via `extern fn` instead
3. **Prefer stack allocation** — heap allocation behavior may vary
4. **Test with wasmtime** — it has the best WASI support for validation
5. **Report issues upstream** — the C3 team is responsive to WASM bug reports
