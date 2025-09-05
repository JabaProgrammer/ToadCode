import ivm from 'isolated-vm';
export function runUserCode(code, func, args, timeoutMs = 500) {
    const isolate = new ivm.Isolate({ memoryLimit: 8 });
    const context = isolate.createContextSync();
    const script = isolate.compileScriptSync(`"use strict"; ${code}; typeof ${func} === 'function' ? ${func} : null;`);
    const ref = script.runSync(context, { timeout: timeoutMs, reference: true });
    if (!(ref instanceof ivm.Reference))
        throw new Error(`Function ${func} not found`);
    return ref.applySync(undefined, args, { timeout: timeoutMs });
}
