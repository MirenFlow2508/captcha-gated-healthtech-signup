import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createPatientAccount, InfraiError, verifyCaptcha } from "./infrai_signup.js";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1).max(80).optional(),
  widgetRecordId: z.string().min(1),
  captchaToken: z.string().min(1),
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/signup") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = signupSchema.parse(await readJson(request));
    const idempotencyKey = request.headers["idempotency-key"]?.toString() ?? randomUUID();
    const captcha = await verifyCaptcha({
      widgetRecordId: input.widgetRecordId,
      token: input.captchaToken,
      ip: request.socket.remoteAddress,
      action: "patient_signup",
    });
    if (!captcha.verified) {
      send(response, 422, { error: "Captcha verification rejected" });
      return;
    }

    const patient = await createPatientAccount({
      email: input.email,
      password: input.password,
      name: input.name,
      idempotencyKey,
    });
    send(response, 201, { patientId: patient.id, registration: "created" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(response, 400, { error: "Invalid signup request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "Registration could not be completed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Signup service listening on http://localhost:${port}`));
}
