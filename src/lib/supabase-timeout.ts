const DEFAULT_TIMEOUT_MS = 10_000;

export function withTimeout<T>(operation: PromiseLike<T>, label: string, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(`${label} is taking longer than expected. Please check your connection and try again.`));
    }, ms);

    Promise.resolve(operation).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
