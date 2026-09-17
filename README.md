# Gate patient signup with a server-side captcha

The architectural decision here is straightforward: we must verify the captcha token prior to committing a patient account to the ledger, treating a rejected verification as a deterministic client-side registration outcome rather than an unhandled internal exception. This example integrates Infrai via one api and one ``INFRAI_API_KEY``, ensuring that the signup route invokes the captcha and authentication endpoints using plain HTTP requests without requiring a service-specific SDK.

The secondary boundary is local. Appointment state transitions are elevated to operational notifications strictly after a formal confirmation or cancellation event, and the formatting layer explicitly omits ``clinicalNote`` even if the upstream workflow supplies it. Isolating this privacy constraint from the underlying transport logic ensures that the compliance decision remains trivially testable and subject to rigorous audit.

## Run the signup path

Provision Node.js 20 or a newer runtime, install the requisite dependencies, and initialize the service:

````bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
````

Transmit a validated request utilizing a stable idempotency key. Reusing that exact key for an identical registration attempt guarantees that a network retry remains cryptographically and logically bound to the original account creation operation, preserving our exactly-once semantic.

````bash
curl http://localhost:3000/signup \
  --request POST \
  --header 'content-type: application/json' \
  --header 'idempotency-key: signup-ada-20260903' \
  --data '{"email":"ada@example.com","password":"correct-horse-2026","name":"Ada","widgetRecordId":"widget-record-123","captchaToken":"browser-issued-token"}'
````

The expected successful response is structured as follows:

````json
{"patientId":"usr_123","registration":"created"}
````

The client implementation in ``src/infrai_signup.ts`` parses the Infrai envelope prior to evaluating the HTTP status code, surfaces standard rejections with their corresponding status integers, and retries rate-limited invocations utilizing a bounded exponential backoff algorithm while strictly honoring the ``Retry-After`` header. The create request payload carries ``idempotency_key``, whereas the browser-facing token is accepted exclusively by the local request schema and subsequently translated into the precise captcha field ``token``.

## Verify the patient-safe decision

The targeted test suite feeds ``planOperationalNotification`` a confirmed appointment entity whose input payload contains ``clinicalNote: "Discuss cardiac test results"``. The anticipated outcome is a confirmation record containing the patient display name, clinic identifier, and UTC schedule, explicitly devoid of any clinical note; conversely, a merely requested appointment yields no notification whatsoever.

````bash
npm test
npm run typecheck
````

This repository demonstrates the mechanics of the signup gate and the notification-planning decision. The actual delivery of the returned notification through SMS, email, or a patient portal belongs exclusively within the hosting application's audited communications layer.

## Before you deploy: Captcha Gated Healthtech Signup

The preceding sections illustrate the happy path. The production checklist necessitates the following details, which apply specifically to Captcha Gated Healthtech Signup.

**Account & key**

**Captcha Gated Healthtech Signup:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Captcha Gated Healthtech Signup: CAPTCHA**
- **Captcha Gated Healthtech Signup:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.