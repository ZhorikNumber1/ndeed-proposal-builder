# PRICING / SKU / KP AUDIT

**Date:** 2026-10-11  
**Branch:** `cursor/indeed-proposal-builder-f84c`  
**App root:** `indeed-proposal-builder/`  
**Rule:** facts from Excel/DOCX/code only; no invented tariffs/SKUs/images.

## Source files (SHA-256 verified)

| File | SHA-256 | Local path (gitignored) |
|---|---|---|
| price-calculator NEW.xlsx | `59a5fdda805f2b558b2c8bfb24a446de0c36c72cee30008f239fb0e70d2e3ce3` | `.local/inputs/price-calculator_NEW.xlsx` |
| артикулы_09.04.2026 копия.xlsx | `c78ba5dce99f9d7a42ee8d5b59da1e46297c410989efb8cb590146cca24ae446` | `.local/inputs/` (+ `reference/` for import) |
| kp2705-…pam10cs….docx | `c8a93b068a88970f20cb1859a2a237a318ccafbaefa80aae31d57b17fc7c539b` | `.local/inputs/` |
| kp2699-…pam60….docx | `c9a42b8a5e370ce1b0aba913292b66c6b453fa2ee54e60f79db542d0e3f61f04` | `.local/inputs/` |

Detailed extracts: `_extract_pricing.md`, `_extract_docx.md`.

### Comment createdAt workaround

Threaded comments in both XLSX lack `createdAt`. **SheetJS** (`xlsx`) reads successfully in this environment. If another parser fails: copy to temp, remove `xl/threadedComments/`, rezip — never mutate the original.

---

## 1. Data flow (code)

```
rawRequest / UI config
  → normalizeRequest.ts / builderReducer
  → Configuration (+ CommercialTerms)
  → calculateOptionSync (calculateOption.ts)
       uses pricing.ts tiers + money.roundUp
       → QuoteLine[] + totals + needs_rule issues
       → resolveSkuSync / resolveArticle (articleResolver.ts)
  → buildProposalDocument.ts (+ contentBlocks.json)
  → DocumentPreview / exportService
       → docxExporter.ts | pdfExporter.ts
```

Autosave: `BuilderProvider` → `draftCollectionRepository` (localStorage v2).  
Export snapshot: `proposalForExport` + `stateRef` (stale-export fix retained).

---

## 2. Pricing — ACTIVE Excel vs domain

**ACTIVE sheets:** `RUB ALL ПОДПИСКА`, `RUB ALL БЕССРОЧНАЯ` (+ `Description` rules).  
**Archive/test:** remaining 17 sheets (OLD / DEPRECATED / test / FX).

| Control | Historical KP | Excel ACTIVE (list, A1≠да, ignore G2) | Domain |
|---|---:|---:|---|
| PAM CS 10 sub 12m | 3 488 380 | **3 488 380** (`ROUNDUP(U×0.533)×10`) | match |
| PAM CS 10 perpetual | 6 544 800 | **6 544 800** | match |
| PAM UL 60 sub 12m | 6 665 940 | **6 665 940** | match |

Cell anchors (subscription sheet): UL tiers `I35:K40`, CS `L35:N40`, factor `E2=0.533`, cert `A1`, uplift `N32=216%`, discount `G2` (**negative = markup**).

Provenance in code: `CALCULATOR_PROVENANCE.sourceHash = 59a5fdda…` (`pricing.ts`).

### Matrix (abbrev.)

| itemId | Calculator | Domain status |
|---|---|---|
| PAM.UL / PAM.CS | ACTIVE ladders | aligned |
| PAM.RL | table `O35:Q40` but sale row `D37` points at UL — **BLOCKER in Excel** | `pam_rl_needs_rule` |
| PAM modules / AAPM | formulas exist (×0.33 etc.) | still `pam_module_needs_rule` until packaging/SKU policy confirmed |
| AM.* | ACTIVE; WL≡LL module ladder | aligned; WL priced as LL |
| CM Windows | ACTIVE | aligned |
| CM multi | ×1.4; sub formulas omit cert | `cm_multi_needs_rule` **BLOCKER** |
| ITDR | no 0.533; separate annual/perp | aligned |
| FSTEC kit | `D39=3050`; no G2 | domain VAT 550/22% **inferred** (distributor comment net 2500) — confirm with finance |

---

## 3. SKU registry

Import: `scripts/importArticles.mts` → `src/data/articlesCatalog.json` (**10298** entries after reimport).

**Customer columns (PAM C–T):** Основные / Газпром / ДЗО ГПБ / Росатом / … — resolver requires explicit `customerGroupId` (default `standard`; does not pick Gazprom/variants by company name).

### Critical finding — CS capacity 10

Official **PAM** sheet CS subscription codes `PAM-0212…` are:  
`1, 5, 9, 15, 20, 25, …` — **no `PAM-02120010`**.  
Perpetual `PAM-0200…` likewise skips 10.  
`PAM-02000010` appears only under `разовыеуникальные артикулы` (special / Michurin), not as a standard pack.

Therefore historical KP №2705 SKUs `PAM-02120010` / `PAM-02000010` are **not** in the official standard registry.  
Resolver must return **`not_found`** (observed fixture alone is insufficient when catalog is loaded). **BLOCKER for exact SKU parity with kp2705** until product/registry clarifies CS-10 coding.

| Capacity | Sub SKU (standard) | Perp SKU | Notes |
|---|---|---|---|
| UL 60 | `PAM-01120060` | (separate series) | OK in registry |
| CS 25 | `PAM-02120025` | `PAM-02000025` | OK after capacity parse fix |
| CS 10 | — | — | **missing in PAM sheet** |
| UL 46 / 77 | — | — | intentionally unresolved (no invent) |

**Importer fix:** `inferPackageCapacity` now parses «подключения - N» and PAM/PF SKU suffix `0{1\|2}{12\|00}{cap}`.

---

## 4. Content blocks

`contentBlocks.json` (35 blocks): PAM UL/CS license texts match kp2699 / kp2705 wording.  
FSTEC kit/VAT blocks only when `PAM.FSTEC_KIT` in calculation items.  
Signature lines use `DEMO_SUPPLIER` — **Алексей Баранов**, title with hyphen as in DOCX.

Gaps: no invention of missing AM/CM module blurbs; missing copy → content gap report / omit.

---

## 5. DOCX / PDF template

Media (byte-identical in both KP): copied to `src/assets/kp-template/`  
`logo.png`, `red-line.png`, `signature.png`, `stamp.png` + `mapping.json`.

| Aspect | kp2705 | kp2699 | App rule |
|---|---|---|---|
| Style base | two tables CS | one table UL | **kp2705 layout**; table count = options |
| Header | logo + requisites + red line | same | Word `Header` + images |
| Signatory | Баранов + title + sig + stamp | same | same; **DEMO banner** + disclaimer near seal |
| Table cols | 6; widths 465/1688/3517/990/1560/1665 | slight width drift | kp2705 widths |
| Totals | Итого col4 / amount col6 | same | aligned in `buildProposalDocument` |

**PDF limitation:** frontend pdfmake approximates header/images; **not** OOXML-identical. Full pixel parity needs server DOCX→PDF — not added (no silent backend). DEMO status retained.

---

## 6. Prior defects (still closed)

PDF init, VAT-across-alternatives, stale export, draft v2 migrate, WL=LL, duplicated issues — see `audit/2026-09-19T1808Z/FIX_REPORT.md`. Must not regress.

---

## 7. Open blockers / questions for user

1. **PAM CS 10 SKU:** `PAM-02120010` absent; `PAM-02000010` / `PF-02120010` only on specials B63/B58 — **not** auto-used. Confirm official coding.  
2. **Kit VAT 22% line:** inferred from 3050/2500 — confirm legal labeling.  
3. **CM multiplatform + cert:** Excel omits cert factor on sub rows — confirm before enabling pricing.  
4. **PAM.RL / PAM modules:** enable only after Excel row fix + SKU packaging rules.  
5. **Release mode:** when to allow export without DEMO banner while using live seal/signature.  
6. **Customer group UI:** **done** — Step 1 select → `customer.articleGroupId` (default `standard`; drafts migrate safely).

---

## 8. Implementation map (this iteration)

| Change | Purpose |
|---|---|
| `pricing.ts` provenance hash/sheets | Trace to ACTIVE Excel |
| `importArticles.mts` capacity + `.local` path | Correct CS packageCapacity; prefer confidential inputs |
| `articlesCatalog.json` reimport | Registry from new SHA |
| `articleResolver.ts` observed⊆catalog | No false SKU from historical KP-only codes |
| `demoSupplier.ts` title hyphen | Exact KP wording |
| `buildProposalDocument.ts` meta/Итого | KP table layout |
| `docxExporter.ts` + `kpTemplateAssets.ts` | Corporate header/media/Inter/widths |
| `pdfExporter.ts` | Closest frontend PDF with same assets |
| `controlCases.test.ts` | Excel prices + SKU blockers |
| Assets under `src/assets/kp-template/` | Authorized originals |
| `scripts/generateControlDocs.mts` | Local DEMO one-/two-table DOCX → `.local/out/` |

---

## 9. Verification results (2026-10-11)

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (4 pre-existing oxlint warnings, 0 errors) |
| `npm run test` | **62 / 62** passed |
| `npm run test:e2e` | **6 / 6** passed |
| `npm run build` | PASS; main chunk ~7.9 MB (catalog in bundle — access risk) |

**Control DOCX** (gitignored `.local/out/`):

| File | Tables (header+body) | Media SHA prefix match vs KP |
|---|---|---|
| `one-table-ul60.docx` | 2 | logo/line/sig/stamp identical |
| `two-table-cs10.docx` | 3 | same |

DEMO banner retained; no commit/push of this iteration without user permission.

**PDF:** frontend pdfmake ≈ Word layout; not OOXML-identical (no server converter).
