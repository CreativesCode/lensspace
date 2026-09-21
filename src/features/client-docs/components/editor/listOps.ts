export const replaceAt = <T,>(items: T[], index: number, value: T) => items.map((item, i) => i === index ? value : item)
export const removeAt = <T,>(items: T[], index: number) => items.filter((_, i) => i !== index)
export function moveBy<T>(items: T[], index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = items.slice(); [next[index], next[target]] = [next[target], next[index]]; return next }
