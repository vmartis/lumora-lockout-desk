import type { FastifyInstance } from "fastify";
import type { AdminApi } from "../adminApi.js";
import { appUpdate } from "../appVersion.js";
import { attemptFlags } from "../verdict.js";
import { summarize } from "../summary.js";
import type { CaseStore } from "../cases.js";
import { allowedVerifications } from "../verification.js";

export const accountParams = {
  type: "object",
  required: ["accountId"],
  properties: { accountId: { type: "string", pattern: "^LB-[0-9]{6}$" } },
} as const;

const isText = (v: unknown): v is string => typeof v === "string";

/** This account's audit entries with only the fields the agent needs; null if the Admin API answer has an odd shape. */
function auditFor(all: unknown, accountId: string) {
  if (!Array.isArray(all) || !all.every((e) => e !== null && typeof e === "object")) return null;
  const mine = all.filter((e) => (e as { accountId?: unknown }).accountId === accountId);
  const clean = mine.map(({ action, agentId, verification, reason, at }) => ({ action, agentId, verification, reason, at }));
  return clean.every((e) => Object.values(e).every(isText)) ? clean : null;
}

export function caseRoutes(app: FastifyInstance, store: CaseStore, adminApi: AdminApi) {
  app.get("/api/cases", async () => store.list());
  app.get("/api/summary", async () => summarize(await store.queueCases()));

  app.get<{ Params: { accountId: string } }>("/api/cases/:accountId", { schema: { params: accountParams } }, async (req, reply) => {
    const { accountId } = req.params;
    // Agents work cases from tickets: no ticket, no lookup (stops browsing the customer base).
    if (store.ticketsFor(accountId).length === 0) return reply.code(404).send({ error: "No open ticket for this account" });
    const [{ account, attempts, verdict }, audit] = await Promise.all([
      store.get(accountId),
      // Proof of past unlocks/resets from the Admin API; the case still shows if the audit cannot be read.
      adminApi
        .getAudit()
        .then((all) => auditFor(all, accountId))
        .catch((err: { status?: number }) => {
          req.log.warn({ adminApiStatus: err?.status }, "audit unavailable");
          return null;
        }),
    ]);
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
        flags: attemptFlags(account, a),
      })),
      verdict,
      allowedVerifications: allowedVerifications(verdict, store.ticketsFor(accountId)),
      appUpdate: appUpdate(account.lastAppVersion),
      audit,
    };
  });
}
