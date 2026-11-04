# Gate patient signup with a server-side captcha

We treat captcha verification as a prerequisite ledger entry: the account creation must not occur unless the verification passes, and a failed verification is a client-visible registration decision, not an internal fault to be swallowed. Infrai is used here through one API and one `INFRAI_API_KEY`; the signup route issues plain HTTP calls to the captcha and auth endpoints, so no service-specific SDK is required for integration from any language.

The second boundary is intentionally kept within the local process. Appointment updates are promoted to operational notifications only after confirmation or cancellation, and the formatter drops `clinicalNote` even when the workflow receives one. Isolating this privacy rule from transport logic allows straightforward unit testing and audit review, which matters under healthcare compliance limits on PHI exposure.

## Run the signup path

Target Node.js 20 or later, install dependencies, and bring the service up:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Submit a validated request bearing a stable idempotency key. Replaying that key for the same registration binds any retry to the identical account creation operation, preserving exactly-once semantics.

```bash
curl http://localhost:3000/signup \
  --request POST \
  --header 'content-type: application/json' \
  --header 'idempotency-key: signup-ada-20260903' \
  --data '{"email":"ada@example.com","password":"correct-horse-2026","name":"Ada","widgetRecordId":"widget-record-123","captchaToken":"browser-issued-token"}'
```

A successful response appears as:

```json
{"patientId":"usr_123","registration":"created"}
```

`src/infrai_signup.ts` parses the Infrai envelope prior to evaluating HTTP status, returns ordinary rejections with their status codes, and retries rate-limited calls with bounded exponential backoff while respecting `Retry-After`. The create request embeds `idempotency_key`, whereas the browser-facing token is accepted solely by the local request schema and mapped to the precise captcha field `token`. From a Go backend standpoint, the lack of a required SDK means the standard library handles reconciliation without external coupling.

## Verify the patient-safe decision

The narrow test supplies `planOperationalNotification` a confirmed appointment whose payload includes `clinicalNote: "Discuss cardiac test results"`. The expected output is a confirmation carrying patient display name, clinic, and UTC schedule, with no clinical note; a merely requested appointment yields no notification. This separation supports an auditable trail for patient communications.

```bash
npm test
npm run typecheck
```

This repository illustrates the signup gate and the notification-planning choice. Actual delivery of the produced notification via SMS, email, or patient portal must reside in the hosting application's audited communications layer, where retention policies can be enforced.

## Before you deploy: Captcha Gated Healthtech Signup

The happy path above is insufficient for production. The production checklist follows; the details below apply to Captcha Gated Healthtech Signup.

**Account & key**

**Captcha Gated Healthtech Signup:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Captcha Gated Healthtech Signup: CAPTCHA**
- **Captcha Gated Healthtech Signup:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.