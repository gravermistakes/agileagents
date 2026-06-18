/**
 * Emscripten browser example for C3.
 * Renders a simple canvas animation to prove C3 + Emscripten works.
 *
 * Compile: c3c compile --target wasm32 --emscripten app.c3
 * Serve:   python3 -m http.server 8000  (then open index.html)
 */
module emscripten_app;

// Emscripten-provided functions
extern fn void emscripten_set_main_loop(fn void() callback, int fps, int simulate_infinite_loop)
    @extern("emscripten_set_main_loop");

// Canvas 2D context operations (imported from JS glue)
extern fn void canvas_clear(int r, int g, int b) @extern("canvas_clear");
extern fn void canvas_fill_rect(int x, int y, int w, int h, int r, int g, int b) @extern("canvas_fill_rect");
extern fn void canvas_fill_text(char* text, int x, int y) @extern("canvas_fill_text");

int frame_count = 0;
int box_x = 0;
int direction = 1;

fn void main_loop() {
    frame_count++;

    // Clear canvas
    canvas_clear(0, 0, 0);

    // Bouncing box
    box_x += direction * 2;
    if (box_x > 350 || box_x < 0) {
        direction = -direction;
    }

    // Draw box (color cycles with frame)
    int r = (frame_count * 3) & 0xFF;
    int g = (frame_count * 5) & 0xFF;
    int b = (frame_count * 7) & 0xFF;
    canvas_fill_rect(box_x, 100, 50, 50, r, g, b);

    // Draw label
    char[] label = "C3 on WASM via Emscripten";
    canvas_fill_text(&label[0], 10, 30);
}

fn void main() {
    emscripten_set_main_loop(&main_loop, 60, 1);
}
