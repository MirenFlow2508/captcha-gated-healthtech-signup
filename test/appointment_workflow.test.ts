import assert from "node:assert/strict";
import test from "node:test";
import { appointmentUpdateSchema, planOperationalNotification } from "../src/appointment_workflow.js";

test("confirmed appointments produce an operational message without clinical detail", () => {
  const update = appointmentUpdateSchema.parse({
    appointmentId: "apt_204",
    patientDisplayName: "Sam",
    status: "confirmed",
    startsAt: "2026-09-08T09:30:00.000Z",
    clinicName: "Riverside Clinic",
    clinicalNote: "Discuss cardiac test results",
  });

  const notification = planOperationalNotification(update);

  assert.deepEqual(notification, {
    appointmentId: "apt_204",
    kind: "confirmation",
    message: "Sam, your appointment at Riverside Clinic is confirmed for 2026-09-08T09:30:00.000Z.",
  });
  assert.equal(notification?.message.includes(update.clinicalNote ?? ""), false);
});

test("a requested appointment stays silent until its state is settled", () => {
  const update = appointmentUpdateSchema.parse({
    appointmentId: "apt_205",
    patientDisplayName: "Jo",
    status: "requested",
    startsAt: "2026-09-09T10:00:00.000Z",
    clinicName: "Riverside Clinic",
  });

  assert.equal(planOperationalNotification(update), null);
});
