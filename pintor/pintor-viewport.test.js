import { describe, expect, it } from 'vitest';

import {
    MAX_VIEWER_SCALE,
    MIN_VIEWER_SCALE,
    createViewportState,
    fitViewport,
    zoomViewport
} from './pintor-viewport.js';

describe('Pintor diagram viewport geometry', () => {
    it('fits and centres a diagram inside the available viewport', () => {
        const state = createViewportState({ width: 2000, height: 1000 });

        fitViewport(state, 1000, 600);

        expect(state.scale).toBeCloseTo(0.483);
        expect(state.offsetX).toBeCloseTo(17);
        expect(state.offsetY).toBeCloseTo(58.5);
    });

    it('keeps the document point below the cursor fixed while zooming', () => {
        const state = createViewportState({
            width: 1800,
            height: 1200,
            scale: 0.5,
            offsetX: 40,
            offsetY: 20
        });
        const focus = { x: 340, y: 220 };
        const before = {
            x: (focus.x - state.offsetX) / state.scale,
            y: (focus.y - state.offsetY) / state.scale
        };

        zoomViewport(state, 2, focus.x, focus.y);

        expect((focus.x - state.offsetX) / state.scale).toBeCloseTo(before.x);
        expect((focus.y - state.offsetY) / state.scale).toBeCloseTo(before.y);
    });

    it('clamps extreme zoom requests to safe limits', () => {
        const state = createViewportState({ scale: 1 });

        zoomViewport(state, 1000, 0, 0);
        expect(state.scale).toBe(MAX_VIEWER_SCALE);

        zoomViewport(state, 0.000001, 0, 0);
        expect(state.scale).toBe(MIN_VIEWER_SCALE);
    });
});
