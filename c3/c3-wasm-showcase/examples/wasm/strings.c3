/**
 * String operations validation for wasm32 target.
 * Tests that C3's string handling works correctly on WASM.
 *
 * Compile: c3c compile --target wasm32 strings.c3
 * Run:     wasmtime run strings.wasm
 */
module strings;

extern fn void wasi_fd_write(int fd, void* iovs, int iovs_len, int* nwritten) @extern("fd_write");

fn void print(char[] msg) {
    void*[2] iov;
    iov[0] = &msg[0];
    iov[1] = (void*)(usz)msg.len;
    int written;
    wasi_fd_write(1, &iov, 1, &written);
}

fn void main() {
    // Basic string literals
    print("Test 1: String literal\n");

    // String slicing
    char[] full = "Hello, World!";
    char[] hello = full[0..5];
    print("Test 2: Slice = ");
    print(hello);
    print("\n");

    // String length
    char[] test = "ABCDEF";
    if (test.len == 6) {
        print("Test 3: Length correct\n");
    } else {
        print("Test 3: FAIL - wrong length\n");
    }

    // String comparison
    char[] a = "abc";
    char[] b = "abc";
    if (a == b) {
        print("Test 4: Equality works\n");
    } else {
        print("Test 4: FAIL - equality broken\n");
    }

    // Byte access
    char[] digits = "0123456789";
    if (digits[0] == '0' && digits[9] == '9') {
        print("Test 5: Byte access works\n");
    } else {
        print("Test 5: FAIL - byte access broken\n");
    }

    print("All string tests complete.\n");
}
