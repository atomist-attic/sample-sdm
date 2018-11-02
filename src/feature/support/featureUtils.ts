
export function undefinedIsLess<T>(f: (a: T, b: T) => number): (a: T, b: T) => number {
    return (a, b) => {
        if (a == undefined) {
            return 1;
        }
        if (b == undefined) {
            return -1;
        }
        return f(a, b);
    }
}
