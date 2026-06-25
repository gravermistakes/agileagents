/**
 * JSON DOM parsing on wasm32 target.
 * Tests that C3's std::encoding::json works correctly on WASM.
 *
 * Compile: c3c compile --target wasm32 json_parse.c3
 * Run:     wasmtime run json_parse.wasm
 */
module json_parse_wasm;

import std::encoding::json;

extern fn void wasi_fd_write(int fd, void* iovs, int iovs_len, int* nwritten) @extern("fd_write");

fn void print(char[] msg) {
    void*[2] iov;
    iov[0] = &msg[0];
    iov[1] = (void*)(usz)msg.len;
    int written;
    wasi_fd_write(1, &iov, 1, &written);
}

fn void assert_true(bool cond, char[] label) {
    if (cond) {
        print("PASS: ");
    } else {
        print("FAIL: ");
    }
    print(label);
    print("\n");
}

fn void main() {
    // Simple object parsing
    String simple = `{"name": "C3", "version": 0.8}`;
    json::Object*! obj = json::parse(std::heap::allocator(), simple);
    if (catch obj) {
        print("FAIL: Could not parse simple object\n");
        return;
    }
    defer obj.free();
    print("PASS: simple object parsed\n");

    // Array parsing
    String arr_json = `[1, 2, 3, "four", true, null]`;
    json::Object*! arr = json::parse(std::heap::allocator(), arr_json);
    if (catch arr) {
        print("FAIL: Could not parse array\n");
        return;
    }
    defer arr.free();
    print("PASS: array parsed\n");

    // Nested structure
    String nested = `{"users": [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]}`;
    json::Object*! nest = json::parse(std::heap::allocator(), nested);
    if (catch nest) {
        print("FAIL: Could not parse nested structure\n");
        return;
    }
    defer nest.free();
    print("PASS: nested structure parsed\n");

    // Empty structures
    json::Object*! empty_obj = json::parse(std::heap::allocator(), "{}");
    if (catch empty_obj) {
        print("FAIL: Could not parse empty object\n");
        return;
    }
    defer empty_obj.free();
    print("PASS: empty object parsed\n");

    json::Object*! empty_arr = json::parse(std::heap::allocator(), "[]");
    if (catch empty_arr) {
        print("FAIL: Could not parse empty array\n");
        return;
    }
    defer empty_arr.free();
    print("PASS: empty array parsed\n");

    // String with escapes
    String escaped = `{"msg": "hello \"world\"\nline 2"}`;
    json::Object*! esc = json::parse(std::heap::allocator(), escaped);
    if (catch esc) {
        print("FAIL: Could not parse escaped strings\n");
        return;
    }
    defer esc.free();
    print("PASS: escaped strings parsed\n");

    // Numbers
    String nums = `{"int": 42, "neg": -7, "float": 3.14, "exp": 1e10}`;
    json::Object*! num_obj = json::parse(std::heap::allocator(), nums);
    if (catch num_obj) {
        print("FAIL: Could not parse numbers\n");
        return;
    }
    defer num_obj.free();
    print("PASS: numbers parsed\n");

    print("All JSON parse WASM tests complete.\n");
}
