export const createReaderWorker = () =>
  new Worker(new URL("./reader.worker.ts", import.meta.url), {
    type: "module",
  });

export function workerRequest<T>(
  message: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = createReaderWorker();
    const stop = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      stop();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      stop();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result as T);
    };
    worker.onerror = () => {
      stop();
      reject(
        new Error(
          "The background reader could not start. Reload the app and try again.",
        ),
      );
    };
    worker.postMessage(message);
  });
}
