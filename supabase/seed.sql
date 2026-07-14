insert into clients (
  id,
  name,
  contact_name,
  email,
  phone,
  address
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '株式会社アルファ商事',
    '田中 一郎',
    'tanaka@alpha.example.com',
    '03-1111-1111',
    '東京都港区北青山1-2-3'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '株式会社ベータ物流',
    '鈴木 花',
    'suzuki@beta.example.com',
    '06-2222-2222',
    '大阪府大阪市北区梅田2-4-9'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '株式会社シグマデザイン',
    '高橋 翼',
    'takahashi@sigma.example.com',
    '052-333-3333',
    '愛知県名古屋市中区栄3-10-5'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '株式会社デルタフーズ',
    '中村 美咲',
    'nakamura@delta.example.com',
    '092-444-4444',
    '福岡県福岡市中央区天神1-8-1'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '株式会社エコー設備',
    '小林 恒一',
    'kobayashi@echo.example.com',
    '011-555-5555',
    '北海道札幌市中央区大通西6-1'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '株式会社フューチャーリンク',
    '山本 直子',
    'yamamoto@future.example.com',
    '045-666-6666',
    '神奈川県横浜市西区みなとみらい2-3-5'
  )
on conflict (id) do update
set
  name = excluded.name,
  contact_name = excluded.contact_name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  updated_at = now();

insert into invoices (
  id,
  invoice_number,
  client_id,
  title,
  issue_date,
  due_date,
  status,
  subtotal,
  tax_amount,
  total_amount,
  notes
)
values
  (
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'INV-202607-001',
    '11111111-1111-1111-1111-111111111111',
    '7月分 Web保守運用費',
    '2026-07-03',
    '2026-07-24',
    'sent',
    230000,
    23000,
    253000,
    '月次定例の保守費用です。'
  ),
  (
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'INV-202607-002',
    '22222222-2222-2222-2222-222222222222',
    '請求システム導入支援',
    '2026-07-06',
    '2026-07-28',
    'pending',
    336000,
    33600,
    369600,
    '稼働前レビューを含みます。'
  ),
  (
    'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    'INV-202607-003',
    '33333333-3333-3333-3333-333333333333',
    '7月分 デザイン制作費',
    '2026-07-08',
    '2026-07-18',
    'paid',
    210000,
    21000,
    231000,
    'ブランドガイド更新分を含みます。'
  ),
  (
    'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'INV-202607-004',
    '44444444-4444-4444-4444-444444444444',
    '販促キャンペーン LP制作',
    '2026-07-10',
    '2026-07-31',
    'draft',
    180000,
    18000,
    198000,
    '見積承認後に送付予定です。'
  ),
  (
    'aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    'INV-202606-014',
    '55555555-5555-5555-5555-555555555555',
    '6月分 定期メンテナンス',
    '2026-06-12',
    '2026-06-30',
    'overdue',
    136000,
    13600,
    149600,
    '入金確認が未完了です。'
  ),
  (
    'aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
    'INV-202607-005',
    '66666666-6666-6666-6666-666666666666',
    'アプリ改修 Sprint 4',
    '2026-07-12',
    '2026-07-26',
    'pending',
    276000,
    27600,
    303600,
    '承認後に送付予定です。'
  )
on conflict (id) do update
set
  invoice_number = excluded.invoice_number,
  client_id = excluded.client_id,
  title = excluded.title,
  issue_date = excluded.issue_date,
  due_date = excluded.due_date,
  status = excluded.status,
  subtotal = excluded.subtotal,
  tax_amount = excluded.tax_amount,
  total_amount = excluded.total_amount,
  notes = excluded.notes,
  updated_at = now();

insert into invoice_items (
  id,
  invoice_id,
  item_name,
  description,
  quantity,
  unit_price,
  amount,
  sort_order
)
values
  (
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbb111',
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Web保守運用',
    '月次の保守サポート',
    1,
    180000,
    180000,
    1
  ),
  (
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbb112',
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '軽微改修対応',
    '追加修正対応',
    2,
    25000,
    50000,
    2
  ),
  (
    'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbb113',
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '導入支援',
    'システム導入設計と初期設定',
    1,
    240000,
    240000,
    1
  ),
  (
    'bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbb114',
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '操作研修',
    '担当者向けオンボーディング',
    3,
    32000,
    96000,
    2
  ),
  (
    'bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbb115',
    'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    'UIデザイン制作',
    'ブランドガイド更新分を含む',
    1,
    210000,
    210000,
    1
  ),
  (
    'bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbb116',
    'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'LPデザイン',
    '販促用ランディングページデザイン',
    1,
    95000,
    95000,
    1
  ),
  (
    'bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbb117',
    'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'コーディング',
    'レスポンシブ実装',
    1,
    85000,
    85000,
    2
  ),
  (
    'bbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbb118',
    'aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '定期メンテナンス',
    '設備点検および保守',
    2,
    68000,
    136000,
    1
  ),
  (
    'bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbb119',
    'aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
    '機能改修',
    'Sprint 4 の実装作業',
    5,
    48000,
    240000,
    1
  ),
  (
    'bbbbbb10-bbbb-bbbb-bbbb-bbbbbbbbb120',
    'aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
    'QA対応',
    '受け入れ試験対応',
    2,
    18000,
    36000,
    2
  )
on conflict (id) do update
set
  invoice_id = excluded.invoice_id,
  item_name = excluded.item_name,
  description = excluded.description,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  amount = excluded.amount,
  sort_order = excluded.sort_order;

insert into payments (
  id,
  invoice_id,
  payment_date,
  amount,
  payment_method,
  notes
)
values
  (
    'ccccccc1-cccc-cccc-cccc-ccccccccccc1',
    'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '2026-07-15',
    231000,
    'bank_transfer',
    '全額入金済み'
  ),
  (
    'ccccccc2-cccc-cccc-cccc-ccccccccccc2',
    'aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '2026-06-25',
    50000,
    'bank_transfer',
    '一部入金'
  )
on conflict (id) do update
set
  invoice_id = excluded.invoice_id,
  payment_date = excluded.payment_date,
  amount = excluded.amount,
  payment_method = excluded.payment_method,
  notes = excluded.notes;
