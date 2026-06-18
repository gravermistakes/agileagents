/**
 * Tests for the streaming/SAX JSON parser.
 */
module json_stream_test;

import std::encoding::json_stream;
import std::io;

// --- Helper: collect events into a fixed buffer ---

const usz MAX_EVENTS = 64;

struct EventCollector {
    json_stream::Event[MAX_EVENTS] events;
    usz count;
}

fn bool collect_event(json_stream::Event* event, void* userdata) {
    EventCollector* collector = (EventCollector*)userdata;
    if (collector.count < MAX_EVENTS) {
        collector.events[collector.count] = *event;
        collector.count++;
    }
    return true;
}

// --- Tests: Basic values ---

fn void! empty_object_emits_start_and_end() @test {
    json_stream::StreamParser p = json_stream::init("{}");

    json_stream::Event ev1 = p.next()!;
    assert(ev1.type == json_stream::EventType.OBJECT_START);
    assert(ev1.depth == 0);

    json_stream::Event ev2 = p.next()!;
    assert(ev2.type == json_stream::EventType.OBJECT_END);
    assert(ev2.depth == 0);
}

fn void! empty_array_emits_start_and_end() @test {
    json_stream::StreamParser p = json_stream::init("[]");

    json_stream::Event ev1 = p.next()!;
    assert(ev1.type == json_stream::EventType.ARRAY_START);

    json_stream::Event ev2 = p.next()!;
    assert(ev2.type == json_stream::EventType.ARRAY_END);
}

fn void! string_value_parsed() @test {
    json_stream::StreamParser p = json_stream::init(`"hello"`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.STRING);
    assert(ev.value == "hello");
}

fn void! number_integer_parsed() @test {
    json_stream::StreamParser p = json_stream::init("42");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "42");
}

fn void! number_negative_parsed() @test {
    json_stream::StreamParser p = json_stream::init("-3.14");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "-3.14");
}

fn void! number_exponent_parsed() @test {
    json_stream::StreamParser p = json_stream::init("1.5e10");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "1.5e10");
}

fn void! true_literal_parsed() @test {
    json_stream::StreamParser p = json_stream::init("true");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.BOOL_TRUE);
}

fn void! false_literal_parsed() @test {
    json_stream::StreamParser p = json_stream::init("false");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.BOOL_FALSE);
}

fn void! null_literal_parsed() @test {
    json_stream::StreamParser p = json_stream::init("null");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.NULL_VALUE);
}

// --- Tests: Objects ---

fn void! simple_object_keys_and_values() @test {
    json_stream::StreamParser p = json_stream::init(`{"name": "alice", "age": 30}`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_START);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.KEY);
    assert(ev.value == "name");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.STRING);
    assert(ev.value == "alice");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.KEY);
    assert(ev.value == "age");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "30");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_END);
}

// --- Tests: Arrays ---

fn void! array_of_numbers() @test {
    json_stream::StreamParser p = json_stream::init("[1, 2, 3]");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.ARRAY_START);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "1");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "2");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "3");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.ARRAY_END);
}

fn void! mixed_array() @test {
    json_stream::StreamParser p = json_stream::init(`[1, "two", true, null]`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.ARRAY_START);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.STRING);
    assert(ev.value == "two");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.BOOL_TRUE);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NULL_VALUE);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.ARRAY_END);
}

// --- Tests: Nesting ---

fn void! nested_objects() @test {
    json_stream::StreamParser p = json_stream::init(`{"a": {"b": 1}}`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_START);
    assert(ev.depth == 0);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.KEY);
    assert(ev.value == "a");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_START);
    assert(ev.depth == 1);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.KEY);
    assert(ev.value == "b");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "1");
    assert(ev.depth == 2);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_END);
    assert(ev.depth == 1);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_END);
    assert(ev.depth == 0);
}

fn void! array_in_object() @test {
    json_stream::StreamParser p = json_stream::init(`{"items": [1, 2]}`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_START);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.KEY);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.ARRAY_START);
    assert(ev.depth == 1);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.ARRAY_END);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_END);
}

// --- Tests: Strings with escapes ---

fn void! string_with_escaped_quote() @test {
    json_stream::StreamParser p = json_stream::init(`"say \"hello\""`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.STRING);
}

fn void! string_with_backslash() @test {
    json_stream::StreamParser p = json_stream::init(`"path\\to\\file"`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.STRING);
}

fn void! string_with_unicode_escape() @test {
    json_stream::StreamParser p = json_stream::init(`"AB"`);

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.STRING);
}

// --- Tests: Error cases ---

fn void! invalid_character_at_top_level() @test {
    json_stream::StreamParser p = json_stream::init("@");

    json_stream::Event! ev = p.next();
    assert(@catch(ev) == json_stream::StreamError.UNEXPECTED_CHARACTER);
}

fn void! truncated_true() @test {
    json_stream::StreamParser p = json_stream::init("tru");

    json_stream::Event! ev = p.next();
    assert(@catch(ev) == json_stream::StreamError.INVALID_LITERAL);
}

fn void! invalid_number_leading_zero() @test {
    // "01" is not valid JSON — leading zeros not allowed
    json_stream::StreamParser p = json_stream::init("01");

    // This should parse "0" as a number, then fail on "1"
    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "0");
}

fn void! unclosed_string() @test {
    json_stream::StreamParser p = json_stream::init(`"hello`);

    json_stream::Event! ev = p.next();
    assert(@catch(ev) == json_stream::StreamError.UNEXPECTED_EOF);
}

fn void! invalid_escape_sequence() @test {
    json_stream::StreamParser p = json_stream::init(`"\x"`);

    json_stream::Event! ev = p.next();
    assert(@catch(ev) == json_stream::StreamError.INVALID_ESCAPE_SEQUENCE);
}

// --- Tests: Callback API ---

fn void! callback_receives_all_events() @test {
    EventCollector collector;
    collector.count = 0;

    json_stream::stream_parse(`{"x": [1, 2]}`, &collect_event, &collector)!;

    // Expected: OBJECT_START, KEY("x"), ARRAY_START, NUMBER(1), NUMBER(2), ARRAY_END, OBJECT_END
    assert(collector.count == 7);
    assert(collector.events[0].type == json_stream::EventType.OBJECT_START);
    assert(collector.events[1].type == json_stream::EventType.KEY);
    assert(collector.events[2].type == json_stream::EventType.ARRAY_START);
    assert(collector.events[3].type == json_stream::EventType.NUMBER);
    assert(collector.events[4].type == json_stream::EventType.NUMBER);
    assert(collector.events[5].type == json_stream::EventType.ARRAY_END);
    assert(collector.events[6].type == json_stream::EventType.OBJECT_END);
}

fn bool abort_after_first(json_stream::Event* event, void* userdata) {
    EventCollector* collector = (EventCollector*)userdata;
    collector.events[collector.count] = *event;
    collector.count++;
    return false; // abort immediately
}

fn void! callback_abort_stops_parsing() @test {
    EventCollector collector;
    collector.count = 0;

    json_stream::StreamError! err = json_stream::stream_parse("[1, 2, 3]", &abort_after_first, &collector);
    assert(@catch(err) == json_stream::StreamError.CALLBACK_ABORT);
    assert(collector.count == 1);
}

// --- Tests: Whitespace handling ---

fn void! whitespace_is_ignored() @test {
    json_stream::StreamParser p = json_stream::init("  {  \"a\"  :  1  }  ");

    json_stream::Event ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_START);

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.KEY);
    assert(ev.value == "a");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.NUMBER);
    assert(ev.value == "1");

    ev = p.next()!;
    assert(ev.type == json_stream::EventType.OBJECT_END);
}
