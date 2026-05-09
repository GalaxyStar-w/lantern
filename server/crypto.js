// AES-GCM 对称加密，用 env.KEY_ENC_SECRET 派生密钥
// 用于给用户自定义的 apiKey 落库前加密、读回时解密
// 存储格式: base64(iv[12] || ciphertext)

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(env) {
  const secret = env.KEY_ENC_SECRET || '';
  if (!secret || secret.length < 16) {
    throw new Error('KEY_ENC_SECRET 未配置或太短（至少 16 位）');
  }
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toB64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function encryptKey(env, plaintext) {
  if (!plaintext) return null;
  const key = await deriveKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return toB64(combined);
}

export async function decryptKey(env, b64) {
  if (!b64) return null;
  const combined = fromB64(b64);
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const key = await deriveKey(env);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(pt);
}

// 给前端展示用：只返回末 4 位
export function maskKey(plaintext) {
  if (!plaintext) return '';
  if (plaintext.length <= 4) return '****';
  return '••••' + plaintext.slice(-4);
}
