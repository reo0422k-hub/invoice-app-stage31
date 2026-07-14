export const invoiceStatuses = ['下書き', '承認待ち', '送付済み', '入金済み', '期限超過']

export const taxRate = 0.1

export const defaultCompanySettings = {
  companyName: '株式会社オービットソリューションズ',
  contactName: '管理部 佐藤 美咲',
  postalCode: '100-0005',
  address: '東京都千代田区丸の内1-8-3 丸の内トラストタワー 12F',
  phone: '03-1234-5678',
  email: 'billing@orbit-solutions.example',
  bankInfo:
    'みずほ銀行 丸の内支店\n普通 1234567\n株式会社オービットソリューションズ',
}

export const demoInvoices = [
  {
    id: 'invoice-001',
    invoiceNumber: 'INV-202607-001',
    clientName: '株式会社アルファ商事',
    subject: '7月分 Web保守運用費',
    issueDate: '2026-07-03',
    dueDate: '2026-07-24',
    status: '送付済み',
    notes: '月次定例の保守費用です。',
    items: [
      { id: 'item-001-1', name: 'Web保守運用', quantity: 1, unitPrice: 180000 },
      { id: 'item-001-2', name: '軽微改修対応', quantity: 2, unitPrice: 25000 },
    ],
  },
  {
    id: 'invoice-002',
    invoiceNumber: 'INV-202607-002',
    clientName: '株式会社ベータ物流',
    subject: '請求システム導入支援',
    issueDate: '2026-07-06',
    dueDate: '2026-07-28',
    status: '承認待ち',
    notes: '稼働前レビューを含みます。',
    items: [
      { id: 'item-002-1', name: '導入支援', quantity: 1, unitPrice: 240000 },
      { id: 'item-002-2', name: '操作研修', quantity: 3, unitPrice: 32000 },
    ],
  },
  {
    id: 'invoice-003',
    invoiceNumber: 'INV-202607-003',
    clientName: '株式会社シグマデザイン',
    subject: '7月分 デザイン制作費',
    issueDate: '2026-07-08',
    dueDate: '2026-07-18',
    status: '入金済み',
    notes: 'ブランドガイド更新分を含みます。',
    items: [
      { id: 'item-003-1', name: 'UIデザイン制作', quantity: 1, unitPrice: 210000 },
    ],
  },
  {
    id: 'invoice-004',
    invoiceNumber: 'INV-202607-004',
    clientName: '株式会社デルタフーズ',
    subject: '販促キャンペーン LP制作',
    issueDate: '2026-07-10',
    dueDate: '2026-07-31',
    status: '下書き',
    notes: '見積承認後に送付予定です。',
    items: [
      { id: 'item-004-1', name: 'LPデザイン', quantity: 1, unitPrice: 95000 },
      { id: 'item-004-2', name: 'コーディング', quantity: 1, unitPrice: 85000 },
    ],
  },
  {
    id: 'invoice-005',
    invoiceNumber: 'INV-202606-014',
    clientName: '株式会社エコー設備',
    subject: '6月分 定期メンテナンス',
    issueDate: '2026-06-12',
    dueDate: '2026-06-30',
    status: '期限超過',
    notes: '入金確認が未完了です。',
    items: [
      { id: 'item-005-1', name: '定期メンテナンス', quantity: 2, unitPrice: 68000 },
    ],
  },
  {
    id: 'invoice-006',
    invoiceNumber: 'INV-202607-005',
    clientName: '株式会社フューチャーリンク',
    subject: 'アプリ改修 Sprint 4',
    issueDate: '2026-07-12',
    dueDate: '2026-07-26',
    status: '承認待ち',
    notes: '承認後に送付予定です。',
    items: [
      { id: 'item-006-1', name: '機能改修', quantity: 5, unitPrice: 48000 },
      { id: 'item-006-2', name: 'QA対応', quantity: 2, unitPrice: 18000 },
    ],
  },
]
