import type { FastifyInstance } from "fastify";
import type { AdminApi, UnlockRequest } from "../adminApi.js";
import type { CaseStore } from "../cases.js";
import { accountParams } from "./cases.js";

const ATTACK_REFUSAL = "Do not unlock: this looks like an attack. Escalate to the Fraud team.";

const unlockBody = {
  type: "object",
  additionalProperties: false,
  required: ["agentId", "verification", "challengeId", "reason"],
  properties: {
    agentId: { type: "string", pattern: "^[A-Za-z0-9._-]{2,32}$" },
    verification: { type: "string", enum: ["SMS_CHALLENGE"] }, // VIDEO_CALL / BRANCH come in S5
    challengeId: { type: "string", format: "uuid" },
    reason: { type: "string", minLength: 5, maxLength: 500 },
  },
} as const;

const SMS_COOLDOWN_MS = 30_000;

export function unlockRoutes(app: FastifyInstance, adminApi: AdminApi, store: CaseStore) {
  const challengeOwner = new Map<string, string>(); // challengeId -> accountId, only for challenges started here
  const lastSms = new Map<string, number>();

  async function refuseAttack(accountId: string) {
    const { verdict } = await store.get(accountId);
    return verdict.kind === "ATTACK";
  }
  const notMine = (challengeId: string | undefined, accountId: string) =>
    !challengeId || challengeOwner.get(challengeId) !== accountId;

  app.post<{ Params: { accountId: string } }>(
    "/api/cases/:accountId/sms",
    { schema: { params: accountParams } },
    async (req, reply) => {
      const { accountId } = req.params;
      if (store.ticketsFor(accountId).length === 0) return reply.code(404).send({ error: "No open ticket for this account" });
      const { account, verdict } = await store.get(accountId);
      if (account.status !== "LOCKED") return reply.code(409).send({ error: "This account is not locked" });
      if (verdict.kind === "ATTACK") return reply.code(403).send({ error: ATTACK_REFUSAL });
      const since = Date.now() - (lastSms.get(accountId) ?? 0);
      if (since < SMS_COOLDOWN_MS) {
        const wait = Math.ceil((SMS_COOLDOWN_MS - since) / 1000);
        return reply.code(429).send({ error: `A code was just sent. Wait ${wait} s before sending a new one.` });
      }
      lastSms.set(accountId, Date.now());
      const { challengeId } = await adminApi.startSms(accountId);
      challengeOwner.set(challengeId, accountId);
      return reply.code(201).send({ challengeId });
    },
  );

  app.post<{ Params: { accountId: string; challengeId: string }; Body: { code: string } }>(
    "/api/cases/:accountId/sms/:challengeId/check",
    {
      schema: {
        params: {
          type: "object",
          required: ["accountId", "challengeId"],
          properties: { ...accountParams.properties, challengeId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: { code: { type: "string", pattern: "^[0-9]{6}$" } },
        },
      },
    },
    async (req, reply) => {
      if (notMine(req.params.challengeId, req.params.accountId)) return reply.code(404).send({ error: "Unknown code request. Send a new code." });
      return adminApi.checkSms(req.params.challengeId, req.body.code);
    },
  );

  app.post<{ Params: { accountId: string }; Body: UnlockRequest }>(
    "/api/cases/:accountId/unlock",
    { schema: { params: accountParams, body: unlockBody } },
    async (req, reply) => {
      const { accountId } = req.params;
      if (store.ticketsFor(accountId).length === 0) return reply.code(404).send({ error: "No open ticket for this account" });
      if (await refuseAttack(accountId)) return reply.code(403).send({ error: ATTACK_REFUSAL });
      if (notMine(req.body.challengeId, accountId)) return reply.code(404).send({ error: "Unknown code request. Send a new code." });
      const account = await adminApi.unlock(accountId, req.body);
      store.forget(accountId);
      return { accountId: account.accountId, status: account.status };
    },
  );
}
