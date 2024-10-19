import { assert } from "./assert.js";

/*

Sort of React-inspired miniframework for canvas-based mouse UIs (like vector editors).

Recomputation rules:
 * ui_fn() is called after every event (except mouse move)
 * ui_fn() is called after state_updated()
 * repaint after every event (except mouse move)
 * repaint after mouse move caused hovered zone to change

Note: When event handler is invoked, the state is the same as when
the handler was created. So you can rely on the assumptions and checks
made when ui_fn() was called. This is very nice.

*/

export type Rez<HoverDetail extends { key: string }> = {
    // Call it after any change to state that happens outside zone handlers.
    state_updated: () => void,
    set_ui_fn: (ui_fn: () => Zone<HoverDetail>[]) => void,
    destroy: () => void,
}

export type Zone<HoverDetail extends { key: string }> = {
    hitbox?: (x: number, y: number) => boolean,
    priority: number,
    tooltip?: (args: { x: number, y: number, hover_detail: HoverDetail | null}) => string | null,
    cursor?: string,
    paint?: (args: {
        hovered: boolean,
        hover_detail: HoverDetail | null,
    }) => void,

    /** A zone can return arbitrary data on hover.
     * This data will be available to all zones when rendering,
     * so it can be used to change the appearance of related zones.
     * The "key" field is used for comparison to determine whether repaint is needed.
     */
    get_hover_detail?: (x: number, y: number) => HoverDetail | null,

    // No need to call state_updated() in handlers.
    // It's implied that they change state.
    on_left_mouse_down?: (args: { x: number, y: number, hover_detail: HoverDetail | null }) => void,
    on_left_mouse_up?: (args: { x: number, y: number, hover_detail: HoverDetail | null }) => void,
}

export function scale_mouse_coords(canvas: HTMLCanvasElement, e: MouseEvent) {
    let rect = canvas.getBoundingClientRect();
    return {
        x: e.offsetX * canvas.width / rect.width,
        y: e.offsetY * canvas.height / rect.height,
    }
}

export function create_rez<HoverDetail extends { key: string}>(
    canvas: HTMLCanvasElement,
    ui_fn: () => Zone<HoverDetail>[],
    options?: { update_tooltip?: (e: MouseEvent| null, s: string | null) => void },
): Rez<HoverDetail> {
    function compute_zones(): Zone<HoverDetail>[] {
        let zones = ui_fn();
        for (let z of zones) {
            if (z.tooltip) {
                assert(!!options?.update_tooltip);
            }
            if (z.tooltip || z.on_left_mouse_down || z.cursor || z.get_hover_detail) {
                assert(!!z.hitbox);
            }
        }
        zones.sort((a, b) => a.priority - b.priority);
        return zones;
    }

    function compute_hovered_zone(): [Zone<HoverDetail> | null, HoverDetail | null] {
        if (mouse_pos === null) {
            return [null, null];
        }
        let {x, y} = mouse_pos;
        for (let i = czones.length - 1; i >= 0; i--) {
            let z = czones[i];
            if (z.hitbox && z.hitbox(x, y)) {
                let hover_detail = z.get_hover_detail?.(x, y) ?? null;
                return [z, hover_detail];
            }
        }
        return [null, null];
    }

    let repaint_requested = false;
    let mouse_pos : null | { x: number, y: number } = null;

    /** sorted by priority, for drawing */
    let czones = compute_zones();
    let hovered_zone: null | Zone<HoverDetail> = null;
    let hover_detail: HoverDetail | null = null;

    function repaint() {
        console.time("repaint");
        repaint_requested = false;
        for (let z of czones) {
            if (z.paint) {
                z.paint({
                    hovered: z === hovered_zone,
                    hover_detail,
                });
            }
        }
        console.timeEnd("repaint");
    }

    function request_repaint() {
        if (!repaint_requested) {
            repaint_requested = true;
            requestAnimationFrame(repaint);
        }
    }

    function state_updated() {
        czones = compute_zones();
        [hovered_zone, hover_detail] = compute_hovered_zone();
        let tooltip = null;
        if (hovered_zone?.tooltip) {
            assert(mouse_pos !== null);
            tooltip = hovered_zone.tooltip({ x: mouse_pos.x, y: mouse_pos.y, hover_detail });
        }
        options?.update_tooltip?.(null, tooltip);
        let cursor = hovered_zone?.cursor || "auto";
        canvas.style.cursor = cursor;
        request_repaint();
    }

    canvas.onpointerdown = e => {
        canvas.setPointerCapture(e.pointerId);
        mouse_pos = scale_mouse_coords(canvas, e);
        [hovered_zone, hover_detail] = compute_hovered_zone();
        if (e.button === 0) {
            let handler = hovered_zone?.on_left_mouse_down;
            if (handler) {
                handler({ ...mouse_pos, hover_detail });
                state_updated();
            }
        }
    };

    canvas.onpointerup = e => {
        canvas.releasePointerCapture(e.pointerId);
        mouse_pos = scale_mouse_coords(canvas, e);
        [hovered_zone, hover_detail] = compute_hovered_zone();
        if (e.button === 0) {
            let handler = hovered_zone?.on_left_mouse_up;
            if (handler) {
                handler({ ...mouse_pos, hover_detail });
                state_updated();
            }
        }
    };

    canvas.onpointermove = e => {
        mouse_pos = scale_mouse_coords(canvas, e);
        let [new_hovered_zone, new_hover_detail] = compute_hovered_zone();
        if (hovered_zone !== new_hovered_zone || hover_detail?.key !== new_hover_detail?.key) {
            hovered_zone = new_hovered_zone;
            hover_detail = new_hover_detail;
            request_repaint();

            let cursor = hovered_zone?.cursor || "auto";
            canvas.style.cursor = cursor;
        }
        let tooltip = null;
        if (hovered_zone?.tooltip) {
            tooltip = hovered_zone.tooltip({ x: mouse_pos.x, y: mouse_pos.y, hover_detail });
        }
        options?.update_tooltip?.(e, tooltip);
    };
    canvas.onpointerleave = e => {
        mouse_pos = null;
        if (hovered_zone !== null) {
            hovered_zone = null;
            hover_detail = null;
            request_repaint();
        }
        let tooltip = null;
        options?.update_tooltip?.(e, tooltip);
        canvas.style.cursor = "auto";
    };

    function destroy() {
        canvas.onpointerdown = null;
        canvas.onpointerup = null;
        canvas.onpointermove = null;
        canvas.onpointerleave = null;
        // TODO: Only clear the tooltip if it was set by us before.
        // Otherwise we might be clearing someone else's tooltip.
        options?.update_tooltip?.(null, null);
    }

    function set_ui_fn(new_ui_fn: () => Zone<HoverDetail>[]) {
        ui_fn = new_ui_fn;
        state_updated();
    }

    let rez = { state_updated, destroy, set_ui_fn };
    request_repaint();
    return rez;
}
