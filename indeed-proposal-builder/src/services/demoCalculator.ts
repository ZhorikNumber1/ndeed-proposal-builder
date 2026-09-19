import type { CalculatorService, ProposalOption, CalculationResult } from '../domain/types';
import { calculateOptionSync } from '../domain/calculateOption';

/**
 * Local demo calculator adapter.
 * mode=demo — extracted rules from price-calculator NEW.xlsx (S08), NOT a live Excel bridge.
 */
export function createDemoCalculatorService(): CalculatorService {
  return {
    async calculate(
      option: ProposalOption,
      context: { revision: number; signal?: AbortSignal },
    ): Promise<CalculationResult> {
      if (context.signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      // Microtask yield so UI can mark pending; no fake random delay
      await Promise.resolve();
      if (context.signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      return calculateOptionSync(option, context.revision);
    },
  };
}

export const demoCalculator = createDemoCalculatorService();
