import type { Proposal } from './types';

export interface DraftEnvelope {
  storageVersion: 2;
  id: string;
  title: string;
  proposal: Proposal;
  builder: { activeStep: 1 | 2 | 3 | 4; activeOptionId: string | null };
  revision: number;
  createdAt: string;
  updatedAt: string;
  saveStatus?: 'saved' | 'saving' | 'error';
}

export interface DraftSummary {
  id: string;
  title: string;
  customerName: string;
  number: string;
  productsLabel: string;
  updatedAt: string;
  activeStep: 1 | 2 | 3 | 4;
  statusLabel: string;
  optionTotals: Array<{ label: string; amount: string | null; partial: boolean }>;
}

export type DraftSaveResult =
  | { ok: true; draft: DraftEnvelope }
  | { ok: false; conflict: true; stored: DraftEnvelope };
