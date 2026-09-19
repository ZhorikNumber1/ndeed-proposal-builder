import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from 'docx';
import type { ExportService, ProposalDocument, DocumentBlock } from '../domain/types';

function para(text: string, opts?: { bold?: boolean; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; size?: number }) {
  return new Paragraph({
    heading: opts?.heading,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        font: 'Times New Roman',
        size: opts?.size ?? 22,
      }),
    ],
  });
}

function blocksToDocx(doc: ProposalDocument): Paragraph[] | (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(
    new Paragraph({
      children: [
        new TextRun({
          text: doc.isDemo ? 'ДЕМОНСТРАЦИОННЫЙ ЧЕРНОВИК' : '',
          bold: true,
          color: 'E30613',
          font: 'Times New Roman',
          size: 20,
        }),
      ],
    }),
  );

  for (const block of doc.blocks) {
    out.push(...renderBlock(block));
  }

  if (doc.unresolvedNotes.length) {
    out.push(para('Незавершённые данные:', { bold: true }));
    for (const n of doc.unresolvedNotes) {
      out.push(para(`• ${n}`, { size: 18 }));
    }
  }
  return out;
}

function renderBlock(block: DocumentBlock): (Paragraph | Table)[] {
  switch (block.type) {
    case 'demoBanner':
      return [para(block.text, { bold: true, size: 18 })];
    case 'supplierHeader':
      return block.lines.map((l, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: l, bold: i === 0, font: 'Times New Roman', size: 18 })],
        }),
      );
    case 'meta':
      return [
        new Paragraph({
          children: [
            new TextRun({ text: `${block.left}    ${block.center}    ${block.right}`, font: 'Times New Roman', size: 20 }),
          ],
        }),
      ];
    case 'heading':
      return [
        para(block.text, {
          bold: true,
          heading: block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          size: block.level === 1 ? 28 : 22,
        }),
      ];
    case 'paragraph':
      return [para(block.text, { size: 20 })];
    case 'note':
      return [para(block.text, { size: 16, bold: true })];
    case 'list':
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [new TextRun({ text: `• ${item}`, font: 'Times New Roman', size: 18 })],
          }),
      );
    case 'signature':
      return block.lines.map((l) => para(l, { size: 20 }));
    case 'table': {
      const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
      const borders = { top: border, bottom: border, left: border, right: border };
      const headerRow = new TableRow({
        tableHeader: true,
        children: block.headers.map(
          (h) =>
            new TableCell({
              borders,
              width: { size: 1500, type: WidthType.DXA },
              children: [para(h, { bold: true, size: 16 })],
            }),
        ),
      });
      const dataRows = block.rows.map(
        (r) =>
          new TableRow({
            children: r.cells.map(
              (c) =>
                new TableCell({
                  borders,
                  width: { size: 1500, type: WidthType.DXA },
                  children: [para(c, { bold: r.isTotal, size: 16 })],
                }),
            ),
          }),
      );
      const table = new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [headerRow, ...dataRows],
      });
      const result: (Paragraph | Table)[] = [table];
      if (block.footnote) result.push(para(block.footnote, { size: 16 }));
      return result;
    }
    default:
      return [];
  }
}

export function createDocxExporter(): Pick<ExportService, 'toDocx'> {
  return {
    async toDocx(document: ProposalDocument): Promise<Blob> {
      const children = blocksToDocx(document);
      const doc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
      });
      return Packer.toBlob(doc);
    },
  };
}
