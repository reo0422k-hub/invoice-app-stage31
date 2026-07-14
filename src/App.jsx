import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { defaultCompanySettings, demoInvoices, invoiceStatuses, taxRate } from './mockData'

const invoiceStorageKey = 'invoice-app:invoices'
const settingsStorageKey = 'invoice-app:settings'

const navigationItems = [
  { id: 'dashboard', label: 'ダッシュボード' },
  { id: 'invoices', label: '請求書一覧' },
  { id: 'editor', label: '請求書作成・編集' },
  { id: 'approvals', label: '承認待ち一覧' },
  { id: 'settings', label: '設定' },
]

const statusLabels = {
  下書き: 'draft',
  承認待ち: 'pending',
  送付済み: 'sent',
  入金済み: 'paid',
  期限超過: 'overdue',
}

const currencyFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const [invoices, setInvoices] = useState(() => loadInvoices())
  const [companySettings, setCompanySettings] = useState(() => loadSettings())
  const [isLoading, setIsLoading] = useState(true)
  const [loadingTick, setLoadingTick] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    window.localStorage.setItem(invoiceStorageKey, JSON.stringify(invoices))
  }, [invoices])

  useEffect(() => {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(companySettings))
  }, [companySettings])

  useEffect(() => {
    setMobileMenuOpen(false)
    setIsLoading(true)

    const timerId = window.setTimeout(() => {
      setIsLoading(false)
    }, 650)

    return () => window.clearTimeout(timerId)
  }, [activeView, loadingTick])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setNotice('')
    }, 2800)

    return () => window.clearTimeout(timerId)
  }, [notice])

  const metrics = useMemo(() => buildMetrics(invoices), [invoices])
  const editingInvoice = invoices.find((invoice) => invoice.id === editingInvoiceId) ?? null

  const navigateTo = (view, nextInvoiceId = null) => {
    setMobileMenuOpen(false)
    setEditingInvoiceId(nextInvoiceId)
    setActiveView(view)
  }

  const handleCreateInvoice = () => {
    navigateTo('editor', null)
  }

  const handleEditInvoice = (invoiceId) => {
    navigateTo('editor', invoiceId)
  }

  const handleSaveInvoice = (formValues) => {
    const normalizedInvoice = normalizeInvoice({
      ...formValues,
      id: formValues.id ?? crypto.randomUUID(),
      invoiceNumber: formValues.invoiceNumber ?? buildNextInvoiceNumber(invoices),
      updatedAt: new Date().toISOString(),
    })

    setInvoices((currentInvoices) => {
      const exists = currentInvoices.some((invoice) => invoice.id === normalizedInvoice.id)
      if (exists) {
        return currentInvoices.map((invoice) =>
          invoice.id === normalizedInvoice.id ? normalizedInvoice : invoice,
        )
      }

      return [normalizedInvoice, ...currentInvoices]
    })

    setNotice(formValues.id ? '請求書を更新しました。' : '請求書を保存しました。')
    navigateTo('invoices')
  }

  const handleUpdateInvoiceStatus = (invoiceId, nextStatus, message) => {
    setInvoices((currentInvoices) =>
      currentInvoices.map((invoice) =>
        invoice.id === invoiceId
          ? normalizeInvoice({
              ...invoice,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            })
          : invoice,
      ),
    )
    setNotice(message)
  }

  const handleSaveSettings = (nextSettings) => {
    setCompanySettings(nextSettings)
    setNotice('設定を保存しました。')
  }

  const handleClearInvoices = () => {
    setInvoices([])
    setNotice('請求書データを空にしました。')
  }

  const handleRestoreDemoData = () => {
    setInvoices(demoInvoices.map((invoice) => normalizeInvoice(invoice)))
    setNotice('ダミーデータを復元しました。')
  }

  const handleClearPendingInvoices = () => {
    setInvoices((currentInvoices) =>
      currentInvoices.map((invoice) =>
        invoice.status === '承認待ち'
          ? normalizeInvoice({
              ...invoice,
              status: '下書き',
              updatedAt: new Date().toISOString(),
            })
          : invoice,
      ),
    )
    setNotice('承認待ちの請求書を確認済みにしました。')
  }

  const handlePreviewLoading = () => {
    setLoadingTick((current) => current + 1)
  }

  const headerTitle = navigationItems.find((item) => item.id === activeView)?.label ?? '請求書管理'
  const headerDescription = getViewDescription(activeView, editingInvoice)

  let content = null

  if (isLoading) {
    content = <LoadingScreen activeView={activeView} />
  } else if (activeView === 'dashboard') {
    content = (
      <DashboardScreen
        metrics={metrics}
        onCreateInvoice={handleCreateInvoice}
        onEditInvoice={handleEditInvoice}
      />
    )
  } else if (activeView === 'invoices') {
    content = (
      <InvoicesScreen
        invoices={invoices}
        onCreateInvoice={handleCreateInvoice}
        onEditInvoice={handleEditInvoice}
        onClearInvoices={handleClearInvoices}
        onRestoreDemoData={handleRestoreDemoData}
      />
    )
  } else if (activeView === 'editor') {
    content = (
      <InvoiceEditorScreen
        invoice={editingInvoice}
        invoices={invoices}
        onCancel={() => navigateTo('invoices')}
        onSave={handleSaveInvoice}
      />
    )
  } else if (activeView === 'approvals') {
    content = (
      <ApprovalsScreen
        invoices={invoices}
        onEditInvoice={handleEditInvoice}
        onApprove={(invoiceId) =>
          handleUpdateInvoiceStatus(invoiceId, '送付済み', '請求書を承認しました。')
        }
        onReject={(invoiceId) =>
          handleUpdateInvoiceStatus(invoiceId, '下書き', '請求書を差し戻しました。')
        }
      />
    )
  } else if (activeView === 'settings') {
    content = (
      <SettingsScreen
        companySettings={companySettings}
        onSave={handleSaveSettings}
        onRestoreDemoData={handleRestoreDemoData}
        onClearInvoices={handleClearInvoices}
        onClearPendingInvoices={handleClearPendingInvoices}
        onPreviewLoading={handlePreviewLoading}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">請</div>
          <div>
            <p className="eyebrow">Invoice Workspace</p>
            <h1>請求書管理</h1>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="メニューを閉じる"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="画面一覧">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${activeView === item.id ? 'is-active' : ''}`}
              onClick={() => navigateTo(item.id, item.id === 'editor' ? editingInvoiceId : null)}
              disabled={isLoading}
            >
              <span>{item.label}</span>
              {item.id === 'approvals' ? (
                <strong>{metrics.statusCounts['承認待ち']}</strong>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-summary">
          <p>今月の請求</p>
          <strong>{formatCurrency(metrics.monthlyTotal)}</strong>
          <span>{metrics.monthlyCount} 件</span>
        </div>
      </aside>

      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? 'is-visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label="メニューを開く"
              disabled={isLoading}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className="eyebrow">{headerTitle}</p>
              <h2>{headerDescription}</h2>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="today-badge">
              <span>営業日</span>
              <strong>{dateFormatter.format(new Date())}</strong>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={handleCreateInvoice}
              disabled={isLoading}
            >
              新規請求書
            </button>
          </div>
        </header>

        {notice ? <div className="notice-banner">{notice}</div> : null}

        <main className="content-shell">{content}</main>
      </div>
    </div>
  )
}

function DashboardScreen({ metrics, onCreateInvoice, onEditInvoice }) {
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>今月のサマリー</h3>
          <p>請求の進捗と入金状況をひと目で確認できます。</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="今月の請求総額" value={formatCurrency(metrics.monthlyTotal)} />
        <StatCard label="入金済み金額" value={formatCurrency(metrics.monthlyPaid)} />
        <StatCard label="未入金金額" value={formatCurrency(metrics.monthlyOutstanding)} />
        <StatCard label="請求書件数" value={`${metrics.monthlyCount} 件`} />
      </div>

      <div className="split-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>最近の請求書</h3>
              <p>発行日の新しい順で直近 5 件を表示しています。</p>
            </div>
            <button type="button" className="secondary-button" onClick={onCreateInvoice}>
              請求書を作成
            </button>
          </div>

          {metrics.recentInvoices.length === 0 ? (
            <EmptyState onCreateInvoice={onCreateInvoice} />
          ) : (
            <div className="stack-list">
              {metrics.recentInvoices.map((invoice) => (
                <article key={invoice.id} className="invoice-list-item">
                  <div>
                    <div className="item-title-row">
                      <strong>{invoice.invoiceNumber}</strong>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <p>{invoice.clientName}</p>
                    <span>
                      発行日 {formatDate(invoice.issueDate)} / 支払期限 {formatDate(invoice.dueDate)}
                    </span>
                  </div>
                  <div className="item-side">
                    <strong>{formatCurrency(invoice.total)}</strong>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onEditInvoice(invoice.id)}
                    >
                      編集
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>ステータス別件数</h3>
              <p>請求書の滞留ポイントを把握できます。</p>
            </div>
          </div>

          <div className="status-summary-grid">
            {invoiceStatuses.map((status) => (
              <article key={status} className={`status-summary-card is-${statusLabels[status]}`}>
                <StatusBadge status={status} />
                <strong>{metrics.statusCounts[status]} 件</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function InvoicesScreen({
  invoices,
  onCreateInvoice,
  onEditInvoice,
  onClearInvoices,
  onRestoreDemoData,
}) {
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('すべて')

  const resetFilters = () => {
    setKeyword('')
    setStatusFilter('すべて')
  }

  const filteredInvoices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'すべて' || invoice.status === statusFilter
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [
          invoice.invoiceNumber,
          invoice.clientName,
          invoice.subject,
          invoice.notes,
        ].some((value) => value.toLowerCase().includes(normalizedKeyword))

      return matchesStatus && matchesKeyword
    })
  }, [invoices, keyword, statusFilter])

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>請求書一覧</h3>
          <p>検索、絞り込み、編集から日次の運用を進められます。</p>
        </div>
        <div className="inline-actions">
          <button type="button" className="secondary-button" onClick={onRestoreDemoData}>
            ダミーデータ復元
          </button>
          <button type="button" className="secondary-button subtle" onClick={onClearInvoices}>
            全件クリア
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="filters-grid">
          <label className="field">
            <span>キーワード検索</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="請求書番号、取引先名、件名で検索"
            />
          </label>

          <label className="field">
            <span>ステータス</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="すべて">すべて</option>
              {invoiceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {invoices.length === 0 ? (
          <EmptyState onCreateInvoice={onCreateInvoice} />
        ) : filteredInvoices.length === 0 ? (
          <NoResultsState onReset={resetFilters} />
        ) : (
          <>
            <div className="table-wrap desktop-only">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>請求書番号</th>
                    <th>取引先名</th>
                    <th>発行日</th>
                    <th>支払期限</th>
                    <th>金額</th>
                    <th>ステータス</th>
                    <th aria-label="操作" />
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.clientName}</td>
                      <td>{formatDate(invoice.issueDate)}</td>
                      <td>{formatDate(invoice.dueDate)}</td>
                      <td>{formatCurrency(invoice.total)}</td>
                      <td>
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onEditInvoice(invoice.id)}
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list mobile-only">
              {filteredInvoices.map((invoice) => (
                <article key={invoice.id} className="mobile-invoice-card">
                  <div className="item-title-row">
                    <strong>{invoice.invoiceNumber}</strong>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <dl>
                    <div>
                      <dt>取引先名</dt>
                      <dd>{invoice.clientName}</dd>
                    </div>
                    <div>
                      <dt>発行日</dt>
                      <dd>{formatDate(invoice.issueDate)}</dd>
                    </div>
                    <div>
                      <dt>支払期限</dt>
                      <dd>{formatDate(invoice.dueDate)}</dd>
                    </div>
                    <div>
                      <dt>金額</dt>
                      <dd>{formatCurrency(invoice.total)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEditInvoice(invoice.id)}
                  >
                    編集する
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}

function InvoiceEditorScreen({ invoice, invoices, onCancel, onSave }) {
  const [formState, setFormState] = useState(() => buildInitialFormState(invoice))

  useEffect(() => {
    setFormState(buildInitialFormState(invoice))
  }, [invoice])

  const subtotal = calculateSubtotal(formState.items)
  const tax = Math.round(subtotal * taxRate)
  const total = subtotal + tax

  const updateField = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updateItem = (itemId, field, value) => {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: field === 'name' ? value : Number(value),
            }
          : item,
      ),
    }))
  }

  const addItem = () => {
    setFormState((current) => ({
      ...current,
      items: [
        ...current.items,
        { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 },
      ],
    }))
  }

  const removeItem = (itemId) => {
    setFormState((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((item) => item.id !== itemId),
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const sanitizedItems = formState.items
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
      }))
      .filter((item) => item.name && item.quantity > 0)

    if (sanitizedItems.length === 0) {
      return
    }

    const payload = {
      ...invoice,
      ...formState,
      clientName: formState.clientName.trim(),
      subject: formState.subject.trim(),
      notes: formState.notes.trim(),
      items: sanitizedItems,
      subtotal,
      tax,
      total,
    }

    onSave(payload)
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>{invoice ? '請求書を編集' : '請求書を作成'}</h3>
          <p>品目ごとの小計と消費税を自動計算します。</p>
        </div>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field">
            <span>取引先名</span>
            <input
              type="text"
              required
              value={formState.clientName}
              onChange={(event) => updateField('clientName', event.target.value)}
              placeholder="株式会社サンプル"
            />
          </label>

          <label className="field">
            <span>件名</span>
            <input
              type="text"
              required
              value={formState.subject}
              onChange={(event) => updateField('subject', event.target.value)}
              placeholder="7月分保守運用費"
            />
          </label>

          <label className="field">
            <span>発行日</span>
            <input
              type="date"
              required
              value={formState.issueDate}
              onChange={(event) => updateField('issueDate', event.target.value)}
            />
          </label>

          <label className="field">
            <span>支払期限</span>
            <input
              type="date"
              required
              value={formState.dueDate}
              onChange={(event) => updateField('dueDate', event.target.value)}
            />
          </label>

          <label className="field field-full">
            <span>ステータス</span>
            <select
              value={formState.status}
              onChange={(event) => updateField('status', event.target.value)}
            >
              {invoiceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="line-items-panel">
          <div className="panel-header">
            <div>
              <h3>品目</h3>
              <p>数量と単価から小計を自動計算します。</p>
            </div>
            <button type="button" className="secondary-button" onClick={addItem}>
              品目を追加
            </button>
          </div>

          <div className="line-items-list">
            {formState.items.map((item, index) => (
              <div key={item.id} className="line-item-card">
                <div className="line-item-head">
                  <strong>品目 {index + 1}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => removeItem(item.id)}
                    disabled={formState.items.length === 1}
                  >
                    削除
                  </button>
                </div>

                <div className="line-item-grid">
                  <label className="field line-item-name">
                    <span>品目</span>
                    <input
                      type="text"
                      required
                      value={item.name}
                      onChange={(event) => updateItem(item.id, 'name', event.target.value)}
                      placeholder="保守サポート"
                    />
                  </label>

                  <label className="field">
                    <span>数量</span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, 'quantity', event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>単価</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      required
                      value={item.unitPrice}
                      onChange={(event) => updateItem(item.id, 'unitPrice', event.target.value)}
                    />
                  </label>

                  <div className="total-box">
                    <span>小計</span>
                    <strong>{formatCurrency(item.quantity * item.unitPrice)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="field field-full">
          <span>備考</span>
          <textarea
            rows="4"
            value={formState.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="支払方法、契約条件、補足事項など"
          />
        </label>

        <div className="totals-card">
          <div>
            <span>小計</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div>
            <span>消費税 (10%)</span>
            <strong>{formatCurrency(tax)}</strong>
          </div>
          <div className="grand-total">
            <span>合計金額</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary-button">
            保存する
          </button>
        </div>
      </form>

      <section className="panel preview-panel">
        <div className="panel-header">
          <div>
            <h3>保存予定の内容</h3>
            <p>{invoice ? '更新内容' : '新規作成内容'}の確認用プレビューです。</p>
          </div>
        </div>

        <div className="preview-grid">
          <InfoPair label="請求書番号" value={invoice?.invoiceNumber ?? nextPreviewNumber(invoices)} />
          <InfoPair label="取引先名" value={formState.clientName || '-'} />
          <InfoPair label="件名" value={formState.subject || '-'} />
          <InfoPair label="ステータス" value={formState.status} />
          <InfoPair label="発行日" value={formatDate(formState.issueDate)} />
          <InfoPair label="支払期限" value={formatDate(formState.dueDate)} />
        </div>
      </section>
    </section>
  )
}

function ApprovalsScreen({ invoices, onEditInvoice, onApprove, onReject }) {
  const pendingInvoices = invoices.filter((invoice) => invoice.status === '承認待ち')

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>承認待ち一覧</h3>
          <p>承認待ちの請求書を確認し、承認または差し戻しできます。</p>
        </div>
      </div>

      <section className="panel">
        {pendingInvoices.length === 0 ? (
          <div className="empty-inline">
            <h4>承認待ちの請求書はありません</h4>
            <p>現在、確認が必要な請求書はありません</p>
          </div>
        ) : (
          <div className="stack-list">
            {pendingInvoices.map((invoice) => (
              <article key={invoice.id} className="approval-card">
                <div className="approval-main">
                  <div className="item-title-row">
                    <strong>{invoice.invoiceNumber}</strong>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <p>{invoice.clientName}</p>
                  <span>{invoice.subject}</span>
                </div>

                <div className="approval-meta">
                  <InfoPair label="発行日" value={formatDate(invoice.issueDate)} />
                  <InfoPair label="支払期限" value={formatDate(invoice.dueDate)} />
                  <InfoPair label="金額" value={formatCurrency(invoice.total)} />
                </div>

                <div className="approval-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEditInvoice(invoice.id)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="secondary-button subtle"
                    onClick={() => onReject(invoice.id)}
                  >
                    差し戻し
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onApprove(invoice.id)}
                  >
                    承認
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function SettingsScreen({
  companySettings,
  onSave,
  onRestoreDemoData,
  onClearInvoices,
  onClearPendingInvoices,
  onPreviewLoading,
}) {
  const [formState, setFormState] = useState(companySettings)

  useEffect(() => {
    setFormState(companySettings)
  }, [companySettings])

  const updateField = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave(formState)
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>設定</h3>
          <p>会社情報と振込先情報をアプリ内に保存します。</p>
        </div>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field">
            <span>会社名</span>
            <input
              type="text"
              required
              value={formState.companyName}
              onChange={(event) => updateField('companyName', event.target.value)}
            />
          </label>

          <label className="field">
            <span>担当者名</span>
            <input
              type="text"
              required
              value={formState.contactName}
              onChange={(event) => updateField('contactName', event.target.value)}
            />
          </label>

          <label className="field">
            <span>郵便番号</span>
            <input
              type="text"
              required
              value={formState.postalCode}
              onChange={(event) => updateField('postalCode', event.target.value)}
            />
          </label>

          <label className="field">
            <span>住所</span>
            <input
              type="text"
              required
              value={formState.address}
              onChange={(event) => updateField('address', event.target.value)}
            />
          </label>

          <label className="field">
            <span>電話番号</span>
            <input
              type="tel"
              required
              value={formState.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </label>

          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              required
              value={formState.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </label>

          <label className="field field-full">
            <span>振込先情報</span>
            <textarea
              rows="5"
              required
              value={formState.bankInfo}
              onChange={(event) => updateField('bankInfo', event.target.value)}
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onRestoreDemoData}>
            ダミーデータ復元
          </button>
          <button type="submit" className="primary-button">
            設定を保存
          </button>
        </div>
      </form>

      <section className="panel preview-panel">
        <div className="panel-header">
          <div>
            <h3>表示確認</h3>
            <p>空状態と読み込み中の確認用です。必要に応じて画面状態を切り替えられます。</p>
          </div>
        </div>

        <div className="inline-actions">
          <button type="button" className="secondary-button" onClick={onPreviewLoading}>
            読み込みを再表示
          </button>
          <button type="button" className="secondary-button subtle" onClick={onClearInvoices}>
            請求書を0件にする
          </button>
          <button
            type="button"
            className="secondary-button subtle"
            onClick={onClearPendingInvoices}
          >
            承認待ちを0件にする
          </button>
          <button type="button" className="secondary-button" onClick={onRestoreDemoData}>
            ダミーデータ復元
          </button>
        </div>
      </section>
    </section>
  )
}

function StatusBadge({ status }) {
  return <span className={`status-badge is-${statusLabels[status]}`}>{status}</span>
}

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function EmptyState({ onCreateInvoice }) {
  return (
    <div className="empty-state">
      <h4>請求書がまだありません</h4>
      <p>最初の請求書を作成しましょう</p>
      <button type="button" className="primary-button" onClick={onCreateInvoice}>
        請求書を作成
      </button>
    </div>
  )
}

function NoResultsState({ onReset }) {
  return (
    <div className="empty-state">
      <h4>条件に一致する請求書がありません</h4>
      <p>検索条件やステータスを変更してください</p>
      <button type="button" className="secondary-button" onClick={onReset}>
        条件をリセット
      </button>
    </div>
  )
}

function LoadingScreen({ activeView }) {
  if (activeView === 'dashboard') {
    return <DashboardLoadingPanel />
  }

  if (activeView === 'invoices') {
    return <InvoicesLoadingPanel />
  }

  if (activeView === 'approvals') {
    return <ApprovalsLoadingPanel />
  }

  return <FormLoadingPanel />
}

function DashboardLoadingPanel() {
  return (
    <section className="page-section">
      <div className="loading-panel" aria-live="polite" aria-busy="true">
        <p>読み込み中...</p>
        <div className="skeleton-grid skeleton-grid-stats">
          <div className="skeleton-card skeleton-card-stat" />
          <div className="skeleton-card skeleton-card-stat" />
          <div className="skeleton-card skeleton-card-stat" />
          <div className="skeleton-card skeleton-card-stat" />
        </div>
        <div className="split-grid">
          <section className="panel skeleton-panel">
            <div className="skeleton-list">
              <div className="skeleton-row skeleton-row-heading" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </div>
          </section>
          <section className="panel skeleton-panel">
            <div className="skeleton-grid skeleton-grid-status">
              <div className="skeleton-card skeleton-card-status" />
              <div className="skeleton-card skeleton-card-status" />
              <div className="skeleton-card skeleton-card-status" />
              <div className="skeleton-card skeleton-card-status" />
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

function InvoicesLoadingPanel() {
  return (
    <section className="page-section">
      <div className="loading-panel" aria-live="polite" aria-busy="true">
        <p>読み込み中...</p>
        <section className="panel skeleton-panel">
          <div className="skeleton-grid skeleton-grid-filters">
            <div className="skeleton-card skeleton-card-input" />
            <div className="skeleton-card skeleton-card-input" />
          </div>
          <div className="skeleton-list">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </section>
      </div>
    </section>
  )
}

function ApprovalsLoadingPanel() {
  return (
    <section className="page-section">
      <div className="loading-panel" aria-live="polite" aria-busy="true">
        <p>読み込み中...</p>
        <section className="panel skeleton-panel">
          <div className="skeleton-list">
            <div className="skeleton-row skeleton-row-tall" />
            <div className="skeleton-row skeleton-row-tall" />
            <div className="skeleton-row skeleton-row-tall" />
          </div>
        </section>
      </div>
    </section>
  )
}

function FormLoadingPanel() {
  return (
    <section className="page-section">
      <div className="loading-panel" aria-live="polite" aria-busy="true">
        <p>読み込み中...</p>
        <section className="panel skeleton-panel">
          <div className="skeleton-grid skeleton-grid-form">
            <div className="skeleton-card skeleton-card-input" />
            <div className="skeleton-card skeleton-card-input" />
            <div className="skeleton-card skeleton-card-input" />
            <div className="skeleton-card skeleton-card-input" />
            <div className="skeleton-card skeleton-card-area" />
          </div>
          <div className="skeleton-list">
            <div className="skeleton-row skeleton-row-tall" />
            <div className="skeleton-row skeleton-row-tall" />
          </div>
        </section>
      </div>
    </section>
  )
}

function InfoPair({ label, value }) {
  return (
    <div className="info-pair">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function loadInvoices() {
  const fallback = demoInvoices.map((invoice) => normalizeInvoice(invoice))
  const stored = loadFromStorage(invoiceStorageKey, fallback)

  return Array.isArray(stored) ? stored.map((invoice) => normalizeInvoice(invoice)) : fallback
}

function loadSettings() {
  return loadFromStorage(settingsStorageKey, defaultCompanySettings)
}

function loadFromStorage(key, fallbackValue) {
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) {
      return fallbackValue
    }

    return JSON.parse(stored)
  } catch {
    return fallbackValue
  }
}

function buildMetrics(invoices) {
  const now = new Date()
  const monthlyInvoices = invoices.filter((invoice) => {
    const issuedAt = new Date(invoice.issueDate)
    return issuedAt.getFullYear() === now.getFullYear() && issuedAt.getMonth() === now.getMonth()
  })

  const monthlyTotal = monthlyInvoices.reduce((sum, invoice) => sum + invoice.total, 0)
  const monthlyPaid = monthlyInvoices
    .filter((invoice) => invoice.status === '入金済み')
    .reduce((sum, invoice) => sum + invoice.total, 0)
  const statusCounts = invoiceStatuses.reduce(
    (accumulator, status) => ({
      ...accumulator,
      [status]: invoices.filter((invoice) => invoice.status === status).length,
    }),
    {},
  )
  const recentInvoices = [...invoices]
    .sort((left, right) => new Date(right.issueDate) - new Date(left.issueDate))
    .slice(0, 5)

  return {
    monthlyTotal,
    monthlyPaid,
    monthlyOutstanding: monthlyTotal - monthlyPaid,
    monthlyCount: monthlyInvoices.length,
    recentInvoices,
    statusCounts,
  }
}

function normalizeInvoice(invoice) {
  const items = (invoice.items ?? []).map((item) => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
  }))
  const subtotal = calculateSubtotal(items)
  const tax = Math.round(subtotal * taxRate)
  const total = subtotal + tax

  return {
    ...invoice,
    items,
    subtotal,
    tax,
    total,
    status: applyOverdueStatus(invoice.status, invoice.dueDate),
  }
}

function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

function applyOverdueStatus(currentStatus, dueDate) {
  if (currentStatus === '入金済み' || currentStatus === '下書き' || currentStatus === '承認待ち') {
    return currentStatus
  }

  const today = startOfDay(new Date())
  const due = startOfDay(new Date(dueDate))

  if (Number.isNaN(due.getTime())) {
    return currentStatus
  }

  return due < today ? '期限超過' : currentStatus
}

function buildInitialFormState(invoice) {
  if (invoice) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      subject: invoice.subject,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      notes: invoice.notes,
      items: invoice.items.map((item) => ({ ...item })),
    }
  }

  return {
    clientName: '',
    subject: '',
    issueDate: toDateInputValue(new Date()),
    dueDate: toDateInputValue(addDays(new Date(), 14)),
    status: '下書き',
    notes: '',
    items: [{ id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 }],
  }
}

function getViewDescription(activeView, editingInvoice) {
  if (activeView === 'dashboard') {
    return '請求業務の状況を確認'
  }

  if (activeView === 'invoices') {
    return '請求書を一覧で管理'
  }

  if (activeView === 'editor') {
    return editingInvoice ? '既存の請求書を更新' : '新しい請求書を登録'
  }

  if (activeView === 'approvals') {
    return '承認待ち案件を処理'
  }

  return '会社情報を保存'
}

function formatCurrency(value) {
  return currencyFormatter.format(value)
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateFormatter.format(date)
}

function buildNextInvoiceNumber(invoices) {
  const now = new Date()
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const nextSequence =
    invoices
      .map((invoice) => invoice.invoiceNumber)
      .filter((invoiceNumber) => invoiceNumber.startsWith(prefix))
      .map((invoiceNumber) => Number(invoiceNumber.split('-').at(-1)) || 0)
      .reduce((max, sequence) => Math.max(max, sequence), 0) + 1

  return `${prefix}-${String(nextSequence).padStart(3, '0')}`
}

function nextPreviewNumber(invoices) {
  return buildNextInvoiceNumber(invoices)
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export default App
