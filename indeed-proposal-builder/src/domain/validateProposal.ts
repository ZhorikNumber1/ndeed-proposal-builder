import type { Proposal, ValidationIssue } from './types';

export function validateStep1(proposal: Proposal): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!proposal.number.trim()) {
    issues.push({
      code: 'number_required',
      message: 'Укажите номер КП',
      severity: 'error',
      blocksRelease: false,
      fieldPath: 'number',
    });
  }
  if (!proposal.issueDate) {
    issues.push({
      code: 'date_required',
      message: 'Укажите дату КП',
      severity: 'error',
      blocksRelease: false,
      fieldPath: 'issueDate',
    });
  }
  if (!proposal.customer.legalName.trim()) {
    issues.push({
      code: 'customer_required',
      message: 'Укажите наименование заказчика',
      severity: 'error',
      blocksRelease: false,
      fieldPath: 'customer.legalName',
    });
  }
  if (!proposal.manager.displayName.trim()) {
    issues.push({
      code: 'manager_required',
      message: 'Укажите менеджера',
      severity: 'error',
      blocksRelease: false,
      fieldPath: 'manager.displayName',
    });
  }
  return issues;
}

export function validateProposal(proposal: Proposal): ValidationIssue[] {
  const issues = [...validateStep1(proposal)];
  for (const opt of proposal.options) {
    if (opt.calculation?.issues) issues.push(...opt.calculation.issues);
  }
  return issues;
}

export function collectBlockingIssues(proposal: Proposal): ValidationIssue[] {
  return validateProposal(proposal).filter((i) => i.blocksRelease && (i.severity === 'error' || i.severity === 'warning'));
}
