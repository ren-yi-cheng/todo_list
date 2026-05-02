export function makeId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}
