/**
 * Math operations validation for wasm32 target.
 * Tests integer and float arithmetic codegen correctness.
 *
 * Compile: c3c compile --target wasm32 math.c3
 * Run:     wasmtime run math.wasm
 */
module math_test;

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
    // Integer arithmetic
    int a = 100;
    int b = 42;
    assert_true(a + b == 142, "int addition");
    assert_true(a - b == 58, "int subtraction");
    assert_true(a * b == 4200, "int multiplication");
    assert_true(a / b == 2, "int division");
    assert_true(a % b == 16, "int modulo");

    // Negative numbers
    int neg = -50;
    assert_true(neg + 50 == 0, "negative addition");
    assert_true(neg * -1 == 50, "negative multiplication");

    // Bitwise operations
    int x = 0xFF;
    int y = 0x0F;
    assert_true(x & y == 0x0F, "bitwise AND");
    assert_true(x | y == 0xFF, "bitwise OR");
    assert_true(x ^ y == 0xF0, "bitwise XOR");

    // Shifts
    int s = 1;
    assert_true(s << 4 == 16, "left shift");
    assert_true(16 >> 4 == 1, "right shift");

    // Float arithmetic
    double fa = 3.14;
    double fb = 2.0;
    double sum = fa + fb;
    assert_true(sum > 5.13 && sum < 5.15, "float addition");

    double product = fa * fb;
    assert_true(product > 6.27 && product < 6.29, "float multiplication");

    // Float edge cases
    double zero = 0.0;
    double one = 1.0;
    assert_true(one / one == 1.0, "float division by one");

    // Overflow (unsigned)
    uint max_u32 = 0xFFFFFFFF;
    assert_true(max_u32 + 1 == 0, "u32 overflow wraps");

    print("All math tests complete.\n");
}
