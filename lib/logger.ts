const SECRET_KEYS = /key|secret|password|token|authorization/i;

export function logEvent(kind: string, payload: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SECRET_KEYS.test(key)) continue;
    safe[key] = value;
  }
  console.info(JSON.stringify({ at: new Date().toISOString(), kind, ...safe }));
}
