export function assert(cond: boolean, message?: string): asserts cond {
    if (!cond) {
        console.assert(cond, message || "assert failed");
        console.trace();
        throw message || "assert failed";
    }
}

/**
 * Used for exhaustiveness checking:
 * ```
 * switch(my_enum.type) {
 *     case "A": ...
 *     case "B": ...
 *     default: never(my_enum);
 * }
 * ```
 * Forgetting to handle a case will be a type error.
 */
export function never(x: never): never {
    assert(false, JSON.stringify(x));
    // Runtime assert is here because TypeScript type system is unsound
    // and this line is actually reachable in exotic cases.
}

/** `bang(x)` is the same as `x!`, but with a runtime check. */
export function bang<T>(x: T): NonNullable<T> {
    assert(x !== null && x !== undefined);
    return x;
}
// Unfortunately, it doesn't assert the condition,
// because TypeScript doesn't support combining `asserts` and return types:
// https://github.com/microsoft/TypeScript/issues/40562
// So the return value will be narrowed, but the original argument won't be.
