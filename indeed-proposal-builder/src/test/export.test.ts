import { describe, expect, it } from 'vitest';
import { createDemoProposal } from '../data/demoProposal';
import { buildProposalDocument } from '../domain/buildProposalDocument';
import { createDocxExporter } from '../services/docxExporter';

describe('export smoke', () => {
  it('creates a real OOXML docx blob', async () => {
    const doc = buildProposalDocument(createDemoProposal());
    const blob = await createDocxExporter().toDocx(doc);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(2000);
  });
});
