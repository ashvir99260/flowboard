// Nest and the fixture may both clean up after startup fails.
export function closeOnce(close) {
  let completion;
  return () => (completion ??= Promise.resolve().then(close));
}
