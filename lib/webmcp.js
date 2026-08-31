export const hasNativeWebMcp = (doc = globalThis.document) =>
  typeof doc?.modelContext?.registerTool === "function";

export const registerWebMcpTools = async ({ tools, documentRef = globalThis.document, signal }) => {
  if (!hasNativeWebMcp(documentRef)) {
    return { supported: false, registered: 0 };
  }

  let registered = 0;
  for (const tool of tools) {
    if (signal?.aborted) break;
    await documentRef.modelContext.registerTool(tool, { signal });
    registered += 1;
  }

  return { supported: true, registered };
};

export const abortableDelay = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Canceled", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Canceled", "AbortError"));
      },
      { once: true }
    );
  });
