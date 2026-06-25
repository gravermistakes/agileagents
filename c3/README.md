# C3 Language Contributions

Standalone incubation projects for [C3](https://c3-lang.org/) contributions, following the
[C3 contributing guidelines](https://github.com/c3lang/c3c/blob/master/CONTRIBUTING.md).

## Projects

### c3-json-extras

JSON enhancements for C3's standard library:

- **Streaming/SAX parser** (`json_stream.c3`) — Event-driven JSON parsing without DOM allocation.
  Zero-allocation design suitable for memory-constrained targets including WASM.
- **JSON Pointer** (`json_pointer.c3`) — RFC 6901 path-based access into parsed JSON objects.

### c3-wasm-showcase

Reference WASM examples and CI validation for C3's wasm32 target:

- Freestanding WASM examples (WASI)
- Emscripten browser examples
- JS glue code templates
- GitHub Actions CI workflow for WASM validation

## AI Disclosure

Per C3's contributing guidelines: portions of this code were generated with AI assistance
(Claude by Anthropic). All code has been reviewed, understood, and can be explained by
the contributor. The contributor takes full ownership and responsibility for all submitted code.

## Building

Requires C3 compiler v0.8.1+.

```bash
# JSON extras
cd c3-json-extras
c3c build
c3c test

# WASM showcase
cd c3-wasm-showcase
c3c compile --target wasm32 examples/wasm/hello.c3
wasmtime run hello.wasm
```

## License

MIT License — matching C3's license.
