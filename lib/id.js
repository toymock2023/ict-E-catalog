// 排除 0 o 1 l i 這些在印刷品與 QR 掃描結果中容易被看錯的字元。
export const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ID_LENGTH = 6;
export const MAX_ID_ATTEMPTS = 10;

function defaultRandomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function isValidId(id) {
  if (typeof id !== 'string' || id.length !== ID_LENGTH) return false;
  return [...id].every((ch) => ID_ALPHABET.includes(ch));
}

/**
 * 產生一個不與 existingIds 重複的型錄 id。
 * randomBytes 可注入，測試時用來產生可預測的結果。
 */
export function generateId(existingIds = [], randomBytes = defaultRandomBytes) {
  const taken = new Set(existingIds);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const bytes = randomBytes(ID_LENGTH);
    let id = '';
    for (let i = 0; i < ID_LENGTH; i += 1) {
      id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
    }
    if (!taken.has(id)) return id;
  }
  throw new Error(`無法產生不重複的型錄 id（已重試 ${MAX_ID_ATTEMPTS} 次）`);
}
