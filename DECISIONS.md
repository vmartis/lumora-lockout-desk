# Decisions
| Time | Decision | Options considered | Why | Decided by |
|---|---|---|---|---|
| 2026-10-14 19:53 | Primary user: Customer Care agent; build a lockout queue + guided case (verdict, verify, unlock or escalate) | Other considered approach: customer self-service unlock page | Agent is the simplest single user and the queue + case covers the main case; self-service is a Security risk and the mobile-only app can't be changed | User |
| 2026-10-14 19:57 | Backend: Node + TypeScript + Fastify (with @fastify/static), tests with vitest; one Docker image serves API + SPA on :8080 | Java/Maven (Spring Boot), Python | Same language as the React SPA, small and fast to build in the timebox; Fastify has built-in request schema validation | Claude |
