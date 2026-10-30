// Framework-independent scheduling keeps streaming and persistence behavior testable.
export function createTextBuffer(append: (text: string) => void, delay = 50) {
  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    const value = text;
    text = "";
    if (value) append(value);
  };
  return {
    push(value: string) {
      text += value;
      timer ??= setTimeout(flush, delay);
    },
    flush,
  };
}
export function createDeferredWriter<T>(
  write: (value: T) => void,
  delay = 350,
  maxWait = 1500,
) {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    clearTimeout(deadline);
    timer = undefined;
    deadline = undefined;
    const next = pending;
    pending = undefined;
    if (next) write(next.value);
  };
  return {
    schedule(value: T) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
      deadline ??= setTimeout(flush, maxWait);
    },
    flush,
  };
}
