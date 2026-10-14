# USERS
**Primary user: the Customer Care agent** at Lumora Bank. Chosen because focusing on them gives the simplest solution: one person, one workflow.

- **Their job:** resolve a face-login lockout when a customer calls or writes in.
- **How they do it today:** they open the admin tool, look up the account, "piece together from raw login logs what happened", verify the person and unlock. "Every agent does it a bit differently".
- **What it costs:** "some unlock too easily, some send everyone to a branch, and customers wait days". Agents "can't tell the difference quickly" between a customer fumbling with the camera and an attacker.

**Other users, not in focus:** Daniel (Head of Customer Care), the Security / Fraud team and the locked-out customer.

- Assumption: agents work from a list of locked accounts and open tickets, one case at a time.
- Assumption: the agent identifies themselves by typing an agent ID. There is no real login.
- Assumption: the signals in the unlock policy (untrusted device, foreign country, failed liveness) are enough to flag a likely attack.

# WHAT WE ARE GOING TO BUILD
**Value:** a lockout queue plus a guided case screen that tells the agent why an account locked and walks them through the unlock policy to the right outcome. It covers the main case.

1. **Open the queue.** The agent sees every locked account that has an open support ticket, with its tickets grouped together. The list is sorted by how long the customer has waited, and attack-risk cases are marked. The status of each account is checked live in the Identity Admin API.
2. **Open a case.** The agent sees a plain-English verdict: either "camera / light problem" or "looks like an attack", with the evidence and the next step from the policy.
3. **Act on the case.**
   - For a fumble, the agent verifies the customer by SMS code (phone or chat only), or records a video call or branch visit (any channel). They then unlock with a reason, and copy a ready-made message telling the customer how to avoid it next time.
   - For an attack, the tool blocks the unlock and shows "escalate to Fraud" with the evidence. It also gives the agent the policy's "we are protecting your account" message.

**Works with:**
- The Identity Admin API: account, login attempts, SMS verification, unlock and audit.
- `data/support_tickets.csv`, mounted read-only, for the queue.
- The rules in `docs/unlock-policy.md`, for the verdict.

The data needs cleaning before use:
- Login attempts are re-sorted by time, and their mixed date formats are normalised.
- Ticket customer IDs (`LB-000083`, `83`, `000003`) are matched to one account.

Sensitive data is protected like this:
- The API key stays on the server.
- We show only what the API returns, with the phone number masked.
- Personal data never appears in logs or error messages.

**How we will know it helps:**
- **Safety:** no account the tool marks as an attack can be unlocked from it. This is covered by a test.
- **Consistency:** every unlock in the audit log used a verification method the policy allows for that ticket's channel.
- **Speed:** I time myself on 3 cases. Going from opening a case to a decision should take under 2 minutes, compared with reading the raw logs.

# WHAT IS DELIBERATELY OMITTED
None of these is needed for the MVP; some may be added if time allows.
- **Team lead dashboard:** it shows the problem but doesn't shorten a customer's wait.
- **Fraud team view:** we only flag escalations, and there is no Fraud system in the environment to send them to.
- **Customer self-service:** it is a Security risk, and the mobile app can't be changed.
- **Biometric reset:** unlock covers most cases, and reset is a rarer, stricter path (video call or branch only).
- **Agent login / roles:** there is no identity provider in the environment, so the agent types their ID.
- **Video call / branch tools:** there is no such system, so the agent only records which method was used.
- **Sending messages to customers:** there is no ticket or email API, so we show a ready-to-copy message instead.
- **Own database / history:** the Identity Admin API's audit log already records every unlock.

# OTHER CONSIDERED APPROACH
**Customer self-service page:** the customer verifies with an SMS code on a web page and unlocks the account themselves.

- **Why not:** Security fears that attackers would unlock accounts this way. The bank is mobile-only, and we can't change the app.
- **When it would be better:** once attack detection is proven reliable and the self-service step can be built into the mobile app. It could then take simple camera/light lockouts away from agents completely.
