# Price Calculator Extraction — `price-calculator_NEW.xlsx`

| Field | Value |
|---|---|
| Source | `.local/inputs/price-calculator_NEW.xlsx` (read-only) |
| SHA-256 | `59a5fdda805f2b558b2c8bfb24a446de0c36c72cee30008f239fb0e70d2e3ce3` |
| Extracted | 2026-10-11 |
| Parser | Node `xlsx` (SheetJS) from `node_modules` — **read succeeded without error** |
| Compare | `src/domain/pricing.ts`, `calculateOption.ts`, `src/data/calculatorMapping.json` |

## Parser workaround (Comment createdAt)

Threaded comments under `xl/threadedComments/threadedComment*.xml` have `<threadedComment …>` **without** `createdAt`. Some parsers (ExcelJS / certain SheetJS builds) throw `Comment createdAt is required`.

**This session:** SheetJS `XLSX.readFile(...)` loaded all 20 sheets without that error; cached formula results were available.

**If the error appears:** do **not** mutate the source. Either:

1. Unzip OOXML to a temp dir and parse `xl/worksheets/sheet*.xml` + `xl/workbook.xml`, or
2. Copy to temp, delete `xl/threadedComments/` (and optionally `xl/comments*.xml`), rezip, read the copy.

Verified: comments on `E39` (kit partner/distributor prices) and `K6` (cumulative ladder explanation) live in those threaded-comment files.

---

## 1. All 20 sheets — classification

| # | Sheet name | Class | Role |
|---|---|---|---|
| 1 | `Description` | ACTIVE (rules text) | Commercial rules / mins / multi-year discount caps |
| 2 | `RUB ALL ПОДПИСКА` | **ACTIVE** | Primary RUB subscription (12m) calculator |
| 3 | `RUB ALL БЕССРОЧНАЯ` | **ACTIVE** | Primary RUB perpetual calculator (+ year-2 support block) |
| 4 | `RUB ALL БЕССРОЧНАЯ (test)` | TEST / DEPRECATED | Test copy of perpetual |
| 5 | `PAM RUB 2020` | OLD / DEPRECATED | Legacy PAM-only RUB |
| 6 | `PAM RUB 2019` | OLD / DEPRECATED | Legacy PAM-only RUB |
| 7 | `PAM RUB 2020 DEPRECATED` | OLD / DEPRECATED | Explicitly deprecated |
| 8 | `PAM RUB ПОДПИСКА` | OLD / DEPRECATED | Legacy PAM subscription (factor 0.44 era) |
| 9 | `PAM EUR` | OLD / FX | EUR PAM |
| 10 | `PAM EUR Subscription - OLD` | OLD / DEPRECATED | Old EUR subscription |
| 11 | `AM+CM USD` | OLD / FX | USD AM+CM |
| 12 | `info` | OLD / demo | Tiny ladder toy example |
| 13 | `EA-ESSO` | OLD | Legacy Indeed-Id / ESSO catalog |
| 14 | `Сalculation` | OLD | Legacy Identity calc |
| 15 | `Сalculation-Cert` | OLD | Legacy certified Identity calc (`G2=0.22` labeled **СКИДКА**, not VAT) |
| 16 | `WA` | OLD | Windows Auth legacy |
| 17 | `AKE` | OLD | AirKey Enterprise legacy |
| 18 | `CM` | OLD | Legacy CM catalog |
| 19 | `EA-ESSO-Cert` | OLD | Certified ESSO add-on |
| 20 | `Graphic` | OLD / demo | Tiny chart data |

**Canonical pricing sheets for the proposal builder:** `RUB ALL ПОДПИСКА` + `RUB ALL БЕССРОЧНАЯ` (matches `calculatorMapping.json`).

PAM tier tables on ACTIVE sheets are embedded on those sheets at columns `I–Q` rows 33–40 (not on the `PAM RUB *` sheets).

---

## 2. Global controls (ACTIVE sheets)

| Control | Sub sheet | Perp sheet | Cached value | Semantics |
|---|---|---|---|---|
| Certified flag | `A1` | `A1` | `"НЕТ"` | Compared case-sensitive as `$A$1="да"` → +30% |
| Label | `B1` | `B1` | Сертифицированная версия | |
| Annual factor | `E2` `=53.3%` | *(empty)* | `0.533` | Subscription only: multiply average unit `U` |
| Signed discount | `G2` `=-20%` | `G2` `=-20%` | `-0.2` | Applied as `D*(100%-$G$2)` → **negative = markup** |
| AM price uplift | `N4` `=121%` | `N4` | `1.21` | Multiplies raw AM tier bases |
| CM price uplift | `N14` `=132%` | `N14` | `1.32` | Multiplies raw CM Windows bases |
| PAM price uplift | `N32` `=216%` | `N32` | `2.16` | Multiplies raw PAM bases |
| ITDR price uplift | `N43` `=110%` | `N43` | `1.10` | Multiplies raw ITDR bases |

Certification multiplier in unit formulas:

```text
(1 + IF($A$1="да", 1, 0) * 0.3)   →  c ∈ {1.0, 1.3}
```

---

## 3. PAM UL / CS tier tables (ACTIVE)

Source: both `RUB ALL ПОДПИСКА` and `RUB ALL БЕССРОЧНАЯ` (same raw bases × `$N$32`).

### 3.1 UL — users (`I35:K40`)

| Breakpoint `from` | Cell qty | Rate formula | Rate (RUB) | Cumulative-at-breakpoint |
|---|---|---|---|---|
| 0 | `I35=0` | `J35=$N$32*101000` | **218160** | — (use `qty*J35`) |
| 30 | `I36=30` | `J36=$N$32*92000` | **198720** | `K36=I36*J35` → 6,544,800 |
| 60 | `I37=60` | `J37=$N$32*63000` | **136080** | `K37=K36+(I37-I36)*J36` → 12,506,400 |
| 180 | `I38=180` | `J38=$N$32*58000` | **125280** | `K38=K37+(I38-I37)*J37` → 28,836,000 |
| 240 | `I39=240` | `J39=$N$32*48000` | **103680** | `K39=K38+(I39-I38)*J38` → 36,352,800 |
| 600 | `I40=600` | `J40=$N$32*44000` | **95040** | `K40=K39+(I40-I39)*J39` → 73,677,600 |

Matches `PAM_UL_TIERS` in `pricing.ts`.

### 3.2 CS — concurrent sessions (`L35:N40`)

| Breakpoint `from` | Cell qty | Rate formula | Rate (RUB) | Cumulative-at-breakpoint |
|---|---|---|---|---|
| 0 | `L35=0` | `M35=$N$32*303000` | **654480** | — |
| 10 | `L36=10` | `M36=$N$32*274000` | **591840** | `N36=10*M35` → 6,544,800 |
| 20 | `L37=20` | `M37=$N$32*189000` | **408240** | `N37=N36+10*M36` → 12,463,200 |
| 60 | `L38=60` | `M38=$N$32*173000` | **373680** | `N38=N37+40*M37` → 28,792,800 |
| 80 | `L39=80` | `M39=$N$32*135000` | **291600** | `N39=N38+20*M38` → 36,266,400 |
| 200 | `L40=200` | `M40=$N$32*110000` | **237600** | `N40=N39+(200-80)*M39` → 71,258,400 |

Matches `PAM_CS_TIERS` in `pricing.ts`.

### 3.3 RL — resources (`O35:Q40`) — table present, **row formula broken**

| from | qty cell | Rate formula | Rate | Cum |
|---|---|---|---|---|
| 0 | `O35=0` | `P35=50000*N$32*2` | 216000 | — |
| 100 | `O36=100` | `P36=47000*N$32*2` | 203040 | `Q36=O36*P35` |
| 200 | `O37=200` | `P37=42000*N$32*2` | 181440 | `Q37=…` |
| 600 | `O38=600` | `P38=39000*N$32*2` | 168480 | |
| 800 | `O39=800` | `P39=37000*N$32*2` | 159840 | |
| 2000 | `O40=2000` | `P40=35000*N$32*2` | 151200 | |

**BLOCKER for PAM.RL auto-price:** sale row `D37` uses **UL** refs `I$/J$/K$`, not `O$/P$/Q$`. Domain already flags `pam_rl_needs_rule`.

### 3.4 Unit / cumulative formulas (sale rows)

**Subscription** (`RUB ALL ПОДПИСКА`):

- Qty UL `C33`, CS `C35`, RL `C37`
- Unit UL `D33` (CS `D35` analogous with `L/M/N`):

```excel
=ROUNDUP(
  IFERROR(
    IF(C33>=I$40, K$40+(C33-I$40)*J$40,
    IF(C33>=I$39, K$39+(C33-I$39)*J$39,
    IF(C33>=I$38, K$38+(C33-I$38)*J$38,
    IF(C33>=I$37, K$37+(C33-I$37)*J$37,
    IF(C33>=I$36, K$36+(C33-I$36)*J$36,
                  C33*J$35)))))
    / C33
  , 0) * $E$2 * (1+IF($A$1="да",1,0)*0.3)
, 0)
```

- Line total `E33=D33*C33`
- After discount `F33=D33*(100%-$G$2)`, `G33=F33*C33`

**Perpetual** (`RUB ALL БЕССРОЧНАЯ` `D33`):

```excel
=ROUNDUP( IFERROR( <same cumulative>/C33 , 0) , 0)
 * (1+IF($A$1="да",1,0)*0.3)
```

Note: perpetual applies `ROUNDUP` **inside**, then multiplies `c` (so `c=1.3` can leave decimals). Subscription folds `E2` and `c` **inside** `ROUNDUP`. Matches `unitPriceFromU` in `pricing.ts`.

Ladder meaning (comment on `K6`): cumulative cost of segments / qty = average unit.

---

## 4. Control cases

Assumptions for “list” match: `A1≠"да"` (`c=1`), compare **column E** (pre-discount). File currently has `G2=-20%` → column G is **+20% markup**, not historical KP.

| Case | Historical KP | Recomputed from ACTIVE formulas | Match? |
|---|---:|---:|---|
| PAM CS 10, subscription 12m | 3,488,380.00 | `T=6,544,800`, `U=654,480`, `ROUNDUP(U×0.533)=348,838`, `×10` → **3,488,380** | **SAME** |
| PAM CS 10, perpetual | 6,544,800.00 | `ROUNDUP(U)×10` → **6,544,800** | **SAME** |
| PAM UL 60, subscription 12m | 6,665,940.00 | `T=12,506,400`, `U=208,440`, `ROUNDUP(U×0.533)=111,099`, `×60` → **6,665,940** | **SAME** |

**Why Excel UI might look different today**

| Lever | Current file | Effect on CS10 sub total |
|---|---|---|
| `C35` cached | `50` (not 10) | Different demo qty in sheet |
| `G2` | `-20%` | After-discount `G` = list × 1.20 → 4,186,056 if qty=10 |
| `A1` | `"НЕТ"` | If set to `"да"`, CS10 sub → 4,534,900 |
| Kit `C39` | `1` | Adds 3,050 if included in PAM итого |

Historical KP ≡ **list E totals** with `c=1`, `G2` ignored / zero.

---

## 5. Certification, FSTEC kit, discount, VAT

### Certification

- Flag `A1`: `"да"` → `c=1.3`, else `c=1`.
- Applied inside PAM/AM/CM Windows/ITDR unit formulas (see §2).
- **CM Мультиплатформа** subscription `D27`/`D28`: uses `$E$2` only — **no** `(1+IF($A$1="да"…))` in formula text. **BLOCKER / inconsistency** if cert should apply.

### FSTEC kit (`B39` / `D39` / `E39`)

| Cell | Formula / value |
|---|---|
| `D39` | `=3050` (constant) |
| `E39` | `=D39*C39` |
| `F39`/`G39` | also 3050 path — **discount `G2` not applied** to kit |

Threaded comment on `E39`: partner 2,700 ₽; distributor 2,500 ₽.

**VAT:** Active sheets footnote (`B49` sub / `B51` perp): licenses — «НДС не начисляется». **No explicit 22% / 550 ₽ VAT split for the kit on ACTIVE sheets.** Domain `FSTEC_KIT = {gross:3050, vat:550, vatRate:0.22, net:2500}` aligns with distributor comment net 2500 + implied 22% VAT → 3050, but that decomposition is **inferred**, not a live Excel formula. Mark as **assumption / confirm with finance** if legal labeling requires VAT line.

### Discount semantics

```excel
F = D * (100% - $G$2)
```

- `G2 > 0` → discount (price down).
- `G2 < 0` → **markup** (price up). Current demo value `-20%`.
- Domain `applySignedDiscount(unit, signedDiscount)` with `unit*(1-signedDiscount)` matches this sign convention.

Kit ignores `G2`.

---

## 6. AM — WL vs LL

| Item | Sub row | Perp row | Price table |
|---|---|---|---|
| AM.BASE | `B5`/`D5` → base `I7:K12` | `B5`/`D5` → `I7:K11` | Base tiers |
| AM.WINDOWS_LOGON | `B6`/`D6` → **module** `L7:N12` | `B6`/`D6` → module `L7:N11` | Module tiers |
| AM.LINUX_LOGON | `B16`/`D16` → **same module** `L7:N12` | `B16`/`D16` → same | Module tiers |

**Confirmed:** WL and LL use identical module ladder (`M7:M12` / cumulative `N*`). Domain mapping WL→`AM.LINUX_LOGON` for pricing is consistent with Excel (same rates); SKU/label still differ by row.

ESSO (`D7` sub / `D8` perp): same module table × **extra `*2`** inside ROUNDUP. Biometrics (`D18`): uses **base** table `I/J/K`, not module.

AM tier rates after `ROUNDUP(raw*$N$4,0)` with `N4=121%`:

- Base from 0/500/1000/5000/10000: **3207, 2723, 2178, 1573, 1271** → `AM_BASE_TIERS`
- Module: **2057, 1573, 1150, 908, 605** → `AM_MODULE_TIERS`

**Bug note:** sub `G12` (MDP after-discount total) references `C13` instead of `C12`.

---

## 7. CM Windows vs multiplatform; ITDR

### CM Windows (`B21:B24`, tiers `I20:K24` / modules `L20:N24`)

- Uplift `N14=132%`.
- Base rates: **3036, 2838, 2574, 2310, 1980**; module: **660, 396, 330, 317, 317**.
- Unit formula includes `$E$2` (sub) and cert factor (Windows rows).
- Matches `CM_WINDOWS_*` in domain.

### CM Мультиплатформа (`B27:B30`, tiers `I27:K31` / `L27:N31`)

- Rates = Windows rates × **1.4** (`J27=J20*1.4`, etc.).
- Sub unit formulas: `…*$E$2` **without** cert factor (see §5).
- Domain: `cm_multi_needs_rule` — not fully implemented. Extracted factor 1.4 is usable once product confirms cert behavior.

### ITDR (`B45` MFA, `B46` Monitoring)

- **No** `0.533` factor — subscription tiers are already annual; perpetual sheet has separate higher raw bases.
- Unit: `ROUNDUP(U * c, 0)` with `c` from `A1`.
- Uplift `N43=110%`.
- MFA annual breakpoints: 0,500,1000,3000,5000,10000,50000 → rates 6601…1871.
- Monitoring annual: 0,1000,3000,5000,10000,15000,20000,50000 → 3301…1651.
- Perpetual MFA/Mon rates match `ITDR_*_PERPETUAL` in `pricing.ts` exactly.

---

## 8. Rounding rules

| Step | Excel | Domain |
|---|---|---|
| Tier base × uplift (AM/CM/ITDR) | `ROUNDUP(raw*uplift, 0)` | Precomputed integer rates in `pricing.ts` |
| Average unit `U` | `T/qty` (float) | `cumulativeCost/qty` |
| Subscription unit | `ROUNDUP(U * 0.533 * c [*mult], 0)` | `roundUp` = `Math.ceil(x - 1e-10)` |
| Perpetual unit (PAM/AM/CM) | `ROUNDUP(U,0) * c [*mult]` | `Math.ceil(U) * c * mult` |
| ITDR unit | `ROUNDUP(U * c, 0)` | `unitPriceItdr` |
| Line total | `unit * qty` (no further round) | same |
| Discounted unit | `unit * (1 - G2)` — may have kopecks | `applySignedDiscount` |

---

## 9. Matrix — product/module → cells → notes

| itemId | Sub sheet cells | Perp sheet cells | Notes |
|---|---|---|---|
| AM.BASE | `C5,D5,E5` + tiers `I7:K12` | `C5,D5,E5` + `I7:K11` | `N4=121%` |
| AM.WINDOWS_LOGON | `C6,D6` → module `L7:N12` | `C6,D6` → `L7:N11` | Same rates as LL |
| AM.ESSO | `D7` (`*2`) | `D8` (`*2`) | Row order differs sub vs perp |
| AM.NPS_RADIUS | `D8` | `D11` | mapping.json rows |
| AM.FREERADIUS | `D9` | `D12` | |
| AM.IDP | `D10` | `D9` | |
| AM.IIS | `D11` | `D14` | |
| AM.MDP | `D12` / `G12` bug→`C13` | `D13` | |
| AM.RDP_LOGON | `D13` | `D7` | |
| AM.API | `D14` | `D17` | |
| AM.LDAP_PROXY | `D15` | `D15` | |
| AM.LINUX_LOGON | `D16` | `D16` | ≡ WL tariff |
| AM.ADFS | `D17` | `D10` | |
| AM.BIOMETRICS | `D18` base table | `D18` base table | |
| CM.WINDOWS.BASE | `D21` + `I20:K24` | `D21` | `N14=132%` |
| CM.WINDOWS.AGENT | `D22` + `L20:N24` | `D22` | |
| CM.WINDOWS.AIRCARD | `D23` | `D23` | |
| CM.WINDOWS.DSS | `D24` | `D24` | |
| CM.MULTIPLATFORM.* | `D27:D30`, tiers×1.4 | `D27:D30` | Cert factor missing on sub; domain incomplete |
| PAM.UL | `C33,D33,E33` + `I35:K40` | same | Control UL60 OK |
| PAM.CS | `C35,D35,E35` + `L35:N40` | same | Control CS10 OK |
| PAM.RL | `D37` **wrong table** | `D37` | **BLOCKER** — table `O35:Q40` unused by `D37` |
| PAM.FSTEC_KIT | `C39,D39=3050` | same | No `G2`; VAT split not in sheet |
| PAM.AAPM | `D40` = UL ladder ×0.33×… | similar | Uses UL table + `*0.33` — packaging **BLOCKER** for SKU |
| PAM.ARBITRARY_RESOURCES | `D41=30%*(E34+E36+E38+E40)` | similar | Depends on other PAM lines |
| PAM.SQL_PROXY | `D42` UL×0.33 | similar | Same pattern as AAPM |
| ITDR.MFA | `C45,D45` + `I46:K52` | `I46:K52` perp bases | No 0.533 |
| ITDR.MONITORING | `C46,D46` + `L46:N53` | perp bases | No 0.533 |

Globals: cert `A1`, discount `G2`, annual `E2` (sub only), uplifts `N4/N14/N32/N43`.

---

## 10. Domain vs Excel — summary

| Area | Status |
|---|---|
| PAM UL/CS tiers + 0.533 + cert + ROUNDUP | Aligned; control cases match list price |
| AM/CM Windows/ITDR tiers | Aligned with ACTIVE computed rates |
| Signed discount | Aligned (neg = markup) |
| AM WL≡LL rates | Aligned |
| ESSO ×2 | Aligned |
| CM multi ×1.4 | **Not in domain engine** (`needs_rule`) |
| PAM RL | **BLOCKER** in Excel itself |
| Kit VAT 22% line | **Not explicit in ACTIVE Excel**; domain encodes inferred split |
| Provenance hash in `pricing.ts` | Still old hash `d1fcd56c…` — update when wiring this file |

---

## 11. Machine-readable tiers

See `.local/extracted/pricing-tiers.json` (gitignored under `.local/`).
