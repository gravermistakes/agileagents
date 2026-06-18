/**
 * Streaming JSON parser on wasm32 target.
 * Demonstrates zero-allocation JSON parsing on WASM.
 *
 * Compile: c3c compile --target wasm32 json_stream.c3
 * Run:     wasmtime run json_stream.wasm
 */
module json_stream_wasm;

import std::encoding::json_stream;

extern fn void wasi_fd_write(int fd, void* iovs, int iovs_len, int* nwritten) @extern("fd_write");

fn void print(char[] msg) {
    void*[2] iov;
    iov[0] = &msg[0];
    iov[1] = (void*)(usz)msg.len;
    int written;
    wasi_fd_write(1, &iov, 1, &written);
}

fn void print_event_type(json_stream::EventType t) {
    switch (t) {
        json_stream::EventType.OBJECT_START: print("{"),
        json_stream::EventType.OBJECT_END: print("}"),
        json_stream::EventType.ARRAY_START: print("["),
        json_stream::EventType.ARRAY_END: print("]"),
        json_stream::EventType.KEY: print("KEY"),
        json_stream::EventType.STRING: print("STR"),
        json_stream::EventType.NUMBER: print("NUM"),
        json_stream::EventType.BOOL_TRUE: print("TRUE"),
        json_stream::EventType.BOOL_FALSE: print("FALSE"),
        json_stream::EventType.NULL_VALUE: print("NULL"),
    }
}

fn void main() {
    String input = `{
        "name": "C3 WASM Test",
        "version": 0.8,
        "features": ["json", "wasm", "streaming"],
        "metadata": {
            "author": "test",
            "stable": false,
            "count": null
        }
    }`;

    print("Streaming parse events:\n");

    json_stream::StreamParser parser = json_stream::init(input);
    usz event_count = 0;

    while (parser.has_next()) {
        json_stream::Event! ev = parser.next();
        if (catch ev) break;

        // Print indentation based on depth
        for (usz i = 0; i < ev.depth; i++) {
            print("  ");
        }

        print_event_type(ev.type);
        if (ev.value.len > 0) {
            print(": ");
            print(ev.value);
        }
        print("\n");
        event_count++;
    }

    print("Total events: ");
    // Simple digit printing (no printf in freestanding WASM)
    if (event_count < 10) {
        char[1] digit;
        digit[0] = (char)('0' + event_count);
        print(digit[0..1]);
    } else {
        char[2] digits;
        digits[0] = (char)('0' + event_count / 10);
        digits[1] = (char)('0' + event_count % 10);
        print(digits[0..2]);
    }
    print("\n");

    print("Stream parse WASM test complete.\n");
}
