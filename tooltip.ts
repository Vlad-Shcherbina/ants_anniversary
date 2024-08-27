let tooltip: string | null = null;
let tooltip_elem = document.getElementById("tooltip")!;

export function update_tooltip(e: MouseEvent | null, new_tooltip: string | null) {
    if (new_tooltip !== null && e !== null) {
        if (e.clientX < document.documentElement.clientWidth / 2) {
            tooltip_elem.style.left = e.clientX + 20 + "px";
            tooltip_elem.style.right = "auto";
        } else {
            tooltip_elem.style.right = document.documentElement.clientWidth - e.clientX + 20 + "px";
            tooltip_elem.style.left = "auto";
        }
        if (e.clientY < document.documentElement.clientHeight / 2) {
            tooltip_elem.style.top = e.clientY + 20 + "px";
            tooltip_elem.style.bottom = "auto";
        } else {
            tooltip_elem.style.bottom = document.documentElement.clientHeight - e.clientY + 20 + "px";
            tooltip_elem.style.top = "auto";
        }
    }
    if (tooltip === new_tooltip) {
        return;
    }
    tooltip = new_tooltip;
    if (tooltip === null) {
        tooltip_elem.style.display = "none";
        tooltip_elem.innerHTML = "";
    } else {
        tooltip_elem.innerHTML = tooltip;
        tooltip_elem.style.display = "block";
    }
}
