// Bound waiting, without cancelling or restarting an in-flight native operation.
export async function withTimeout<T>(work: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Local data took too long to load. Please retry.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
