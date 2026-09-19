import { describe, expect, it } from 'vitest';
import { builderReducer, createInitialState } from '../app/builderReducer';
import { createDemoProposal } from '../data/demoProposal';

describe('SET_ALTERNATIVES_MODE', () => {
  it('can switch perpetual-only and back to both / subscription', () => {
    let state = createInitialState();
    state = builderReducer(state, {
      type: 'HYDRATE',
      proposal: createDemoProposal(),
      ui: { activeStep: 3 },
      isDemoExample: true,
    });
    expect(state.proposal.options).toHaveLength(2);

    state = builderReducer(state, { type: 'SET_ALTERNATIVES_MODE', mode: 'perpetual' });
    expect(state.proposal.options).toHaveLength(1);
    expect(state.proposal.options[0].licenseType).toBe('perpetual');
    expect(state.ui.activeOptionId).toBe(state.proposal.options[0].id);

    state = builderReducer(state, { type: 'SET_ALTERNATIVES_MODE', mode: 'subscription' });
    expect(state.proposal.options).toHaveLength(1);
    expect(state.proposal.options[0].licenseType).toBe('subscription');
    expect(state.proposal.options[0].termMonths).toBe(12);

    state = builderReducer(state, { type: 'SET_ALTERNATIVES_MODE', mode: 'both' });
    expect(state.proposal.options).toHaveLength(2);
    expect(state.proposal.options.map((o) => o.licenseType).sort()).toEqual(['perpetual', 'subscription']);
  });
});
