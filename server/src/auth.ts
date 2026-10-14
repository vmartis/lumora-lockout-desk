// Agent login: username + password (scrypt hashes from a config file), session as a JWT in an httpOnly cookie.
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";

export interface AgentAccount {
  username: string;
  agentId: string;
  name: string;
  passwordHash: string; // "scrypt:<salt hex>:<hash hex>"
}

export interface Session {
  agentId: string;
  name: string;
  username?: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: Session;
    user: Session;
  }
}

const COOKIE = "session";
const SESSION_SECONDS = 8 * 60 * 60; // one shift
const MAX_FAILURES = 5; // per address + username
// One address trying many usernames is slowed down, never blocked: behind Docker every browser shares one address,
// so a block would lock every agent out.
const SLOW_DOWN_AFTER_ADDRESS_FAILURES = 20;
const SLOW_DOWN_MS = 1000;
const FAILURE_WINDOW_MS = 15 * 60_000;
const PUBLIC_ROUTES = new Set(["/api/health", "/api/login", "/api/logout"]);

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Async so a login never blocks other agents' requests while the hash is computed. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export const loadAgents = (file: string): AgentAccount[] => JSON.parse(readFileSync(file, "utf8"));

// Used when a username does not exist, so a wrong user and a wrong password take the same time.
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));

export function registerAuth(app: FastifyInstance, agents: AgentAccount[], secret: string) {
  const byUsername = new Map(agents.map((a) => [a.username.toLowerCase(), a]));
  // Failed logins per "address|username" and per "address"; someone else's mistakes never lock a real agent out.
  const failures = new Map<string, number[]>();
  const recentFailures = (key: string, now: number) => {
    const list = (failures.get(key) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS);
    if (list.length) failures.set(key, list);
    else failures.delete(key); // keeps the map from growing with old entries
    return list;
  };
  const addFailure = (key: string, now: number) => failures.set(key, [...recentFailures(key, now), now]);

  app.register(fastifyCookie);
  app.register(fastifyJwt, { secret, cookie: { cookieName: COOKIE, signed: false }, sign: { expiresIn: SESSION_SECONDS } });

  // Every matched /api route except the public ones needs a valid session. Unknown paths fall through to 404.
  app.addHook("onRequest", async (req, reply) => {
    const route = req.routeOptions?.url;
    if (!route || !route.startsWith("/api/") || PUBLIC_ROUTES.has(route)) return;
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Please log in." });
    }
  });

  app.post<{ Body: { username: string; password: string } }>(
    "/api/login",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1, maxLength: 64 },
            password: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const username = req.body.username.trim().toLowerCase();
      const userKey = `${req.ip}|${username}`;
      const ipKey = req.ip;
      const now = Date.now();
      if (recentFailures(userKey, now).length >= MAX_FAILURES) {
        return reply.code(429).send({ error: "Too many wrong passwords. Try again in 15 minutes or ask your team lead." });
      }
      const slowDown = recentFailures(ipKey, now).length >= SLOW_DOWN_AFTER_ADDRESS_FAILURES;
      // Count this attempt as a failure BEFORE the slow password check, so parallel guesses cannot race past the limit.
      addFailure(userKey, now);
      addFailure(ipKey, now);
      if (slowDown) await new Promise((r) => setTimeout(r, SLOW_DOWN_MS));
      const agent = byUsername.get(username);
      const ok = (await verifyPassword(req.body.password, agent?.passwordHash ?? DUMMY_HASH)) && agent !== undefined;
      if (!ok || !agent) {
        return reply.code(401).send({ error: "Wrong username or password." });
      }
      failures.delete(userKey); // success: forget this user's failures, including the one counted above
      failures.get(ipKey)?.pop(); // and do not count this successful login against the address
      const session: Session = { agentId: agent.agentId, name: agent.name };
      const token = await reply.jwtSign({ ...session, username: agent.username });
      // Secure needs HTTPS; this environment runs on http://localhost, so it is switched on by COOKIE_SECURE=true.
      const secure = process.env.COOKIE_SECURE === "true";
      reply.setCookie(COOKIE, token, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
      return session;
    },
  );

  app.post("/api/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: "/", httpOnly: true, sameSite: "strict" });
    return { ok: true };
  });

  // Read-only profile (N9): who is signed in and when the session ends. Nothing here can be changed.
  app.get("/api/me", async (req) => {
    const exp = (req.user as Session & { exp?: number }).exp;
    return {
      agentId: req.user.agentId,
      name: req.user.name,
      username: req.user.username ?? "",
      sessionEndsAt: exp ? new Date(exp * 1000).toISOString() : "",
    };
  });
}
