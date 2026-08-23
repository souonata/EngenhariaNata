/**
 * Pure viewport geometry shared by the owner and administrator diagram viewers.
 */

export const MIN_VIEWER_SCALE = 0.025;
export const MAX_VIEWER_SCALE = 12;

export function createViewportState(extra = {}) {
    return {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        width: 0,
        height: 0,
        dragging: null,
        ...extra
    };
}

export function fitViewport(state, viewportWidth, viewportHeight, padding = 34) {
    if (!state.width || !state.height || !viewportWidth || !viewportHeight) {
        return state;
    }
    state.scale = Math.max(
        0.03,
        Math.min((viewportWidth - padding) / state.width, (viewportHeight - padding) / state.height)
    );
    state.offsetX = (viewportWidth - state.width * state.scale) / 2;
    state.offsetY = (viewportHeight - state.height * state.scale) / 2;
    return state;
}

export function zoomViewport(state, factor, focusX, focusY) {
    if (!Number.isFinite(factor) || factor <= 0 || !state.scale) {
        return state;
    }
    const next = Math.min(MAX_VIEWER_SCALE, Math.max(MIN_VIEWER_SCALE, state.scale * factor));
    const ratio = next / state.scale;
    state.offsetX = focusX - (focusX - state.offsetX) * ratio;
    state.offsetY = focusY - (focusY - state.offsetY) * ratio;
    state.scale = next;
    return state;
}
