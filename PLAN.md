# Plan – Lockout Desk (start 19:31 · workflow live by 21:01 · N-items stop 22:06 · close 22:31)

Now: – · Next: S2 · Elapsed: 0:30

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
| S2 | W0 | Agent sees the queue of locked accounts from tickets, opens a case with the attempts and a basic verdict, verifies by SMS and unlocks with a reason; an ATTACK case cannot be unlocked | S1 | adminApi.ts, tickets.ts, verdict.ts (basic), routes/*, QueuePage, CasePage | Tests: ticket matching, basic verdict, unlock refused for ATTACK (403). On deploy: unlock a fumble case via SMS code from the outbox; account shows ACTIVE in `/audit` | 25 | |
| S3 | W1 | Verdicts are trustworthy on messy data: attempts sorted by real time (mixed date formats), all policy signals (untrusted device, foreign country, liveness fail) shown as plain-English reasons | S2 | normalize.ts, verdict.ts + tests (server only) | Unit tests per signal and per date format green; 3 known attack accounts and 3 camera accounts get the right verdict on deploy | 20 | |
| S4 | W1 | Agent copies a ready-made customer message: "how to avoid it" tips for a fumble, "we are protecting your account" for an attack | S2 | web/src/lib/messages.ts, components/CustomerMessage.tsx, CasePage mount (web only) | Unit test for both messages; copy button puts the text on the clipboard on the deployed app | 15 | |
| S5 | W2 | Agent picks a verification allowed for the ticket's channel: SMS for phone/chat, or records a video call / branch visit for any channel | S3 | routes/unlock.ts, components/VerifyPanel.tsx | Tests: SMS refused for email-only case, VIDEO_CALL accepted; on deploy an email-ticket case unlocks with BRANCH and a reason | 15 | |
| S6 | W2 | Queue is easy to work: sorted by waiting time, risk badges, ticket count + channels, skeleton/empty/error states | S3 | routes/cases.ts (list), QueuePage.tsx | Test: sort order and risk on list; on deploy oldest case is first and attack cases show a red badge | 10 | |

Total ≈ 105 min → MVP done ≈ 21:45 if on time; S1 + S2 live ≈ 20:40 (milestone 21:01).
Parallel saves: about 15 min (W1 splits server vs web, W2 splits unlock vs queue; minus ~5 min merge per wave).

## If time allows (after MVP)
| Prio | # | Item (what the user gains) | Why not in MVP | Depends on | Touches (files/areas) | Min | ✓ |
|---|---|---|---|---|---|---|---|
| 1 | N1 | Case flags old app version (4.2.0 has most camera failures) and the message says "update the app" | Nice-to-have hint, not needed for a correct decision | S3, S4 | verdict.ts, messages.ts | 10 | |
| 2 | N2 | Agent finds a case by account ID or customer number when the caller is not in the queue | Queue covers all current tickets | S2 | routes/cases.ts, QueuePage.tsx | 10 | |
| 3 | N3 | After unlock the case shows the audit entry (who, how, why) and leaves the queue | Unlock already works; this is confirmation | S5 | routes/unlock.ts, CasePage.tsx | 10 | |
| 4 | N4 | Agent copies a short Fraud escalation summary (account, evidence) for an attack case | Escalation is already shown; there is no Fraud system to send it to | S3 | messages.ts, CustomerMessage.tsx | 10 | |
| 5 | N5 | Attempts table highlights the suspicious fields (device, country, liveness) per row | Verdict reasons already list them | S3 | CasePage.tsx, components/AttemptsTable.tsx | 15 | |
| 6 | N6 | Biometric reset after VIDEO_CALL or BRANCH (omitted in note – needs my OK) | Rarer, stricter path | S5 | routes/unlock.ts, VerifyPanel.tsx | 15 | |
| 7 | N7 | Small summary for the lead: lockouts by cause and app version (omitted in note – needs my OK) | Doesn't shorten a customer's wait | S3 | new route + page | 15 | |

Rule: an N-item starts only when the whole MVP table is ticked, there are no open fixes in FRICTION.md with higher value, and there are at least (item minutes + 10) minutes left before +2:35 (22:06).

## Not now
Customer self-service · Fraud team view · agent login / roles · video call / branch tools · sending messages to customers · own database / history.
