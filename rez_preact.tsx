import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useEffect,  useLayoutEffect, useRef } from "./vendor/preact/hooks.js";

import { create_rez, type Rez, type Zone } from "./rez.js";

export type RezCanvasRef<HoverDetail extends { key: string }> = {
    canvas: HTMLCanvasElement,
    rez: Rez<HoverDetail>,
};

type RezCanvasProps<HoverDetail extends { key: string }> =
Omit<preact.JSX.HTMLAttributes<HTMLCanvasElement>, "ref"> & {
    ui_fn: (canvas: HTMLCanvasElement) => Zone<HoverDetail>[],
    update_tooltip?: (e: MouseEvent| null, s: string | null) => void,
    ref2?: preact.RefObject<RezCanvasRef<HoverDetail>>,
};

export function RezCanvas<HoverDetail extends { key: string }>(props: RezCanvasProps<HoverDetail>) {
    let { ui_fn, update_tooltip, ref2, ...canvas_props } = props;
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let rez_ref = useRef<Rez<HoverDetail>>(null);
    useLayoutEffect(() => {
        assert(canvas_ref.current !== null);
        let rez = create_rez<HoverDetail>(canvas_ref.current, () => [], { update_tooltip });
        rez_ref.current = rez;
        return () => rez.destroy();
    }, [update_tooltip]); // TODO: rez should support changing update_tooltip() fn without recreating

    // When a zone event handler is triggered, rez repaint is requested twice:
    // first implicitly (because rez assumes all events require a repaint),
    // second after the handler modifies react-managed state, the component re-renders,
    // and the ui_fn() changes.
    // For these repaint requests to be batched together, the second requested
    // should happen early enough.
    // That's why useLayoutEffect() instead of useEffect().
    useLayoutEffect(() => {
        bang(rez_ref.current).set_ui_fn(() => ui_fn(bang(canvas_ref.current)));
    }, [ui_fn]);

    useEffect(() => {
        let canvas = bang(canvas_ref.current);
        function update_resolution() {
            const { width, height } = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            // TODO: Properly resizing a canvas is complicated, see
            // https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html

            // TODO: Ensure that style.width and style.height remain the same
            // and we are not in a resize loop.
            // Or at least warn about the resize loop.

            // TODO: This causes flicker, because canvas is cleared right away,
            // but repaint only happens in next animation frame.
            bang(rez_ref.current).state_updated();
        }
        let resize_observer = new ResizeObserver(update_resolution);
        resize_observer.observe(canvas);
        update_resolution();
        return () => resize_observer.disconnect();

        // TODO: Also subscribe to DPR change events.
        // Otherwise when dragging to a monitor with different DPR,
        // the resolution is not updated.
    }, []);

    // Preact doesn't have useImperativeHandle(),
    // so we forward the ref manually.
    useLayoutEffect(() => {
        if (!ref2) return;
        ref2.current = { canvas: bang(canvas_ref.current), rez: bang(rez_ref.current) };
    }, [ref2]);

    return <canvas {...canvas_props} ref={canvas_ref} />;
}
