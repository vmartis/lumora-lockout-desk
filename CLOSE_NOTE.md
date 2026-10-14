# WHAT A USER CAN DO NOW
A Customer Care agent opens http://localhost:8080, signs in, and works through locked-out customers in one place:
- **Sign in** with a username and password. The name in the header opens a read-only profile (name, agent ID, session end), and **Log out** is next to it.
- **See the queue:** every locked customer with an open ticket (47 right now), longest wait first, with waiting time in plain words ("3 d 2 h"), ticket channels, counts at the top and attack cases in red.
- **Find a customer:** type part of a name (any case, with or without accents) or a customer number ("83", "LB-000083"). The filter stays when going back from a case.
- **Open a case** and get a plain-English verdict, "camera / light problem" or "looks like an attack", with the reasons (failed liveness, untrusted device, other country). Login attempts are in real time order, and suspicious fields are red. An "App out of date" flag shows customers on an old app.
- **Verify and unlock:** SMS code for phone or chat customers, or a recorded video call or branch visit for any channel. Every unlock needs a reason, and the 3 most used reasons can be clicked, with the rest in a "More reasons" list. The unlock is recorded under the signed-in agent and shows in the case's **Account history**.
- **Never unlock an attack:** the tool blocks it and gives an internal **Escalation to the Fraud team** text to copy.
- **Tell the customer what happened:** copy a ready-made message, either camera tips that lead with "update the app", or a neutral "we are protecting your account".
- **See the big picture** on **Summary**: 47 waiting (7 attacks), and **app 4.2.0: 87% of face logins fail, 39 of 40 camera-problem customers are on it.**

# WHAT I CHANGED AFTER TRYING IT MYSELF
- **Reason suggestions:** before, every saved and team reason was shown as a chip, so the row got long and hard to scan. After, only the 3 most used are chips and the rest are in a "More reasons (n)…" dropdown. The agent picks a reason in one click instead of reading a wall of chips.
- More items I added to the plan after testing (customer name filter, agent login and profile, reason suggestions) are logged as friction on branch `friction-draft`. They are not merged, because their wording is still to be confirmed.

# WHAT IS STILL ROUGH
- **Data:** tickets are read from the CSV at start, so new tickets only appear after a restart. The verdict uses the latest 50 attempts, not "the last 3 days" as DECISIONS.md says.
- **Login and security:**
  - Logout only deletes the cookie; the session stays valid up to 8 h, and a removed agent keeps access until then.
  - Every restart or deploy logs everyone out, because there is no fixed `JWT_SECRET`.
  - The cookie is not Secure by default (http localhost).
  - Demo password hashes are in git at default strength.
  - The default `ADMIN_API_KEY` is in docker-compose.
  - There are no roles: every agent sees the lead Summary.
- **Unlock and SMS:**
  - Video call and branch visit are the agent's own claim, with no proof.
  - There is no daily SMS cap per customer.
  - SMS bookkeeping in memory only grows, and a failed send still starts the 30 s cooldown.
- **Reason suggestions:** the personal-data filter is a heuristic (a bare first and last name passes), and saved reasons are per browser with no remove button.
- **Audit:** every case view reads the whole Admin API audit log.
- **Docs and code:**
  - PRODUCT_NOTE.md still says "no real login".
  - PLAN.md "Not now" still lists agent login.
  - `web/README.md` is the Vite template.
  - There is a dead agent-ID check in the unlock form.

# WHAT IT COULD DO NEXT (WITH ONE MORE HOUR)
All MVP slices are done. Unticked "If time allows" items, by priority:
- Biometric reset after a video call or branch visit, so customers whose face no longer matches can re-enrol – 15 min (PLAN.md – N6)
- Agent changes their own password – 15 min (PLAN.md – N10)
- Sign in with the bank's SSO – blocked, no SSO provider in this environment (PLAN.md – N11)
- Agent accounts in the app's own database, so password changes survive restarts – 20 min (PLAN.md – N12)
- A manager adds, disables and re-enables agents and sets roles – 20 min (PLAN.md – N13)

N6, N12 and N10 fit into one hour (about 50 min; N12 before N10, so changed passwords are kept). N13 does not fit, and N11 cannot be built here.
