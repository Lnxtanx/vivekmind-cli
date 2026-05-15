/**
 * HTTP API wrapper for WeChat iLink Bot API.
 */
// iLink Bot API protocol version we are compatible with.
// Used both in the request body (base_info.channel_version) and in the
// iLink-App-ClientVersion header (encoded as 0x00MMNNPP).
const ILINK_PROTOCOL_VERSION = '2.1.3';
function buildClientVersion(version) {
    const parts = version.split('.').map((p) => parseInt(p, 10));
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;
    return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}
function baseInfo() {
    return { channel_version: ILINK_PROTOCOL_VERSION };
}
function randomUin() {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    return btoa(String.fromCharCode(...buf));
}
export function buildHeaders(token) {
    const headers = {
        'Content-Type': 'application/json',
        'X-WECHAT-UIN': randomUin(),
        'iLink-App-Id': 'bot',
        'iLink-App-ClientVersion': String(buildClientVersion(ILINK_PROTOCOL_VERSION)),
    };
    if (token) {
        headers['AuthorizationType'] = 'ilink_bot_token';
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}
async function post(baseUrl, path, body, token, timeoutMs = 40000, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
        const resp = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: buildHeaders(token),
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        return (await resp.json());
    }
    finally {
        clearTimeout(timeout);
    }
}
export async function getUpdates(baseUrl, token, getUpdatesBuf, timeoutMs = 40000, signal) {
    const body = {
        get_updates_buf: getUpdatesBuf,
        base_info: baseInfo(),
    };
    try {
        return await post(baseUrl, '/ilink/bot/getupdates', body, token, timeoutMs, signal);
    }
    catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return { ret: 0, msgs: [], get_updates_buf: getUpdatesBuf };
        }
        throw err;
    }
}
export async function sendMessage(baseUrl, token, msg) {
    const body = { msg, base_info: baseInfo() };
    await post(baseUrl, '/ilink/bot/sendmessage', body, token);
}
export async function getConfig(baseUrl, token, userId, contextToken) {
    const body = {
        ilink_user_id: userId,
        context_token: contextToken,
        base_info: baseInfo(),
    };
    return post(baseUrl, '/ilink/bot/getconfig', body, token);
}
export async function sendTyping(baseUrl, token, req) {
    const body = { ...req, base_info: baseInfo() };
    return post(baseUrl, '/ilink/bot/sendtyping', body, token);
}
//# sourceMappingURL=api.js.map