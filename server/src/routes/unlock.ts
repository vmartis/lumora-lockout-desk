import type { FastifyInstance } from "fastify";
import type { AdminApi, UnlockRequest } from "../adminApi.js";
import type { CaseStore } from "../cases.js";
import { allowedVerifications } from "../verification.js";
import { accountParams } from "./cases.js";

const ATTACK_REFUSAL = "Do not unlock: this looks like an attack. Escalate to the Fraud team.";
const SMS_NOT_ALLOWED = "SMS codes are only for customers who contacted us by phone or chat";

// SMS_CHALLENGE needs the challengeId of a code we sent; VIDEO_CALL / BRANCH are only recorded, so they must not carry one.
const unlockBody = {
  type: "object",
  additionalProperties: false,
  required: ["agentId", "verification", "reason"],
  properties: {
    agentId: { type: "string", pattern: "^[A-Za-z0-9._-]{2,32}$" },
    verification: { type: "string", enum: ["SMS_CHALLENGE", "VIDEO_CALL", "BRANCH"] },
    challengeId: { type: "string", format: "uuid" },
    reason: { type: "string", minLength: 5, maxLength: 500 },
  },
  if: { properties: { verification: { const: "SMS_CHALLENGE" } } },
  then: { required: ["challengeId"] },
  else: { not: { required: ["challengeId"] } },
} as const;

const SMS_COOLDOWN_MS = 30_000;
const CHALLENGE_TTL_MS = 10 * 60_000;

export function unlockRoutes(app: FastifyInstance, adminApi: AdminApi, store: CaseStore) {
  // challengeId -> who it was started for and when; only challenges started here, used at most once, valid 10 minutes
  const challengeOwner = new Map<string, { accountId: string; at: number }>();
  const lastSms = new Map<string, number>();

  const notMine = (challengeId: string | undefined, accountId: string) => {
      const c = challengeId ? challengeOwner.get(challengeId) : undefined;
      return !c || c.accountId !== accountId || Date.now() - c.at > CHALLENGE_TTL_MS;
    };

  app.post<{ Params: { accountId: string } }>(
    "/api/cases/:accountId/sms",
    { schema: { params: accountParams } },
    async (req, reply) => {
      const { accountId } = req.params;
      if (store.ticketsFor(accountId).length === 0) return reply.code(404).send({ error: "No open ticket for this account" });
      const { account, verdict } = await store.get(accountId);
      if (account.status !== "LOCKED") return reply.code(409).send({ error: "This account is not locked" });
      if (verdict.kind === "ATTACK") return reply.code(403).send({ error: ATTACK_REFUSAL });
      if (!allowedVerifications(verdict, store.ticketsFor(accountId)).includes("SMS_CHALLENGE")) {
        return reply.code(403).send({ error: SMS_NOT_ALLOWED });
      }
      const since = Date.now() - (lastSms.get(accountId) ?? 0);
      if (since < SMS_COOLDOWN_MS) {
        const wait = Math.ceil((SMS_COOLDOWN_MS - since) / 1000);
        return reply.code(429).send({ error: `A code was just sent. Wait ${wait} s before sending a new one.` });
      }
      lastSms.set(accountId, Date.now());
      const { challengeId } = await adminApi.startSms(accountId);
      challengeOwner.set(challengeId, { accountId, at: Date.now() });
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
      const { verdict } = await store.get(accountId);
      if (verdict.kind === "ATTACK") return reply.code(403).send({ error: ATTACK_REFUSAL });
      const { agentId, verification, challengeId, reason } = req.body;
      if (!allowedVerifications(verdict, store.ticketsFor(accountId)).includes(verification)) {
        return reply.code(403).send({ error: verification === "SMS_CHALLENGE" ? SMS_NOT_ALLOWED : "This verification method is not allowed for this case" });
      }
      let request: UnlockRequest;
      if (verification === "SMS_CHALLENGE") {
        if (notMine(challengeId, accountId)) return reply.code(404).send({ error: "Unknown code request. Send a new code." });
        request = { agentId, verification, challengeId, reason };
      } else {
        request = { agentId, verification, reason }; // video call / branch: the agent records it, no challenge
      }
      const account = await adminApi.unlock(accountId, request);
      if (request.challengeId) challengeOwner.delete(request.challengeId); // one challenge, one unlock
      store.forget(accountId);
      return { accountId: account.accountId, status: account.status };
    },
  );
}
