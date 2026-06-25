/**
 * Tests for JSON Pointer (RFC 6901) implementation.
 *
 * Test cases derived from RFC 6901 Section 5 examples.
 */
module json_pointer_test;

import std::encoding::json;
import std::encoding::json_pointer;

// Note: These tests depend on the C3 stdlib json::parse API.
// They demonstrate the intended usage pattern. When running locally,
// ensure C3 v0.8.1+ is installed.

// RFC 6901 Section 5 reference document:
// {
//   "foo": ["bar", "baz"],
//   "": 0,
//   "a/b": 1,
//   "c%d": 2,
//   "e^f": 3,
//   "g|h": 4,
//   "i\\j": 5,
//   "k\"l": 6,
//   " ": 7,
//   "m~n": 8
// }

const String RFC_DOC = `{
    "foo": ["bar", "baz"],
    "": 0,
    "a/b": 1,
    "c%d": 2,
    "e^f": 3,
    "g|h": 4,
    "i\\j": 5,
    "k\"l": 6,
    " ": 7,
    "m~n": 8
}`;

// --- Tests: Basic resolution ---

fn void! empty_pointer_returns_root() @test {
    var root = json::parse(std::heap::allocator(), RFC_DOC)!;
    defer root.free();

    var result = json_pointer::resolve(root, "")!;
    assert(result == root);
}

fn void! resolve_simple_key() @test {
    var root = json::parse(std::heap::allocator(), `{"name": "alice"}`)!;
    defer root.free();

    var result = json_pointer::resolve(root, "/name")!;
    assert(result.get_string() == "alice");
}

fn void! resolve_nested_key() @test {
    var root = json::parse(std::heap::allocator(), `{"a": {"b": {"c": 42}}}`)!;
    defer root.free();

    var result = json_pointer::resolve(root, "/a/b/c")!;
    assert(result.get_number() == 42.0);
}

fn void! resolve_array_index() @test {
    var root = json::parse(std::heap::allocator(), RFC_DOC)!;
    defer root.free();

    // /foo/0 → "bar"
    var result = json_pointer::resolve(root, "/foo/0")!;
    assert(result.get_string() == "bar");

    // /foo/1 → "baz"
    result = json_pointer::resolve(root, "/foo/1")!;
    assert(result.get_string() == "baz");
}

fn void! resolve_empty_key() @test {
    var root = json::parse(std::heap::allocator(), RFC_DOC)!;
    defer root.free();

    // /"" → 0
    var result = json_pointer::resolve(root, "/")!;
    assert(result.get_number() == 0.0);
}

fn void! resolve_space_key() @test {
    var root = json::parse(std::heap::allocator(), RFC_DOC)!;
    defer root.free();

    // / → 7 (key is a single space)
    var result = json_pointer::resolve(root, "/ ")!;
    assert(result.get_number() == 7.0);
}

// --- Tests: Escaping (RFC 6901 Section 3) ---

fn void! resolve_escaped_tilde() @test {
    var root = json::parse(std::heap::allocator(), RFC_DOC)!;
    defer root.free();

    // /m~0n → 8 (m~n)
    var result = json_pointer::resolve(root, "/m~0n")!;
    assert(result.get_number() == 8.0);
}

fn void! resolve_escaped_slash() @test {
    var root = json::parse(std::heap::allocator(), RFC_DOC)!;
    defer root.free();

    // /a~1b → 1 (a/b)
    var result = json_pointer::resolve(root, "/a~1b")!;
    assert(result.get_number() == 1.0);
}

// --- Tests: exists() ---

fn void! exists_returns_true_for_valid_path() @test {
    var root = json::parse(std::heap::allocator(), `{"a": {"b": 1}}`)!;
    defer root.free();

    assert(json_pointer::exists(root, "/a/b"));
    assert(json_pointer::exists(root, "/a"));
    assert(json_pointer::exists(root, ""));
}

fn void! exists_returns_false_for_missing_path() @test {
    var root = json::parse(std::heap::allocator(), `{"a": 1}`)!;
    defer root.free();

    assert(!json_pointer::exists(root, "/b"));
    assert(!json_pointer::exists(root, "/a/b"));
    assert(!json_pointer::exists(root, "/a/0"));
}

// --- Tests: Error cases ---

fn void! invalid_pointer_no_leading_slash() @test {
    var root = json::parse(std::heap::allocator(), `{"a": 1}`)!;
    defer root.free();

    var result = json_pointer::resolve(root, "a");
    assert(@catch(result) == json_pointer::PointerError.INVALID_POINTER);
}

fn void! key_not_found() @test {
    var root = json::parse(std::heap::allocator(), `{"a": 1}`)!;
    defer root.free();

    var result = json_pointer::resolve(root, "/missing");
    assert(@catch(result) == json_pointer::PointerError.KEY_NOT_FOUND);
}

fn void! index_out_of_bounds() @test {
    var root = json::parse(std::heap::allocator(), `[1, 2, 3]`)!;
    defer root.free();

    var result = json_pointer::resolve(root, "/99");
    assert(@catch(result) == json_pointer::PointerError.INDEX_OUT_OF_BOUNDS);
}

fn void! not_indexable() @test {
    var root = json::parse(std::heap::allocator(), `{"a": 42}`)!;
    defer root.free();

    // Trying to descend into a number
    var result = json_pointer::resolve(root, "/a/b");
    assert(@catch(result) == json_pointer::PointerError.NOT_INDEXABLE);
}

fn void! invalid_array_index() @test {
    var root = json::parse(std::heap::allocator(), `[1, 2, 3]`)!;
    defer root.free();

    // Leading zeros not allowed per RFC 6901
    var result = json_pointer::resolve(root, "/01");
    assert(@catch(result) == json_pointer::PointerError.INVALID_INDEX);
}

fn void! dash_index_not_valid_for_resolve() @test {
    var root = json::parse(std::heap::allocator(), `[1, 2, 3]`)!;
    defer root.free();

    // "-" means "past the end" — only valid for set/append, not resolve
    var result = json_pointer::resolve(root, "/-");
    assert(@catch(result) == json_pointer::PointerError.INDEX_OUT_OF_BOUNDS);
}
