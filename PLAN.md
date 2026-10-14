# Plan – Lockout Desk (start 19:31 · workflow live by 21:01 · N-items stop 22:06 · close 22:31)

Now: – · Next: /wrap-up ~22:00, then close note · Elapsed: 2:05

**Contract (fixed in S1):** backend Node + TypeScript + Fastify (`server/`), React SPA (`web/`), one Docker image on :8080, tests with vitest.
- `GET /api/health` → `{status}`
- `GET /api/cases` → `[{accountId, name, lockedAt, waitingSince, channels[], ticketCount, risk: "ATTACK"|"FUMBLE"}]`
- `GET /api/cases/:accountId` → `{account (masked phone), tickets[], attempts[] (time-sorted), verdict: {kind, reasons[]}, allowedVerifications[]}`
- `POST /api/cases/:accountId/sms` → `{challengeId}` · `POST /api/cases/:accountId/sms/:challengeId/check {code}` → `{verified}`
- `POST /api/cases/:accountId/unlock {agentId, verification, challengeId?, reason}` → account; **403 when verdict is ATTACK**
- Folder layout: `server/src/{app,adminApi,tickets,normalize,verdict}.ts`, `server/src/routes/{cases,unlock}.ts`, `web/src/pages/{QueuePage,CasePage}.tsx`, `web/src/components/*`, `web/src/lib/*`, root `Dockerfile`, service `lockout-desk` in `docker-compose.yml` (tickets mounted read-only, `ADMIN_API_KEY` from env).

## MVP
| # | Wave | Slice (what the user can do after it) | Depends on | Touches (files/areas) | Done when (check) | Min | ✓ |
|---|---|---|---|---|---|---|---|
| S1 | W0 | Agent opens http://localhost:8080 and sees the Lockout Desk app shell (header with product name + agent ID field) and a health badge from the backend | – | Dockerfile, docker-compose.yml, server/ skeleton, web/ (Vite + shadcn init), routes/cases.ts stub (moved to S2) | `./deploy.sh` passes; `curl :8080/api/health` = UP; page shows header + "API connected"; 1 server test green | 20 | ✓ |
| S2 | W0 | Agent sees the queue of locked accounts from tickets, opens a case with the attempts and a basic verdict, verifies by SMS and unlocks with a reason; an ATTACK case cannot be unlocked | S1 | adminApi.ts, tickets.ts, verdict.ts (basic), routes/*, QueuePage, CasePage | Tests: ticket matching, basic verdict, unlock refused for ATTACK (403). On deploy: unlock a fumble case via SMS code from the outbox; account shows ACTIVE in `/audit` | 25 | ✓ |
| S3 | W1 | Verdicts are trustworthy on messy data: attempts sorted by real time (mixed date formats), all policy signals (untrusted device, foreign country, liveness fail) shown as plain-English reasons | S2 | normalize.ts, verdict.ts + tests (server only) | Unit tests per signal and per date format green; 3 known attack accounts and 3 camera accounts get the right verdict on deploy | 20 | ✓ |
| S4 | W1 | Agent copies a ready-made customer message: "how to avoid it" tips for a fumble, "we are protecting your account" for an attack | S2 | web/src/lib/messages.ts, components/CustomerMessage.tsx, CasePage mount (web only) | Unit test for both messages; copy button puts the text on the clipboard on the deployed app | 15 | ✓ |
| S5 | W2 | Agent picks a verification allowed for the ticket's channel: SMS for phone/chat, or records a video call / branch visit for any channel | S3 | server/src/verification.ts, routes/unlock.ts, components/UnlockPanel.tsx, components/verificationMethods.ts | Tests: SMS refused for email-only case, VIDEO_CALL accepted; on deploy an email-ticket case unlocks with BRANCH and a reason | 15 | ✓ |
| S6 | W2 | Queue is easy to work: sorted by waiting time, risk badges, ticket count + channels, skeleton/empty/error states | S3 | QueuePage.tsx, web/src/lib/queue.ts (sorting already in server/src/cases.ts) | Test: sort order and risk on list; on deploy oldest case is first and attack cases show a red badge | 10 | ✓ |
| S7 | W3 | Agent types part of a customer name and the queue shows only matching customers (ignores case and accents, e.g. "proch" finds "Procházka") | S6 | QueuePage.tsx, web/src/lib/filter.ts (client-side, no server change) | Unit test: case/accent-insensitive match, empty filter shows all; on deploy typing a name narrows the table and "no match" shows a friendly empty state | 10 | ✓ |

Total ≈ 115 min (S7 added) → MVP done ≈ 21:50 if on time; S1 + S2 live ≈ 20:40 (milestone 21:01).
Parallel saves: about 15 min (W1 splits server vs web, W2 splits unlock vs queue; minus ~5 min merge per wave).

## If time allows (after MVP)
| Prio | # | Item (what the user gains) | Why not in MVP | Depends on | Touches (files/areas) | Min | ✓ |
|---|---|---|---|---|---|---|---|
| 1 | N1 | Case flags old app version (4.2.0 has most camera failures) and the message says "update the app" | Nice-to-have hint, not needed for a correct decision | S3, S4 | server/src/appVersion.ts, routes/cases.ts, messages.ts, CasePage.tsx | 10 | ✓ |
| 2 | N2 | Agent finds a case by account ID or customer number (queue filter + "Open case" for callers not in the queue; server still requires an open ticket) | Queue covers all current tickets | S2 | web/src/lib/filter.ts, QueuePage.tsx | 10 | ✓ |
| 3 | N3 | After unlock the case shows the audit entry (who, how, why) and leaves the queue | Unlock already works; this is confirmation | S5 | adminApi.ts, routes/cases.ts, CasePage.tsx | 10 | ✓ |
| 4 | N4 | Agent copies a short Fraud escalation summary (account, evidence) for an attack case | Escalation is already shown; there is no Fraud system to send it to | S3 | web/src/lib/fraud.ts, CopyTextCard.tsx, FraudEscalation.tsx, CasePage.tsx | 10 | ✓ |
| 5 | N5 | Attempts table highlights the suspicious fields (device, country, liveness) per row | Verdict reasons already list them | S3 | server/src/verdict.ts (attemptFlags), routes/cases.ts, components/AttemptsTable.tsx, CasePage.tsx | 15 | ✓ |
| 6 | N14 | When unlocking, the agent picks a reason from the team's most used reasons (read from the Admin API audit log) or from reasons they saved earlier ("Save reason" keeps it in this browser), then can still edit it | Typing a reason works; risk: canned reasons become less specific (policy rule 6 wants the real reason), so the text stays editable and starts empty | N3, S5 | server/src/reasons.ts, routes/reasons.ts, ReasonSuggestions.tsx, UnlockPanel.tsx, web/src/lib/savedReasons.ts | 15 | ✓ |
| 7 | N6 | Biometric reset after VIDEO_CALL or BRANCH (omitted in note – needs my OK) | Rarer, stricter path | S5 | routes/unlock.ts, VerifyPanel.tsx | 15 | ✓ |
| 8 | N7 | Small summary for the lead: lockouts by cause and app version (omitted in note – needs my OK) | Doesn't shorten a customer's wait | S3 | new route + page | 15 | |
| 9 | N8 | Agent logs in with username + password; the agent ID in the audit comes from the login, not a typed field (omitted in note – needs my OK) | Note omits agent login; no user store in the environment, so agents are seeded in a config file (hashed passwords, scrypt) and the session is a JWT via @fastify/jwt | S2 | server/src/auth.ts, app.ts, main.ts, routes/unlock.ts, config/agents.json, docker-compose.yml, web lib/agent.tsx, LoginPage.tsx, AppShell.tsx | 20 | ✓ |
| 10 | N9 | Agent sees a read-only profile page (name, agent ID) (omitted in note – needs my OK) | Only useful once N8 exists | N8 | server/src/auth.ts (/api/me), ProfilePage.tsx, App.tsx, AppShell.tsx | 10 | ✓ |
| 11 | N10 | Agent changes their password (omitted in note – needs my OK) | Needs a writable user store; without a database the change is lost on restart unless a data volume is added | N8 | routes/me.ts, ProfilePage.tsx, docker-compose.yml (volume) | 15 | |
| 12 | N11 | Agent signs in with the bank's SSO (omitted in note – needs my OK; **blocked**: no identity provider in this environment, so it cannot be built or tested here) | Needs an SSO provider (OIDC) to connect to | N8 | auth plugin, LoginPage.tsx | – | |
| 13 | N12 | Agent accounts and passwords survive restarts, stored in the app's own database (Postgres service in docker-compose, one `agents` table, parameterised queries) (omitted in note – needs my OK) | Note omits an own database; the Admin API audit already records unlocks; only needed once N8/N10/N13 exist | N8 | docker-compose.yml, server db module + migration, auth plugin | 20 | |
| 14 | N13 | A manager adds, disables and re-enables agents and sets their role (agent / manager); agents cannot see this page (omitted in note – needs my OK) | Note omits roles; needs login (N8) and a database (N12) first | N8, N12 | routes/agents.ts (manager-only), AgentsPage.tsx, auth plugin (role check) | 20 | |

Rule: an N-item starts only when the whole MVP table is ticked, there are no open fixes in FRICTION.md with higher value, and there are at least (item minutes + 10) minutes left before +2:35 (22:06).

## Not now
Customer self-service · Fraud team view · agent login / roles · video call / branch tools · sending messages to customers · own database / history.
