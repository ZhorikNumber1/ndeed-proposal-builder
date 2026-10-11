import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  ImageRun,
  VerticalAlign,
  TableLayoutType,
} from 'docx';
import type { ExportService, ProposalDocument, DocumentBlock } from '../domain/types';
import { KP_IMAGE_SIZES, KP_TABLE_COL_TWIPS, loadKpTemplateImages } from './kpTemplateAssets';

const FONT = 'Inter';
const RED = 'E30613';
const BLACK_BORDER = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const CELL_BORDERS = {
  top: BLACK_BORDER,
  bottom: BLACK_BORDER,
  left: BLACK_BORDER,
  right: BLACK_BORDER,
};
const INVISIBLE_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
};

function textRun(
  text: string,
  opts?: { bold?: boolean; size?: number; color?: string; font?: string },
) {
  return new TextRun({
    text,
    bold: opts?.bold,
    color: opts?.color,
    font: opts?.font ?? FONT,
    size: opts?.size ?? 20, // half-points; 20 = 10pt
  });
}

function para(
  text: string,
  opts?: {
    bold?: boolean;
    size?: number;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
  },
) {
  return new Paragraph({
    alignment: opts?.align,
    spacing: { after: opts?.spacingAfter ?? 120 },
    children: [textRun(text, { bold: opts?.bold, size: opts?.size, color: opts?.color })],
  });
}

function buildHeader(images: Awaited<ReturnType<typeof loadKpTemplateImages>>, lines: string[]) {
  // kp2705/kp2699: logo LEFT, requisites RIGHT, red line full width under both.
  const logoCell = new TableCell({
    borders: INVISIBLE_BORDERS,
    width: { size: 3200, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
        children: [
          new ImageRun({
            type: 'png',
            data: images.logo,
            transformation: {
              width: KP_IMAGE_SIZES.logo.width,
              height: KP_IMAGE_SIZES.logo.height,
            },
            altText: { title: 'Indeed logo', description: 'ООО Индид', name: 'logo' },
          }),
        ],
      }),
    ],
  });
  const requisitesCell = new TableCell({
    borders: INVISIBLE_BORDERS,
    width: { size: 6685, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: [
            textRun(line, {
              bold: i === 0,
              size: 16,
            }),
          ],
        }),
    ),
  });

  return new Header({
    children: [
      new Table({
        width: { size: 9885, type: WidthType.DXA },
        columnWidths: [3200, 6685],
        layout: TableLayoutType.FIXED,
        rows: [new TableRow({ children: [logoCell, requisitesCell] })],
      }),
      new Paragraph({
        spacing: { before: 80, after: 120 },
        children: [
          new ImageRun({
            type: 'png',
            data: images.redLine,
            transformation: {
              width: KP_IMAGE_SIZES.redLine.width,
              height: KP_IMAGE_SIZES.redLine.height,
            },
            altText: { title: 'Red line', description: 'Brand rule', name: 'red-line' },
          }),
        ],
      }),
    ],
  });
}

function metaTable(block: Extract<DocumentBlock, { type: 'meta' }>): Table {
  const cell = (text: string, width: number) =>
    new TableCell({
      borders: INVISIBLE_BORDERS,
      width: { size: width, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [textRun(`${text}`, { bold: true, size: 20 })],
        }),
      ],
    });
  return new Table({
    width: { size: 9029, type: WidthType.DXA },
    columnWidths: [4514, 4515],
    rows: [
      new TableRow({
        children: [
          cell(`${block.left}  ${block.center}`, 4514),
          new TableCell({
            borders: INVISIBLE_BORDERS,
            width: { size: 4515, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [textRun(block.right, { bold: true, size: 20 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function priceTable(block: Extract<DocumentBlock, { type: 'table' }>): (Paragraph | Table)[] {
  const widths = [...KP_TABLE_COL_TWIPS];
  const headerRow = new TableRow({
    tableHeader: true,
    children: block.headers.map(
      (h, i) =>
        new TableCell({
          borders: CELL_BORDERS,
          width: { size: widths[i] ?? 1500, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: i >= 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [textRun(String(h), { bold: true, size: 20 })],
            }),
          ],
        }),
    ),
  });
  const dataRows = block.rows.map(
    (r) =>
      new TableRow({
        children: r.cells.map((c, i) => {
          const centered = i >= 3 || r.isTotal;
          return new TableCell({
            borders: CELL_BORDERS,
            width: { size: widths[i] ?? 1500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [textRun(String(c), { bold: Boolean(r.isTotal), size: 20 })],
              }),
            ],
          });
        }),
      }),
  );
  const table = new Table({
    width: { size: 9885, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
  const out: (Paragraph | Table)[] = [];
  if (block.title) {
    out.push(para(block.title, { bold: true, size: 20, spacingAfter: 80 }));
  }
  out.push(table);
  if (block.footnote) {
    out.push(para(block.footnote, { size: 16, spacingAfter: 160 }));
  }
  return out;
}

function signatureBlock(
  images: Awaited<ReturnType<typeof loadKpTemplateImages>>,
  block: Extract<DocumentBlock, { type: 'signature' }>,
  isDemo: boolean,
): (Paragraph | Table)[] {
  const lines = block.lines;
  const closing = lines[0] ?? 'С Уважением,';
  const role = lines[1] ?? '';
  const name = lines[2] ?? '';
  const out: (Paragraph | Table)[] = [
    para(closing, { size: 20, spacingAfter: 80 }),
    para(role, { size: 20, spacingAfter: 40 }),
  ];
  if (isDemo) {
    out.push(
      para('Демонстрационный черновик — подпись и печать приведены для макета, документ не подписан', {
        bold: true,
        size: 16,
        color: RED,
        spacingAfter: 80,
      }),
    );
  }
  out.push(
    new Paragraph({
      spacing: { before: 80, after: 0 },
      children: [
        new ImageRun({
          type: 'png',
          data: images.signature,
          transformation: {
            width: KP_IMAGE_SIZES.signature.width,
            height: KP_IMAGE_SIZES.signature.height,
          },
          altText: { title: 'Signature', description: 'Подпись', name: 'signature' },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 120 },
      children: [
        textRun(name, { size: 20 }),
        new TextRun({ break: 1 }),
        new ImageRun({
          type: 'png',
          data: images.stamp,
          transformation: {
            width: KP_IMAGE_SIZES.stamp.width,
            height: KP_IMAGE_SIZES.stamp.height,
          },
          altText: { title: 'Stamp', description: 'Печать ООО Индид', name: 'stamp' },
        }),
      ],
    }),
  );
  return out;
}

function renderBlock(
  block: DocumentBlock,
  images: Awaited<ReturnType<typeof loadKpTemplateImages>>,
  isDemo: boolean,
): (Paragraph | Table)[] {
  switch (block.type) {
    case 'demoBanner':
      return [para(block.text, { bold: true, size: 18, color: RED, spacingAfter: 160 })];
    case 'supplierHeader':
      // Rendered in repeating header — skip body duplicate.
      return [];
    case 'meta':
      return [metaTable(block), new Paragraph({ children: [] })];
    case 'heading':
      return [
        para(block.text, {
          bold: true,
          size: block.level === 1 ? 36 : 20,
          align: block.level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacingAfter: block.level === 1 ? 200 : 120,
        }),
      ];
    case 'paragraph':
      return [para(block.text, { size: 20 })];
    case 'note':
      return [para(block.text, { size: 16, bold: true })];
    case 'list':
      return block.items.map((item) => para(`• ${item}`, { size: 18 }));
    case 'signature':
      return signatureBlock(images, block, isDemo);
    case 'table':
      return priceTable(block);
    default:
      return [];
  }
}

export function createDocxExporter(): Pick<ExportService, 'toDocx'> {
  return {
    async toDocx(document: ProposalDocument): Promise<Blob> {
      const images = await loadKpTemplateImages();
      const supplierLines =
        (
          document.blocks.find((b) => b.type === 'supplierHeader') as
            | Extract<DocumentBlock, { type: 'supplierHeader' }>
            | undefined
        )?.lines ?? [];

      const children: (Paragraph | Table)[] = [];
      for (const block of document.blocks) {
        children.push(...renderBlock(block, images, document.isDemo));
      }
      if (document.unresolvedNotes.length) {
        children.push(para('Незавершённые данные:', { bold: true, size: 18 }));
        for (const n of document.unresolvedNotes) {
          children.push(para(`• ${n}`, { size: 16 }));
        }
      }

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: FONT, size: 20 },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                size: { width: 11909, height: 16834 }, // A4
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
              },
            },
            headers: {
              default: buildHeader(images, supplierLines),
            },
            children,
          },
        ],
      });
      return Packer.toBlob(doc);
    },
  };
}
