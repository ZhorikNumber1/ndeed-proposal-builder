import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import type { DocumentBlock, ExportService, ProposalDocument } from '../domain/types';

type PdfMakeInstance = {
  virtualfs: {
    writeFileSync: (filename: string, content: string | Uint8Array) => void;
  };
  fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>;
  createPdf: (doc: TDocumentDefinitions) => {
    getBlob: () => Promise<Blob>;
  };
};

let pdfMakeReady: Promise<PdfMakeInstance> | null = null;

function b64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function getPdfMake(): Promise<PdfMakeInstance> {
  if (!pdfMakeReady) {
    pdfMakeReady = (async () => {
      const pdfMakeMod = await import('pdfmake/build/pdfmake');
      const vfsMod = await import('pdfmake/build/vfs_fonts');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfMake = ((pdfMakeMod as any).default ?? pdfMakeMod) as PdfMakeInstance;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fontsRaw = (vfsMod as any).default ?? vfsMod;
      const fontEntries = Object.entries(fontsRaw as Record<string, string>).filter(
        ([name, data]) => typeof name === 'string' && name.endsWith('.ttf') && typeof data === 'string',
      );
      if (!fontEntries.length) {
        throw new Error('pdfmake vfs_fonts: Roboto TTF entries not found');
      }
      for (const [name, data] of fontEntries) {
        pdfMake.virtualfs.writeFileSync(name, b64ToUint8Array(data));
      }
      pdfMake.fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf',
        },
      };
      if (typeof pdfMake.createPdf !== 'function') {
        throw new Error('pdfMake.createPdf is not a function');
      }
      return pdfMake;
    })();
  }
  return pdfMakeReady;
}

function blockToContent(block: DocumentBlock): Content[] {
  switch (block.type) {
    case 'demoBanner':
      return [{ text: block.text, bold: true, color: '#e30613', fontSize: 9, margin: [0, 0, 0, 8] }];
    case 'supplierHeader':
      return [
        {
          text: block.lines.map((l, i) => ({ text: `${l}\n`, bold: i === 0 })),
          alignment: 'center',
          fontSize: 9,
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#e30613' }],
          margin: [0, 4, 0, 10],
        },
      ];
    case 'meta':
      return [
        {
          columns: [
            { text: block.left, alignment: 'left' },
            { text: block.center, alignment: 'center' },
            { text: block.right, alignment: 'right' },
          ],
          fontSize: 10,
          bold: true,
          margin: [0, 0, 0, 12],
        },
      ];
    case 'heading':
      return [
        {
          text: block.text,
          bold: true,
          fontSize: block.level === 1 ? 14 : block.level === 2 ? 11 : 10,
          alignment: block.level === 1 ? 'center' : 'left',
          margin: [0, 8, 0, 6],
        },
      ];
    case 'paragraph':
      return [{ text: block.text, fontSize: 9, margin: [0, 0, 0, 6] }];
    case 'note':
      return [{ text: block.text, fontSize: 8, bold: true, margin: [0, 2, 0, 8] }];
    case 'list':
      // Copy items — pdfmake mutates ul entries in place during layout.
      return [
        {
          ul: block.items.map((item) => String(item)),
          fontSize: 8,
          margin: [0, 0, 0, 8],
        },
      ];
    case 'signature':
      return block.lines.map((l, i) => ({
        text: l,
        fontSize: 10,
        margin: [0, i === 0 ? 12 : 2, 0, 0] as [number, number, number, number],
      }));
    case 'table': {
      const body: TableCell[][] = [
        block.headers.map((h) => ({ text: String(h), bold: true, fontSize: 7, alignment: 'center' as const })),
        ...block.rows.map((r) =>
          r.cells.map((c, idx) => ({
            text: String(c),
            fontSize: 7,
            bold: Boolean(r.isTotal),
            alignment: (idx === 2 ? 'left' : 'center') as 'left' | 'center',
          })),
        ),
      ];
      const nodes: Content[] = [
        {
          table: {
            headerRows: 1,
            widths: [22, 70, '*', 40, 55, 55],
            body,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
          margin: [0, 0, 0, 6],
        },
      ];
      if (block.footnote) {
        nodes.push({ text: block.footnote, fontSize: 7, bold: true, margin: [0, 0, 0, 10] });
      }
      return nodes;
    }
    default:
      return [];
  }
}

export function createPdfExporter(): Pick<ExportService, 'toPdf'> {
  return {
    async toPdf(document: ProposalDocument): Promise<Blob> {
      const pdfMake = await getPdfMake();
      const content: Content[] = [];
      for (const b of document.blocks) {
        content.push(...blockToContent(b));
      }
      if (document.unresolvedNotes.length) {
        content.push({ text: 'Незавершённые данные', bold: true, fontSize: 10, margin: [0, 12, 0, 4] });
        content.push({
          // Copy notes — pdfmake mutates ul entries in place during layout.
          ul: document.unresolvedNotes.map((n) => String(n)),
          fontSize: 8,
        });
      }

      const docDefinition: TDocumentDefinitions = {
        info: {
          title: document.fileBaseName,
          author: 'Indeed Proposal Builder (demo)',
        },
        defaultStyle: {
          font: 'Roboto',
          fontSize: 9,
        },
        content,
        pageMargins: [40, 40, 40, 40],
      };

      const blob = await pdfMake.createPdf(docDefinition).getBlob();
      if (!(blob instanceof Blob) || blob.size < 5) {
        throw new Error('PDF export produced an empty file');
      }
      return blob;
    },
  };
}

export const exportService: ExportService = {
  async toDocx(document: ProposalDocument) {
    const { createDocxExporter } = await import('./docxExporter');
    return createDocxExporter().toDocx(document);
  },
  ...createPdfExporter(),
};
