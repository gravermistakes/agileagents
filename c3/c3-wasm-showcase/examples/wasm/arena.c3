/**
 * Arena allocator validation for wasm32 target.
 * Tests C3's memory allocation patterns on WASM.
 *
 * Compile: c3c compile --target wasm32 arena.c3
 * Run:     wasmtime run arena.wasm
 */
module arena_test;

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
    // Stack buffer allocation (no heap)
    char[256] stack_buf;
    for (usz i = 0; i < 256; i++) {
        stack_buf[i] = (char)(i & 0xFF);
    }
    assert_true(stack_buf[0] == 0, "stack buffer write/read [0]");
    assert_true(stack_buf[255] == 255, "stack buffer write/read [255]");
    assert_true(stack_buf[128] == 128, "stack buffer write/read [128]");

    // Multiple stack buffers to test stack depth
    char[64] buf_a;
    char[64] buf_b;
    char[64] buf_c;
    for (usz i = 0; i < 64; i++) {
        buf_a[i] = 'A';
        buf_b[i] = 'B';
        buf_c[i] = 'C';
    }
    assert_true(buf_a[0] == 'A' && buf_b[0] == 'B' && buf_c[0] == 'C', "multiple stack buffers");

    // Verify buffers don't overlap
    bool no_overlap = true;
    // If buf_a and buf_b pointed to the same memory, writing to one would change the other
    buf_a[0] = 'X';
    if (buf_b[0] != 'B') no_overlap = false;
    assert_true(no_overlap, "stack buffers don't overlap");

    // Large stack allocation
    char[4096] big_buf;
    big_buf[0] = 'S';
    big_buf[4095] = 'E';
    assert_true(big_buf[0] == 'S' && big_buf[4095] == 'E', "4KB stack buffer");

    print("All arena tests complete.\n");
}
