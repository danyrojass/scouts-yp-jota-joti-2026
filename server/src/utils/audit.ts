import { prisma } from "@/lib/prisma";

export type AuditActor = {
  type: string;
  id?: string;
};

/**
 * Records an administrative operation for the audit trail. Never throws; a
 * failed audit write must not break the business operation.
 */
export async function audit(
  action: string,
  entity: string,
  entityId: string | null,
  actor: AuditActor,
  details?: Record<string, unknown>,
  extra?: { eventId?: string; teamId?: string; userId?: string }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        actorType: actor.type,
        actorId: actor.id ?? null,
        userId: extra?.userId ?? (actor.type === "admin" ? actor.id ?? null : null),
        teamId: extra?.teamId ?? (actor.type === "team" ? actor.id ?? null : null),
        eventId: extra?.eventId ?? null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Audit write failed:", err);
  }
}