/**
 * Minimal WASI hello world in C3.
 * Compile: c3c compile --target wasm32 hello.c3
 * Run:     wasmtime run hello.wasm
 */
module hello;

extern fn void wasi_fd_write(int fd, void* iovs, int iovs_len, int* nwritten) @extern("fd_write");

fn void main() {
    char[] msg = "Hello from C3 on WASM!\n";

    // WASI iovec: pointer + length
    void*[2] iov;
    iov[0] = &msg[0];
    iov[1] = (void*)(usz)msg.len;

    int written;
    wasi_fd_write(1, &iov, 1, &written); // fd 1 = stdout
}
