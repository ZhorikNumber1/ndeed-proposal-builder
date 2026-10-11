import type { SourceRef, SupplierProfile } from '../domain/types';

export type DemoSupplierProfile = SupplierProfile & {
  sourceRefs: SourceRef[];
};

export const DEMO_SUPPLIER = {
  id: 'indeed-supplier-demo',
  version: 'source-docx-2026-demo',
  isDemo: true,
  legalName: 'Общество с ограниченной ответственностью «Индид» (ООО «Индид»)',
  address:
    '191186, г. Санкт-Петербург, вн.тер.г. Муниципальный округ Дворцовый округ, ул. Итальянская, д. 17, литера А, помещ. 1НC',
  inn: '7801540219',
  ogrn: '1117847053103',
  kpp: '784001001',
  signatoryName: 'Алексей Баранов',
  // Exact wording from kp2705 / kp2699 body (hyphen, not em-dash).
  signatoryRole:
    'Управляющий управляющей организации АО «Индид» - Индивидуальный предприниматель',
  supportPhone: '8 800 333-09-06',
  supportUrl: 'https://support.indeed-company.ru/',
  certificateNumber: '4667',
  sourceRefs: [
    { sourceId: 'KP2705', locator: 'word/header1.xml; signature block' },
    { sourceId: 'KP2699', locator: 'word/header1.xml; signature block' },
  ],
} satisfies DemoSupplierProfile;
