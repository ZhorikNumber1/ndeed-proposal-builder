# Final completeness audit — 2026-10-11

**Not production-ready:** DEMO retained; open commercial blockers below.

## 1. Pricing coverage matrix (ACTIVE: `RUB ALL ПОДПИСКА` / `БЕССРОЧНАЯ`)

| Product | Config | Excel anchor | Domain | SKU | Tests |
|---|---|---|---|---|---|
| PAM UL | 5/25/60/100, sub/perp, cert | I35:K40, E33, A1, E2=0.533 | aligned | C300 UL60 OK | `pricingMatrix`, `controlCases` |
| PAM CS | 10/25, sub/perp, cert | L35:N40, E35 | price aligned | CS10 **not_found**; CS25 OK | same + `skuSpecials` |
| PAM RL | any | D37 broken vs O35:Q40 | `pam_rl_needs_rule` | — | matrix |
| PAM modules / AAPM | ×0.33 | D40–D42 | `pam_module_needs_rule` | — | — |
| AM BASE | 100/500/1000 | I7:K12, N4=121% | aligned | catalog | `pricingMatrix` |
| AM WL=LL / ESSO×2 | module ladder | L7:N12 | aligned | — | `pricingMatrix`, `controlCases` |
| CM Windows | base+agent | I20:N24, N14=132% | aligned | — | `pricingMatrix` |
| CM multi | ×1.4, cert gap | D27:D30 | `cm_multi_needs_rule` | — | `pricingMatrix` |
| ITDR MFA/Mon | annual/perp | I46:N53, no 0.533 | aligned | seeds/catalog | `pricingMatrix` |
| Markup G2&lt;0 | −20% | F=D×(1−G2) | aligned | — | `controlCases` |
| FSTEC kit VAT | D39=3050 | inferred 550/22% | **confirm finance** | no SKU | domain |

## 2. SKU / customer groups

| Finding | Action |
|---|---|
| `PAM-02120010` absent | `not_found` (confirmed) |
| `PAM-02000010` @ specials **B63** | imported as `one_off`, excluded from auto-match |
| `PF-02120010` @ specials **B58** | same |
| `PAM-01120060` @ PAM **C300** | `found` |
| `PAM-02120025` @ PAM **C364** | `found` |
| Import bug (C preferred over B; PPM as AM) | **fixed**; catalog 10328 entries |
| observedSkus bypass in catalogService | **removed** |
| Customer column UI | **added** Step 1 select → `customer.articleGroupId`; drafts default `standard` |

## 3. Content

See `CONTENT_COVERAGE.md`. Gaps: AM.BIOMETRICS, all CM module blurbs, PAM.RL/AAPM/SQL_PROXY. WL no longer pulls LL description.

## 4. DOCX/PDF vs kp2699 / kp2705

Artifacts: `.local/out/visual/` (PNG pages + `COMPARE_REPORT.md`).

| Aspect | Result |
|---|---|
| Media SHA | 4/4 identical |
| Logo left / requisites right / red line | **fixed** this pass |
| Duplicate table title | **fixed** |
| Баранов + exact role (hyphen) | match |
| DEMO banner | retained (refs have none) |
| Signature + stamp | present; DEMO disclaimer above |
| Table count UL60 / CS10 | 2 / 3 match refs |
| CS10 SKU lines | unresolved notes (correct) |
| Frontend PDF | approximate (pdfmake); LibreOffice DOCX→PDF used for visual QA |

## 5. Verification commands

| Command | Result |
|---|---|
| typecheck | PASS (after QuoteLine.lineTotal fix) |
| lint | PASS (4 warnings) |
| unit tests | **99** passed |
| e2e | **6/6** passed |
| build | PASS |

## 6. Decisions still required

1. Official coding for PAM CS capacity 10 (standard pack vs special-order only).
2. Kit VAT line labeling (550 ₽ / 22%).
3. CM multi + certification factor on subscription rows.
4. Enable PAM.RL / modules after Excel row + packaging rules.
5. When to allow non-DEMO export with live seal.
6. Whether more customer-group labels need AM/CM FSTEC columns (PAM has them).
