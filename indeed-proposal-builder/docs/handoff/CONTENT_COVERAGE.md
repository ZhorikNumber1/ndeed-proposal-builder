# Content blocks coverage matrix

**Source:** `src/data/contentBlocks.json` (35 blocks)  
**Selection rule:** `buildProposalDocument.ts` matches `condition.product` / `metric` / `has_item` against **actual calculation + selected modules**, not free-text request words.  
**WL note:** calculation may price WL as LL; description selection skips synthetic `AM.LINUX_LOGON` when only `AM.WINDOWS_LOGON` was chosen.

## Covered

| Product / item | Block id(s) | Source |
|---|---|---|
| Intro AM/CM/PAM/ITDR | `intro.*` | S07/S03/S04/S02 |
| PAM UL license text | `pam.license.ul` | **KP2699** |
| PAM CS license text | `pam.license.cs` | **KP2705** |
| PAM FSTEC kit VAT + contents | `pam.fstec.vat`, `pam.fstec.contents` | S05 (only if kit in calc) |
| AM.BASE + modules (ADFS, ESSO, IIS, NPS, FreeRADIUS, WL, RDP, IdP, API, LDAP, MDP, LL) | `am.*` | S01 |
| ITDR Monitoring | `itdr.monitoring` | S02 |
| ITDR MFA (+ description) | `itdr.mfa`, `itdr.description` | S02 (MFA only if selected) |
| Validity / table headers / license notes / warranty / signature | `validity.*`, `table.*`, `license.*`, `common.*` | S03–S06 / KP |

## Gaps (no invented copy)

| Item | Status |
|---|---|
| AM.BIOMETRICS | **GAP** — no dedicated block |
| CM.WINDOWS.* (base/agent/aircard/dss) | **GAP** — only intro.cm |
| CM.MULTIPLATFORM.* | **GAP** + pricing `needs_rule` |
| PAM.RL | **GAP** + pricing `needs_rule` |
| PAM.AAPM / PAM.SQL_PROXY | **GAP** + packaging `needs_rule` |

## Anti-duplication checks

- Warranty (`common.warranty`) emitted once per document.
- FSTEC kit/VAT paragraphs only when `PAM.FSTEC_KIT` present.
- ITDR MFA blocks require `has_item: ITDR.MFA`.
- Customer names/numbers from KP samples are never defaults.
