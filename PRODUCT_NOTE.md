# USERS
**Primary user: the Customer Care agent** at Lumora Bank. We chose them because they give the simplest solution: one person, one workflow.

- **Their job:** resolve a face-login lockout when a customer calls or writes in.
- **How they do it today:** they open the admin tool, look up the account, "piece together from raw login logs what happened", verify the person and unlock. "Every agent does it a bit differently".
- **What it costs:** "some unlock too easily, some send everyone to a branch, and customers wait days". Agents "can't tell the difference quickly" between a customer fumbling with the camera and an attacker.

**Other users, not in focus:** Daniel (Head of Customer Care), the Security / Fraud team and the locked-out customer. They benefit indirectly through faster, consistent, policy-following decisions.

- Assumption: agents work from a list of locked accounts and open tickets, one case at a time.
- Assumption: the agent identifies themselves by typing an agent ID. There is no real login.
- Assumption: the signals in the unlock policy (untrusted device, foreign country, failed liveness) are enough to flag a likely attack.

# WHAT WE ARE GOING TO BUILD
**Value:** a lockout queue and a guided case screen. Together they tell the agent why an account locked and walk them through the unlock policy to the right outcome. This covers the main case.

1. **Open the queue.** The agent sees locked accounts with their matching support tickets, sorted by how long the customer has waited.
2. **Open a case.** The agent sees a plain-English verdict: either "camera / light problem" or "looks like an attack", with the evidence and the next step from the policy.
3. **Act on the case.** For a fumble, the agent verifies the customer by SMS code and unlocks with a reason, then copies a ready-made message telling the customer how to avoid it next time. For an attack, the agent does not unlock and escalates to Fraud.

**Works with:**
- The Identity Admin API: accounts, login attempts, SMS verification, unlock and audit.
- `data/support_tickets.csv`.

Sensitive data is protected like this:
- The API key stays on the server, never in the browser.
- The phone number is shown only masked.
- Only the fields the decision needs are shown. Email, for example, is not shown.
- Personal data never appears in logs or error messages.

**How we will know it helps:**
- An agent goes from opening a case to a policy-correct decision in about a minute.
- Every unlock in the audit log has a verification method and a reason.
- No account flagged as an attack can be unlocked from the tool.

# WHAT IS DELIBERATELY OMITTED
None of these is needed for the MVP. Some may be added if time allows.
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
