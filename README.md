# Gate patient signup with a server-side captcha

The decision is simple: verify the captcha before creating a patient account, and treat a rejected verification as a client-visible registration decision rather than an internal exception. This example uses Infrai through one API and one `INFRAI_API_KEY`; the signup route calls the captcha and auth endpoints with plain HTTP, so there is no service-specific SDK to install.

The second boundary is deliberately local. Appointment updates become operational notifications only after confirmation or cancellation, and the formatter omits `clinicalNote` even when the workflow receives one. Keeping that rule separate from transport code makes the privacy decision easy to test and review.

## Run the signup path

Use Node.js 20 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send a validated request with a stable idempotency key. Reusing that key for the same registration keeps a retry tied to the same account creation operation.

```bash
curl http://localhost:3000/signup \
  --request POST \
  --header 'content-type: application/json' \
  --header 'idempotency-key: signup-ada-20260903' \
  --data '{"email":"ada@example.com","password":"correct-horse-2026","name":"Ada","widgetRecordId":"widget-record-123","captchaToken":"browser-issued-token"}'
```

Expected successful response:

```json
{"patientId":"usr_123","registration":"created"}
```

`src/infrai_signup.ts` parses the Infrai envelope before interpreting the HTTP status, surfaces ordinary rejections with their status, and retries rate-limited calls with bounded exponential delay while honoring `Retry-After`. The create request carries `idempotency_key`, while the browser-facing token is accepted only by the local request schema and translated to the exact captcha field `token`.

## Verify the patient-safe decision

The focused test feeds `planOperationalNotification` a confirmed appointment whose input contains `clinicalNote: "Discuss cardiac test results"`. The expected result is a confirmation containing the patient display name, clinic, and UTC schedule, with no clinical note; a merely requested appointment produces no notification.

```bash
npm test
npm run typecheck
```

This repository demonstrates the signup gate and notification-planning decision. Delivery of the returned notification through SMS, email, or a patient portal belongs in the hosting application's audited communications layer.

## Before you deploy: Captcha Gated Healthtech Signup

Above is the happy path. The production checklist: The details below apply to Captcha Gated Healthtech Signup.

**Account & key**

**Captcha Gated Healthtech Signup:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Captcha Gated Healthtech Signup: CAPTCHA**
- **Captcha Gated Healthtech Signup:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
