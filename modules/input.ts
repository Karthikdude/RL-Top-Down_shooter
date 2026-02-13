export const Input = {
    keys: { w: false, a: false, s: false, d: false, r: false, ' ': false, 'shift': false, c: false } as Record<string, boolean>,
    mouse: { x: 0, y: 0, down: false },

    init(canvas: HTMLCanvasElement) {
        window.addEventListener('keydown', e => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
        });
        window.addEventListener('keyup', e => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
        });
        
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            // Scale logic matches Screen Point -> Canvas Point
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        });
        canvas.addEventListener('mousedown', () => this.mouse.down = true);
        canvas.addEventListener('mouseup', () => this.mouse.down = false);
    },

    getMoveDir() {
        let x = 0, y = 0;
        if (this.keys.a) x -= 1;
        if (this.keys.d) x += 1;
        if (this.keys.w) y -= 1;
        if (this.keys.s) y += 1;
        
        const len = Math.sqrt(x*x + y*y);
        if (len > 0) { x /= len; y /= len; }
        return { x, y };
    }
};