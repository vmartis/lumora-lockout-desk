# Friction log (from using the product myself)
| Time | Step in workflow | What felt awkward | Fix | Before -> after | Status |
|---|---|---|---|---|---|
| 20:15 | Signing in / every unlock | Anyone could type any agent ID in the header, so the audit log did not prove who unlocked an account (check) | N8 | Before: agent ID typed into a header field → After: sign in with username + password; the audit agent ID comes from the login session | done |
| 20:15 | Header, after signing in | There was no place to see who I am signed in as and until when (check) | N9 | Before: only a typed agent ID in the header → After: name in the header links to a read-only profile (name, agent ID, username, session end) | done |
| 20:15 | Account | An agent cannot change their own password (check) | N10 | | open |
| 20:15 | Signing in | Agents need one more password instead of signing in with the bank's single sign-on (check) | N11 | | open (blocked: no SSO provider in this environment) |
| 20:18 | Queue → find the caller | Finding the customer who is on the phone meant scrolling through about 46 locked accounts (check) | S7 | Before: scroll the whole queue → After: type part of the name (any case, with or without accents) and the list narrows; the filter stays when coming back from a case | done |
| 20:48 | Agent accounts | Agent accounts and changed passwords would be lost when the app restarts, because there is no database (check) | N12 | | open |
| 20:48 | Team management | A team lead cannot add, disable or change agents from the tool (check) | N13 | | open |
| 21:17 | Unlock → reason | Typing the same unlock reason again for every similar case was slow (check) | N14 | Before: empty reason box, typed every time → After: chips with the team's most used reasons (same method, 2+ customers, 2+ agents) and my saved reasons; the text stays editable | done |
| 21:28 | Unlock → reason (N14 suggestion chips) | All saved and team reason chips are shown at once; the row gets long and hard to scan | Show only the 3 most used reasons as chips, put all others in a dropdown | Before: every saved + team reason as a chip → After: top 3 chips (team by use, then saved) + "More reasons (n)…" dropdown | Fixed |
