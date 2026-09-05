import { z } from "zod";

export const appointmentUpdateSchema = z.object({
  appointmentId: z.string().min(1),
  patientDisplayName: z.string().min(1).max(80),
  status: z.enum(["requested", "confirmed", "cancelled"]),
  startsAt: z.string().datetime(),
  clinicName: z.string().min(1).max(120),
  clinicalNote: z.string().optional(),
});

export type AppointmentUpdate = z.infer<typeof appointmentUpdateSchema>;

export type OperationalNotification = {
  appointmentId: string;
  kind: "confirmation" | "cancellation";
  message: string;
};

export function planOperationalNotification(
  update: AppointmentUpdate,
): OperationalNotification | null {
  if (update.status === "requested") return null;

  const schedule = new Date(update.startsAt).toISOString();
  const kind = update.status === "confirmed" ? "confirmation" : "cancellation";
  const action = update.status === "confirmed" ? "is confirmed for" : "was cancelled for";

  return {
    appointmentId: update.appointmentId,
    kind,
    message: `${update.patientDisplayName}, your appointment at ${update.clinicName} ${action} ${schedule}.`,
  };
}
