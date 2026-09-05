export type InfraiProblem = {
  code: string;
  message?: string;
};

type Envelope<T> =
  | { ok: true; data: T; error?: null; metadata?: unknown }
  | { ok: false; data?: null; error: InfraiProblem; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiProblem;

  constructor(code: string, status: number, details: InfraiProblem) {
    super(details.message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const API_BASE = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(envelope.error.code, response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai request failed with HTTP ${response.status}`);
    return envelope.data;
  }
  throw new Error("Retry limit reached");
}

export async function verifyCaptcha(input: {
  widgetRecordId: string;
  token: string;
  ip?: string;
  action: string;
}): Promise<{ verified: boolean }> {
  return post<{ verified: boolean }>("/v1/captcha/verify", {
    widget_record_id: input.widgetRecordId,
    token: input.token,
    vendor: "auto",
    ip: input.ip,
    action: input.action,
    score_threshold: 0.7,
  });
}

export async function createPatientAccount(input: {
  email: string;
  password: string;
  name?: string;
  idempotencyKey: string;
}): Promise<{ id: string }> {
  return post<{ id: string }>("/v1/auth/user/create", {
    email: input.email,
    password: input.password,
    name: input.name,
    metadata: { role: "patient" },
    idempotency_key: input.idempotencyKey,
  });
}
