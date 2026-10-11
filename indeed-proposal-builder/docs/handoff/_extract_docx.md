# KP DOCX template extraction

Extracted from two Indeed commercial proposals (user-authorized for KP styling). Media binaries are originals — not invented or regenerated.

| Source file | SHA-256 |
|---|---|
| `kp2705-Oilgaztet-pam10cs-TT-sep2026.docx` | `c8a93b068a88970f20cb1859a2a237a318ccafbaefa80aae31d57b17fc7c539b` |
| `kp2699-KSK-IT-pam60-MN-sep2026.docx` | `c9a42b8a5e370ce1b0aba913292b66c6b453fa2ee54e60f79db542d0e3f61f04` |

Working copies under `.local/inputs/` (read-only for this extract). Customer counterparty names appear only as regression anchors below; **do not** put them into demo defaults.

---

## 1. Media inventory

Both packages contain exactly four images under `word/media/`. **All four are byte-identical across the two DOCX** (`cmp` equal; same SHA-256).

| Original | Role | Canonical copy | SHA-256 | Px | Bytes |
|---|---|---|---|---|---|
| `image1.png` | logo | `src/assets/kp-template/logo.png` | `263b648733ef67dd729e8b0f2ee97f2be19d4e63161b7bc219f2da558e5e6ae3` | 823×167 RGBA | 8407 |
| `image2.png` | red-line | `src/assets/kp-template/red-line.png` | `8b13a5ce530633a60223bbca61198cdbbc03c14e7bf09fe5a297df668ca6c86c` | 2048×5 RGBA | 139 |
| `image3.png` | signature | `src/assets/kp-template/signature.png` | `3d9b24a844aed72cdc3a2d8b34be9b798abf1f711047ab0bd773fe3f16bf72c0` | 327×126 RGBA | 4733 |
| `image4.png` | stamp | `src/assets/kp-template/stamp.png` | `cde001557da885b1f9837fff5f14f1cb7944cc68b79d9d1af0607048ac75df7f` | 497×497 RGB | 41020 |

Also kept under original names (`image1.png`…`image4.png`) plus `mapping.json` in the same folder.

### Relationship mapping

**Header** (`word/header1.xml` + `word/_rels/header1.xml.rels`):

| rId | Target | Role |
|---|---|---|
| rId1 | `media/image1.png` | logo (left, floating) |
| rId2 | `media/image2.png` | red line under requisites |

**Body** (`word/document.xml` + `word/_rels/document.xml.rels`):

| Doc | rId | Target | Role |
|---|---|---|---|
| kp2705 | rId11 | `media/image3.png` | signature |
| kp2705 | rId12 | `media/image4.png` | stamp |
| kp2699 | rId12 | `media/image3.png` | signature |
| kp2699 | rId13 | `media/image4.png` | stamp |

No `word/footer*.xml` in either package.

---

## 2. Header structure

No separate footer part. One default header referenced from `sectPr`:

```xml
<w:headerReference w:type="default" r:id="rId9"/>
```

Header repeats on all pages (`w:type="default"`; no `w:titlePg` in settings; no even/odd headers).

### Layout (top → bottom)

1. **Logo** — floating `wp:anchor`, `behindDoc="1"`, left of column (`posOffset` 0 / slight vertical −9507 EMU). Display ≈ 119.25×24.22 pt.
2. **Legal name** (right-aligned, Inter Bold 8 pt / `w:sz="16"`):
   - `Общество с ограниченной ответственностью «Индид» (ООО «Индид»)`
3. **Address** (right-aligned, Inter Light 8 pt):
   - `191186, г. Санкт-Петербург, вн.тер.г. Муниципальный округ Дворцовый округ, ул.Итальянская, д. 17, литера А, помещ. 1НC`
4. **Requisites** (right-aligned, Inter Light 8 pt):
   - `ИНН 7801540219 | ОГРН 1117847053103 | КПП 784001001`
5. **Red line** — floating image under requisites, ≈ 480.08×1.00 pt, solid `#FF0000` strip (`image2.png`). Paragraph also carries `w:color w:val="ff0000"`.

Indent: company/address lines `w:left="2880"`; requisites line `w:left="2160"` + `w:firstLine="720"`. Alignment `jc=right`.

Header XML text is the same in both DOCX (media rIds identical); packaging noise may differ byte-wise in `header1.xml`.

---

## 3. Signatory

Exact wording from body (combine split runs/paragraphs):

| Field | Exact text |
|---|---|
| Closing | `С Уважением,` |
| Title | `Управляющий управляющей организации АО «Индид» - Индивидуальный предприниматель` |
| Name | `Алексей Баранов` |

kp2705 splits title across two paragraphs; name shares a right-aligned paragraph with the stamp image. kp2699 splits title into two paragraphs (`…АО «Индид»` / `- Индивидуальный предприниматель`) then name + stamp.

**Media roles:** `signature.png` = handwritten signature (blue ink); `stamp.png` = circular ООО «Индид» seal; not interchangeable with logo/line.

Display sizes (body):

- Signature ≈ 1.66×0.71 in (1516284×652756 EMU)
- Stamp ≈ 1.43×1.38 in (1304925×1263600 EMU)

---

## 4. Page setup (`sectPr`)

| Property | kp2705 (PAM CS) | kp2699 (PAM UL) |
|---|---|---|
| `pgSz` | w=11909 h=16834 portrait (A4) | same |
| `pgMar` top/right/bottom/left | 1440 / 1440 / 1440 / 1440 | 1157 / 1440 / 512 / 1440 |
| header / footer distance | 720 / 720 | 720 / 720 |
| gutter | 0 | 0 |
| `pgNumType` | start=1 | start=1 |
| cols | 1 | 1 |
| section type | `nextPage` | `nextPage` |
| header | default, repeats | default, repeats |
| footer part | none | none |

Twips → mm: page ≈ 210.06×296.93 mm; margin 1440 twips = 1.0 in = 25.4 mm.

---

## 5. Table structure (6-column price table)

### Meta row (2 columns, white borders — “invisible” table)

| Col widths (twips) kp2705 | Content pattern |
|---|---|
| 4514 \| 4515 | `Исх. №{n} … от {date}` \| counterparty name |

Borders: all white `#FFFFFF` sz=8. Font Inter Bold 10 pt (`sz=20`).

### Price table (6 columns)

**Canonical widths from kp2705** (sum 9885 twips ≈ 174.4 mm; `tblInd` −50; fixed layout):

| # | Header | Width twips | ≈ mm |
|---|---|---|---|
| 1 | № | 465 | 8.2 |
| 2 | Артикул | 1688 | 29.8 |
| 3 | Позиция | 3517 | 62.0 |
| 4 | Кол-во, шт. | 990 | 17.5 |
| 5 | Цена, руб. РФ | 1560 | 27.5 |
| 6 | Стоимость, руб. РФ | 1665 | 29.4 |

kp2699 variant widths: `405, 1698, 3297, 990, 1620, 1710` (sum 9720) — same headers/semantics; prefer kp2705 as layout anchor when both differ.

**Borders:** black `#000000`, `single`, `sz=8` (all outer + insideH/V).

**Fonts:** Inter, 10 pt (`w:sz="20"`). Header row bold; data row regular; «Итого» label + total amount bold.

**Alignment:** columns 4–6 centered (`jc=center`); 1–3 default (left). Cells `vAlign=center`. Table style cell margins 100 twips (from generated styles StGen*).

**Rows pattern:** header → N data lines → totals row (`Итого` in col 4, amount in col 6).

Title above table (document body, not table): e.g. `Таблица 1. Расчет РРЦ годовых лицензий*` — Inter Bold 10 pt. Document title `Коммерческое предложение` — Inter 18 pt (`sz=36`), centered.

---

## 6. Body licensing descriptions (exact Russian)

### PAM CS (kp2705)

```
Лицензия на количество одновременных подключений (concurrent sessions, CS). Лицензия ограничивает число сессий (подключений), которые можно открыть в Indeed PAM одновременно. Учитываются все активные сессии. При этом число пользователей РАМ и число зарегистрированных ресурсов в системе не ограничено.
```

### PAM UL (kp2699)

```
Пользовательская лицензия (user license, UL). Лицензия дает право на использование Indeed PAM заданному количеству пользователей. Каждый сотрудник, получающий доступ к ресурсам с помощью привилегированных учетных записей, должен иметь пользовательскую лицензию PAM. Количество пользовательских лицензий может быть изменено в сторону увеличения путем приобретения дополнительного количества лицензий. Пользовательская лицензия может быть отозвана у одного сотрудника и выдана другому.
```

These match `contentBlocks.json` ids `pam.license.cs` / `pam.license.ul`.

### Shared footnotes / warranty (kp2705 extras)

- `*В стоимость лицензий включена гарантия на ПО и доступ к обновлениям в течение срока действия лицензии. НДС не облагается.`
- `**В стоимость лицензий включена гарантия на ПО и доступ к обновлениям в течение 12 месяцев. НДС не облагается.`
- FSTEC kit note / contents (DVD, box, формуляр, сертификат №4667) — present in kp2705; not in kp2699 body.
- Warranty bullet list + support phone/URL identical in spirit across both.

Intro PAM (kp2705): validity «в течение месяца»; kp2699: «в течение 30 дней».

---

## 7. SKU / price regression anchors

Customer names are source-file facts only — not for demo defaults.

### kp2705 — PAM CS 10

| Table | SKU | Position (exact) | Qty | Price | Cost |
|---|---|---|---|---|---|
| Таблица 1 (годовые) | `PAM-02120010` | Неисключительные права на программу для ЭВМ Indeed Privileged Access Manager (пакет на одновременные подключения - 10) на 1 (один) год | 1 | 3 488 380,00 | 3 488 380,00 |
| Таблица 1 Итого | | | | | 3 488 380,00 |
| Таблица 2 (бессрочные) | `PAM-02000010` | Неисключительные права на программу для ЭВМ Indeed Privileged Access Manager (пакет на одновременные подключения - 10) | 1 | 6 544 800,00 | 6 544 800,00 |
| Таблица 2 Итого | | | | | 6 544 800,00 |

Meta: `Исх. №2705` / `от 18.09.2026 г.`

### kp2699 — PAM UL 60

| Table | SKU | Position (exact) | Qty | Price | Cost |
|---|---|---|---|---|---|
| Таблица 1 (срочные) | `PAM-01120060` | Неисключительные права на Программу для ЭВМ Indeed Privileged Access Manager (пакет на - 60 пользователей) на 1 (один) год | 1 | 6 665 940,00 | 6 665 940,00 |
| Итого | | | | | 6 665 940,00 |

Meta: `Исх. №2699` / `от 18.09.2026 г`

Note casing: UL line uses `Программу` (capital П); CS lines use `программу`.

---

## 8. Implications for current exporters

| Area | Template (DOCX source) | Current `docxExporter` / `pdfExporter` |
|---|---|---|
| Font | Inter / Inter Light | DOCX: Times New Roman; PDF: Roboto |
| Header | Logo + 3 requisites lines + red-line image, repeats | DOCX: centered text lines only; PDF: text + canvas red line (no logo image) |
| Media | logo, red-line, signature, stamp binaries | Not wired; PDF draws a line instead of `red-line.png` |
| Signatory | Title + signature + stamp + name | Text-only if present in blocks |
| Price table | 6 cols, fixed widths, black grid, Inter 10 pt | Generic table; not yet matching column set/widths |
| Page | A4, ~1" margins (kp2705) | pdfmake defaults / not pinned to extracted sectPr |

Assets ready for styling work: `src/assets/kp-template/{logo,red-line,signature,stamp}.png` + `mapping.json`.

---

## 9. Files written

```
indeed-proposal-builder/src/assets/kp-template/
  logo.png
  red-line.png
  signature.png
  stamp.png
  image1.png … image4.png   # original package names
  mapping.json
indeed-proposal-builder/docs/handoff/_extract_docx.md
```
