export type BhashiniCapability = {
  available: false;
  provider: 'bhashini';
  reason: 'not-configured';
};

/** Bundled catalogs remain authoritative. Online language services require a secure server proxy. */
export function getBhashiniCapability(): BhashiniCapability {
  return { available: false, provider: 'bhashini', reason: 'not-configured' };
}
