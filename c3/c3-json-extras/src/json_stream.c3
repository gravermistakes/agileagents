/**
 * Streaming/SAX JSON parser for C3.
 *
 * Zero-allocation event-driven parser. Does not build a DOM tree —
 * emits events as tokens are encountered. Suitable for large JSON
 * on memory-constrained targets including wasm32.
 *
 * AI Disclosure: AI-assisted. Reviewed and owned by contributor.
 */
module std::encoding::json_stream;

import std::io;

fault StreamError {
    UNEXPECTED_CHARACTER,
    UNEXPECTED_EOF,
    INVALID_ESCAPE_SEQUENCE,
    INVALID_NUMBER,
    INVALID_LITERAL,
    MAX_DEPTH_REACHED,
    CALLBACK_ABORT,
}

enum EventType : char {
    OBJECT_START,
    OBJECT_END,
    ARRAY_START,
    ARRAY_END,
    KEY,
    STRING,
    NUMBER,
    BOOL_TRUE,
    BOOL_FALSE,
    NULL_VALUE,
}

struct Event {
    EventType type;
    String value;
    usz depth;
}

const usz MAX_DEPTH = 128;

def EventCallback = fn bool(Event* event, void* userdata);

// --- Callback (push) API ---

fn void! stream_parse(String json, EventCallback cb, void* userdata) {
    StreamParser p = init(json);
    while (true) {
        Event! ev = p.next();
        if (catch err = ev) {
            if (err == StreamError.UNEXPECTED_EOF) return; // clean end
            return err?;
        }
        if (!cb(&ev, userdata)) return StreamError.CALLBACK_ABORT?;
    }
}

// --- Iterator (pull) API ---

struct StreamParser {
    String source;
    usz pos;
    usz depth;
    State[MAX_DEPTH] stack;
    usz stack_top;
    bool done;
}

enum State : char {
    TOP_LEVEL,
    OBJECT_KEY,
    OBJECT_COLON,
    OBJECT_VALUE,
    OBJECT_COMMA,
    ARRAY_VALUE,
    ARRAY_COMMA,
}

fn StreamParser init(String json) {
    StreamParser p;
    p.source = json;
    p.pos = 0;
    p.depth = 0;
    p.stack_top = 0;
    p.stack[0] = State.TOP_LEVEL;
    p.done = false;
    return p;
}

fn Event! StreamParser.next(&self) {
    if (self.done) return StreamError.UNEXPECTED_EOF?;

    self.skip_whitespace();

    if (self.pos >= self.source.len) {
        self.done = true;
        return StreamError.UNEXPECTED_EOF?;
    }

    State state = self.stack[self.stack_top];
    char c = self.source[self.pos];

    switch (state) {
        TOP_LEVEL: {
            return self.parse_value();
        },
        OBJECT_KEY: {
            if (c == '}') {
                self.pos++;
                self.pop_state();
                self.depth--;
                return Event { .type = EventType.OBJECT_END, .depth = self.depth };
            }
            if (c == '"') {
                String key = self.parse_string_value()!;
                self.stack[self.stack_top] = State.OBJECT_COLON;
                return Event { .type = EventType.KEY, .value = key, .depth = self.depth };
            }
            return StreamError.UNEXPECTED_CHARACTER?;
        },
        OBJECT_COLON: {
            if (c != ':') return StreamError.UNEXPECTED_CHARACTER?;
            self.pos++;
            self.stack[self.stack_top] = State.OBJECT_VALUE;
            return self.next();
        },
        OBJECT_VALUE: {
            self.stack[self.stack_top] = State.OBJECT_COMMA;
            return self.parse_value();
        },
        OBJECT_COMMA: {
            if (c == ',') {
                self.pos++;
                self.stack[self.stack_top] = State.OBJECT_KEY;
                self.skip_whitespace();
                return self.next();
            }
            if (c == '}') {
                self.pos++;
                self.pop_state();
                self.depth--;
                return Event { .type = EventType.OBJECT_END, .depth = self.depth };
            }
            return StreamError.UNEXPECTED_CHARACTER?;
        },
        ARRAY_VALUE: {
            if (c == ']') {
                self.pos++;
                self.pop_state();
                self.depth--;
                return Event { .type = EventType.ARRAY_END, .depth = self.depth };
            }
            self.stack[self.stack_top] = State.ARRAY_COMMA;
            return self.parse_value();
        },
        ARRAY_COMMA: {
            if (c == ',') {
                self.pos++;
                self.stack[self.stack_top] = State.ARRAY_VALUE;
                self.skip_whitespace();
                return self.next();
            }
            if (c == ']') {
                self.pos++;
                self.pop_state();
                self.depth--;
                return Event { .type = EventType.ARRAY_END, .depth = self.depth };
            }
            return StreamError.UNEXPECTED_CHARACTER?;
        },
    }

    return StreamError.UNEXPECTED_CHARACTER?;
}

fn bool StreamParser.has_next(&self) {
    return !self.done;
}

// --- Internal parsing ---

fn Event! StreamParser.parse_value(&self) {
    self.skip_whitespace();
    if (self.pos >= self.source.len) return StreamError.UNEXPECTED_EOF?;

    char c = self.source[self.pos];

    switch (c) {
        '{': {
            if (self.depth >= MAX_DEPTH) return StreamError.MAX_DEPTH_REACHED?;
            self.pos++;
            self.depth++;
            self.push_state(State.OBJECT_KEY);
            return Event { .type = EventType.OBJECT_START, .depth = self.depth - 1 };
        },
        '[': {
            if (self.depth >= MAX_DEPTH) return StreamError.MAX_DEPTH_REACHED?;
            self.pos++;
            self.depth++;
            self.push_state(State.ARRAY_VALUE);
            return Event { .type = EventType.ARRAY_START, .depth = self.depth - 1 };
        },
        '"': {
            String val = self.parse_string_value()!;
            return Event { .type = EventType.STRING, .value = val, .depth = self.depth };
        },
        't': {
            self.expect_literal("true")!;
            return Event { .type = EventType.BOOL_TRUE, .value = "true", .depth = self.depth };
        },
        'f': {
            self.expect_literal("false")!;
            return Event { .type = EventType.BOOL_FALSE, .value = "false", .depth = self.depth };
        },
        'n': {
            self.expect_literal("null")!;
            return Event { .type = EventType.NULL_VALUE, .value = "null", .depth = self.depth };
        },
        default: {
            if (c == '-' || (c >= '0' && c <= '9')) {
                String num = self.parse_number_value()!;
                return Event { .type = EventType.NUMBER, .value = num, .depth = self.depth };
            }
            return StreamError.UNEXPECTED_CHARACTER?;
        },
    }
}

fn String! StreamParser.parse_string_value(&self) {
    if (self.source[self.pos] != '"') return StreamError.UNEXPECTED_CHARACTER?;
    self.pos++; // skip opening quote

    usz start = self.pos;
    while (self.pos < self.source.len) {
        char c = self.source[self.pos];
        if (c == '"') {
            String val = self.source[start..self.pos];
            self.pos++; // skip closing quote
            return val;
        }
        if (c == '\\') {
            self.pos++; // skip backslash
            if (self.pos >= self.source.len) return StreamError.UNEXPECTED_EOF?;
            char esc = self.source[self.pos];
            switch (esc) {
                '"', '\\', '/', 'b', 'f', 'n', 'r', 't': {},
                'u': {
                    // skip 4 hex digits
                    if (self.pos + 4 >= self.source.len) return StreamError.INVALID_ESCAPE_SEQUENCE?;
                    for (usz i = 0; i < 4; i++) {
                        self.pos++;
                        char h = self.source[self.pos];
                        if (!is_hex_digit(h)) return StreamError.INVALID_ESCAPE_SEQUENCE?;
                    }
                },
                default: return StreamError.INVALID_ESCAPE_SEQUENCE?,
            }
        }
        self.pos++;
    }
    return StreamError.UNEXPECTED_EOF?;
}

fn String! StreamParser.parse_number_value(&self) {
    usz start = self.pos;

    // optional minus
    if (self.pos < self.source.len && self.source[self.pos] == '-') self.pos++;

    // integer part
    if (self.pos >= self.source.len) return StreamError.INVALID_NUMBER?;
    if (self.source[self.pos] == '0') {
        self.pos++;
    } else if (self.source[self.pos] >= '1' && self.source[self.pos] <= '9') {
        while (self.pos < self.source.len && self.source[self.pos] >= '0' && self.source[self.pos] <= '9') {
            self.pos++;
        }
    } else {
        return StreamError.INVALID_NUMBER?;
    }

    // fractional part
    if (self.pos < self.source.len && self.source[self.pos] == '.') {
        self.pos++;
        if (self.pos >= self.source.len || self.source[self.pos] < '0' || self.source[self.pos] > '9') {
            return StreamError.INVALID_NUMBER?;
        }
        while (self.pos < self.source.len && self.source[self.pos] >= '0' && self.source[self.pos] <= '9') {
            self.pos++;
        }
    }

    // exponent
    if (self.pos < self.source.len && (self.source[self.pos] == 'e' || self.source[self.pos] == 'E')) {
        self.pos++;
        if (self.pos < self.source.len && (self.source[self.pos] == '+' || self.source[self.pos] == '-')) {
            self.pos++;
        }
        if (self.pos >= self.source.len || self.source[self.pos] < '0' || self.source[self.pos] > '9') {
            return StreamError.INVALID_NUMBER?;
        }
        while (self.pos < self.source.len && self.source[self.pos] >= '0' && self.source[self.pos] <= '9') {
            self.pos++;
        }
    }

    return self.source[start..self.pos];
}

fn void! StreamParser.expect_literal(&self, String literal) {
    if (self.pos + literal.len > self.source.len) return StreamError.INVALID_LITERAL?;
    for (usz i = 0; i < literal.len; i++) {
        if (self.source[self.pos + i] != literal[i]) return StreamError.INVALID_LITERAL?;
    }
    self.pos += literal.len;
}

fn void StreamParser.skip_whitespace(&self) {
    while (self.pos < self.source.len) {
        char c = self.source[self.pos];
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            self.pos++;
        } else {
            break;
        }
    }
}

fn void StreamParser.push_state(&self, State state) {
    if (self.stack_top + 1 < MAX_DEPTH) {
        self.stack_top++;
        self.stack[self.stack_top] = state;
    }
}

fn void StreamParser.pop_state(&self) {
    if (self.stack_top > 0) {
        self.stack_top--;
    }
}

fn bool is_hex_digit(char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}
