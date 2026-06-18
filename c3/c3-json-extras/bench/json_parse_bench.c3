/**
 * JSON parsing benchmark: DOM vs streaming parser.
 *
 * Measures parse time and allocation count for different JSON sizes.
 * Run: c3c build -t bench && ./bench
 */
module json_bench;

import std::encoding::json;
import std::encoding::json_stream;
import std::time;
import std::io;

const usz ITERATIONS = 1000;

// Small JSON (~100 bytes)
const String SMALL_JSON = `{"id": 1, "name": "test", "active": true, "score": 99.5}`;

// Medium JSON (~500 bytes)
const String MEDIUM_JSON = `{
    "users": [
        {"id": 1, "name": "alice", "email": "alice@example.com", "roles": ["admin", "user"]},
        {"id": 2, "name": "bob", "email": "bob@example.com", "roles": ["user"]},
        {"id": 3, "name": "carol", "email": "carol@example.com", "roles": ["user", "editor"]},
        {"id": 4, "name": "dave", "email": "dave@example.com", "roles": ["viewer"]}
    ],
    "meta": {"page": 1, "total": 4, "per_page": 20}
}`;

// Deeply nested JSON
const String NESTED_JSON = `{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":42}}}}}}}}}}`;

struct BenchResult {
    String name;
    long elapsed_ns;
    usz iterations;
}

fn BenchResult bench_dom_parse(String json, String label) {
    long start = time::clock_gettime_nsec(time::CLOCK_MONOTONIC);

    for (usz i = 0; i < ITERATIONS; i++) {
        json::Object*! obj = json::parse(std::heap::allocator(), json);
        if (try obj) {
            obj.free();
        }
    }

    long end = time::clock_gettime_nsec(time::CLOCK_MONOTONIC);
    return BenchResult {
        .name = label,
        .elapsed_ns = end - start,
        .iterations = ITERATIONS,
    };
}

fn BenchResult bench_stream_parse(String json, String label) {
    long start = time::clock_gettime_nsec(time::CLOCK_MONOTONIC);

    for (usz i = 0; i < ITERATIONS; i++) {
        json_stream::StreamParser p = json_stream::init(json);
        while (p.has_next()) {
            json_stream::Event! ev = p.next();
            if (catch ev) break;
        }
    }

    long end = time::clock_gettime_nsec(time::CLOCK_MONOTONIC);
    return BenchResult {
        .name = label,
        .elapsed_ns = end - start,
        .iterations = ITERATIONS,
    };
}

fn void print_result(BenchResult* r) {
    long per_iter_ns = r.elapsed_ns / (long)r.iterations;
    io::printfn("  %-30s %8ld ns/iter  (%ld ms total, %d iters)",
        r.name, per_iter_ns, r.elapsed_ns / 1_000_000, r.iterations);
}

fn void main() {
    io::printn("=== JSON Parse Benchmark ===\n");

    io::printn("Small JSON (~100 bytes):");
    BenchResult r1 = bench_dom_parse(SMALL_JSON, "DOM parse");
    BenchResult r2 = bench_stream_parse(SMALL_JSON, "Stream parse");
    print_result(&r1);
    print_result(&r2);

    io::printn("\nMedium JSON (~500 bytes):");
    BenchResult r3 = bench_dom_parse(MEDIUM_JSON, "DOM parse");
    BenchResult r4 = bench_stream_parse(MEDIUM_JSON, "Stream parse");
    print_result(&r3);
    print_result(&r4);

    io::printn("\nDeeply nested JSON:");
    BenchResult r5 = bench_dom_parse(NESTED_JSON, "DOM parse");
    BenchResult r6 = bench_stream_parse(NESTED_JSON, "Stream parse");
    print_result(&r5);
    print_result(&r6);

    io::printn("\nDone.");
}
