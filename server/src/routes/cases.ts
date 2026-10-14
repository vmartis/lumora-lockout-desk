import type { FastifyInstance } from "fastify";
import type { CaseStore } from "../cases.js";

export const accountParams = {
  type: "object",
  required: ["accountId"],
  properties: { accountId: { type: "string", pattern: "^LB-[0-9]{6}$" } },
} as const;

export function caseRoutes(app: FastifyInstance, store: CaseStore) {
  app.get("/api/cases", async () => store.list());

  app.get<{ Params: { accountId: string } }>("/api/cases/:accountId", { schema: { params: accountParams } }, async (req, reply) => {
    const { accountId } = req.params;
    // Agents work cases from tickets: no ticket, no lookup (stops browsing the customer base).
    if (store.ticketsFor(accountId).length === 0) return reply.code(404).send({ error: "No open ticket for this account" });
    const { account, attempts, verdict } = await store.get(accountId);
    return {
      account: {
        accountId: account.accountId,
        fullName: account.fullName,
        country: account.country,
        status: account.status,
        lockedAt: account.lockedAt,
        registeredPhone: account.registeredPhone,
        lastAppVersion: account.lastAppVersion,
      },
      tickets: store.ticketsFor(accountId),
      // Only what the decision needs: no raw device ids.
      attempts: attempts.map((a) => ({
        attemptId: a.attempt_id,
        timestamp: a.timestamp,
        deviceModel: a.device_model,
        deviceTrusted: a.device_id === account.trustedDeviceId,
        appVersion: a.app_version,
        country: a.ip_country,
        livenessScore: a.liveness_score,
        matchScore: a.match_score,
        result: a.result,
        failReason: a.fail_reason,
      })),
      verdict,
      allowedVerifications: verdict.kind === "ATTACK" ? [] : ["SMS_CHALLENGE"],
    };
  });
}
