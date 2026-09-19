import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import type { DocumentBlock, ExportService, ProposalDocument } from '../domain/types';

async function getPdfMake() {
  const pdfMakeMod = await import('pdfmake/build/pdfmake');
  const vfsMod = await import('pdfmake/build/vfs_fonts');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake = pdfMakeMod as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vfs = vfsMod as any;
  const fontsVfs = vfs.pdfMake?.vfs ?? vfs.default?.pdfMake?.vfs ?? vfs.default ?? vfs;
  pdfMake.vfs = fontsVfs;
  return pdfMake as {
    createPdf: (doc: TDocumentDefinitions) => {
      getBlob: (cb: (blob: Blob) => void) => void;
    };
  };
}

function blockToContent(block: DocumentBlock): Content[] {
  switch (block.type) {
    case 'demoBanner':
      return [{ text: block.text, bold: true, color: '#e30613', fontSize: 9, margin: [0, 0, 0, 8] }];
    case 'supplierHeader':
      return [
        {
          text: block.lines.map((l, i) => ({ text: l + '\n', bold: i === 0 })),
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
      return [
        {
          ul: block.items,
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
        block.headers.map((h) => ({ text: h, bold: true, fontSize: 7, alignment: 'center' as const })),
        ...block.rows.map((r) =>
          r.cells.map((c, idx) => ({
            text: c,
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
          ul: document.unresolvedNotes,
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

      return new Promise((resolve, reject) => {
        try {
          pdfMake.createPdf(docDefinition).getBlob((blob) => resolve(blob));
        } catch (e) {
          reject(e);
        }
      });
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
