import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { defaultCompanySettings, taxRate } from './mockData'
import {
  buildFriendlyError,
  deleteInvoiceRecord,
  fetchInvoiceDetail,
  fetchWorkspaceData,
  invoiceStatusOptions,
  saveInvoiceRecord,
  updateInvoiceStatusRecord,
} from './lib/invoiceData'
import { buildAuthError } from './lib/authErrors'
import { supabase, supabaseConfigError } from './lib/supabase'

const settingsStorageKey = 'invoice-app:settings'

const navigationItems = [
  { id: 'dashboard', label: 'ダッシュボード', path: '/dashboard' },
  { id: 'invoices', label: '請求書一覧', path: '/invoices' },
  { id: 'editor', label: '請求書作成・編集', path: '/invoices/new' },
  { id: 'approvals', label: '承認待ち一覧', path: '/approvals' },
  { id: 'settings', label: '設定', path: '/settings' },
]

const statusLabels = {
  下書き: 'draft',
  承認待ち: 'pending',
  送付済み: 'sent',
  入金済み: 'paid',
  期限超過: 'overdue',
  差し戻し: 'rejected',
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

function App({ session }) {
  const userId = session?.user?.id ?? ''
  const [activeView, setActiveView] = useState(() => getViewFromPath(window.location.pathname))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState(() =>
    getViewFromPath(window.location.pathname) === 'editor'
      ? new URLSearchParams(window.location.search).get('id')
      : null,
  )
  const [workspace, setWorkspace] = useState({ invoices: [], clients: [] })
  const [workspaceState, setWorkspaceState] = useState({ loading: true, error: '' })
  const [editorInvoice, setEditorInvoice] = useState(null)
  const [editorState, setEditorState] = useState({ loading: false, error: '' })
  const [companySettings, setCompanySettings] = useState(() => loadSettings())
  const [loadingTick, setLoadingTick] = useState(0)
  const [processingInvoiceId, setProcessingInvoiceId] = useState('')
  const [deletingInvoiceId, setDeletingInvoiceId] = useState('')
  const [notice, setNotice] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(companySettings))
  }, [companySettings])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setNotice(null)
    }, 3200)

    return () => window.clearTimeout(timerId)
  }, [notice])

  useEffect(() => {
    let isCancelled = false

    const loadWorkspace = async () => {
      setMobileMenuOpen(false)
      setWorkspaceState({ loading: true, error: '' })

      const startedAt = Date.now()

      try {
        if (supabaseConfigError) {
          throw new Error(supabaseConfigError)
        }

        if (!userId) {
          throw new Error('ログイン情報を確認できません。もう一度ログインしてください')
        }

        const data = await fetchWorkspaceData(userId)
        await waitForMinimumLoading(startedAt, 650)

        if (!isCancelled) {
          setWorkspace(data)
          setWorkspaceState({ loading: false, error: '' })
        }
      } catch (error) {
        await waitForMinimumLoading(startedAt, 650)

        if (!isCancelled) {
          setWorkspaceState({
            loading: false,
            error: buildFriendlyError(
              error,
              '請求書の取得に失敗しました。もう一度お試しください',
            ),
          })
        }
      }
    }

    loadWorkspace()

    return () => {
      isCancelled = true
    }
  }, [activeView, loadingTick, userId])

  useEffect(() => {
    if (activeView !== 'editor' || !editingInvoiceId || workspaceState.error) {
      setEditorInvoice(null)
      setEditorState({ loading: false, error: '' })
      return undefined
    }

    let isCancelled = false

    const loadEditorInvoice = async () => {
      setEditorState({ loading: true, error: '' })
      const startedAt = Date.now()

      try {
        const detail = await fetchInvoiceDetail(editingInvoiceId, userId)
        await waitForMinimumLoading(startedAt, 400)

        if (!isCancelled) {
          setEditorInvoice(detail)
          setEditorState({ loading: false, error: '' })
        }
      } catch (error) {
        await waitForMinimumLoading(startedAt, 400)

        if (!isCancelled) {
          setEditorState({
            loading: false,
            error: buildFriendlyError(error, '請求書の取得に失敗しました。もう一度お試しください'),
          })
        }
      }
    }

    loadEditorInvoice()

    return () => {
      isCancelled = true
    }
  }, [activeView, editingInvoiceId, workspaceState.error, userId])

  const metrics = useMemo(() => buildMetrics(workspace.invoices), [workspace.invoices])

  const navigateTo = (view, nextInvoiceId = null) => {
    setMobileMenuOpen(false)
    setEditingInvoiceId(nextInvoiceId)
    setActiveView(view)
    const nextPath = view === 'editor' && nextInvoiceId
      ? `/invoices/edit?id=${encodeURIComponent(nextInvoiceId)}`
      : navigationItems.find((item) => item.id === view)?.path ?? '/dashboard'
    window.history.pushState({}, '', nextPath)
  }

  useEffect(() => {
    const handlePopState = () => {
      const nextView = getViewFromPath(window.location.pathname)
      const invoiceId = nextView === 'editor'
        ? new URLSearchParams(window.location.search).get('id')
        : null
      setActiveView(nextView)
      setEditingInvoiceId(invoiceId)
      setMobileMenuOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    setNotice(null)
    setWorkspace({ invoices: [], clients: [] })
    setEditorInvoice(null)
    setEditingInvoiceId(null)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.history.replaceState({}, '', '/login')
    } catch (error) {
      setNotice({ type: 'error', message: buildAuthError(error, 'logout') })
      setLoggingOut(false)
      triggerReload()
    }
  }

  const triggerReload = () => {
    setLoadingTick((current) => current + 1)
  }

  const handleCreateInvoice = () => {
    navigateTo('editor', null)
  }

  const handleEditInvoice = (invoiceId) => {
    navigateTo('editor', invoiceId)
  }

  const handleSaveInvoice = async (payload) => {
    try {
      await saveInvoiceRecord({
        invoice: payload,
        currentInvoice: editingInvoiceId ? editorInvoice : null,
        clients: workspace.clients,
        userId,
      })

      setNotice({
        type: 'success',
        message: editingInvoiceId ? '請求書を更新しました。' : '請求書を保存しました。',
      })
      navigateTo('invoices')
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: buildFriendlyError(error, '請求書を保存できませんでした'),
      }
    }
  }

  const handleDeleteInvoice = async (invoiceId) => {
    const targetInvoice = workspace.invoices.find((invoice) => invoice.id === invoiceId)
    const confirmed = window.confirm(
      `${targetInvoice?.invoiceNumber ?? 'この請求書'}を削除しますか？\n関連する品目と入金情報も削除されます。`,
    )

    if (!confirmed) {
      return
    }

    setDeletingInvoiceId(invoiceId)

    try {
      await deleteInvoiceRecord(invoiceId, userId)
      setNotice({ type: 'success', message: '請求書を削除しました。' })
      triggerReload()
    } catch (error) {
      setNotice({
        type: 'error',
        message: buildFriendlyError(error, '請求書を削除できませんでした'),
      })
    } finally {
      setDeletingInvoiceId('')
    }
  }

  const handleUpdateInvoiceStatus = async (invoiceId, nextStatus, successMessage) => {
    setProcessingInvoiceId(invoiceId)

    try {
      await updateInvoiceStatusRecord(invoiceId, nextStatus, userId)
      setNotice({ type: 'success', message: successMessage })
      triggerReload()
    } catch (error) {
      setNotice({
        type: 'error',
        message: buildFriendlyError(error, 'ステータスの更新に失敗しました'),
      })
    } finally {
      setProcessingInvoiceId('')
    }
  }

  const handleSaveSettings = (nextSettings) => {
    setCompanySettings(nextSettings)
    setNotice({ type: 'success', message: '設定を保存しました。' })
  }

  const headerTitle = navigationItems.find((item) => item.id === activeView)?.label ?? '請求書管理'
  const headerDescription = getViewDescription(activeView, editingInvoiceId)

  let content = null

  if (activeView === 'dashboard') {
    if (workspaceState.loading) {
      content = <LoadingScreen activeView={activeView} />
    } else if (workspaceState.error) {
      content = <ErrorState message={workspaceState.error} onRetry={triggerReload} />
    } else {
      content = (
        <DashboardScreen
          metrics={metrics}
          onCreateInvoice={handleCreateInvoice}
          onEditInvoice={handleEditInvoice}
        />
      )
    }
  } else if (activeView === 'invoices') {
    if (workspaceState.loading) {
      content = <LoadingScreen activeView={activeView} />
    } else if (workspaceState.error) {
      content = <ErrorState message={workspaceState.error} onRetry={triggerReload} />
    } else {
      content = (
        <InvoicesScreen
          invoices={workspace.invoices}
          onCreateInvoice={handleCreateInvoice}
          onDeleteInvoice={handleDeleteInvoice}
          onEditInvoice={handleEditInvoice}
          deletingInvoiceId={deletingInvoiceId}
        />
      )
    }
  } else if (activeView === 'editor') {
    if (workspaceState.loading) {
      content = <LoadingScreen activeView={activeView} />
    } else if (workspaceState.error) {
      content = <ErrorState message={workspaceState.error} onRetry={triggerReload} />
    } else if (editingInvoiceId && editorState.loading) {
      content = <LoadingScreen activeView={activeView} />
    } else if (editingInvoiceId && editorState.error) {
      content = <ErrorState message={editorState.error} onRetry={triggerReload} />
    } else {
      content = (
        <InvoiceEditorScreen
          invoice={editingInvoiceId ? editorInvoice : null}
          invoices={workspace.invoices}
          clients={workspace.clients}
          onCancel={() => navigateTo('invoices')}
          onSave={handleSaveInvoice}
        />
      )
    }
  } else if (activeView === 'approvals') {
    if (workspaceState.loading) {
      content = <LoadingScreen activeView={activeView} />
    } else if (workspaceState.error) {
      content = <ErrorState message={workspaceState.error} onRetry={triggerReload} />
    } else {
      content = (
        <ApprovalsScreen
          invoices={workspace.invoices}
          onEditInvoice={handleEditInvoice}
          onApprove={(invoiceId) =>
            handleUpdateInvoiceStatus(invoiceId, '送付済み', '請求書を承認しました。')
          }
          onReject={(invoiceId) =>
            handleUpdateInvoiceStatus(invoiceId, '差し戻し', '請求書を差し戻しました。')
          }
          processingInvoiceId={processingInvoiceId}
        />
      )
    }
  } else if (activeView === 'settings') {
    content = (
      <SettingsScreen
        companySettings={companySettings}
        onSave={handleSaveSettings}
        onPreviewLoading={triggerReload}
        supabaseError={workspaceState.error || supabaseConfigError}
      />
    )
  }

  const isBusy = workspaceState.loading || editorState.loading

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
            disabled={isBusy}
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
              onClick={() => navigateTo(item.id, null)}
              disabled={isBusy}
            >
              <span>{item.label}</span>
              {item.id === 'approvals' ? <strong>{metrics.statusCounts['承認待ち']}</strong> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-summary">
          <p>請求総額</p>
          <strong>{formatCurrency(metrics.totalAmount)}</strong>
          <span>{metrics.invoiceCount} 件</span>
        </div>

        <div className="account-block">
          <div>
            <span>ログイン中</span>
            <strong title={session.user.email ?? ''}>{session.user.email ?? 'メールアドレス未設定'}</strong>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'ログアウト中...' : 'ログアウト'}
          </button>
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
              disabled={isBusy}
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
              disabled={isBusy || Boolean(workspaceState.error)}
            >
              新規請求書
            </button>
          </div>
        </header>

        {notice ? (
          <div className={`notice-banner ${notice.type === 'error' ? 'is-error' : ''}`}>
            {notice.message}
          </div>
        ) : null}

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
          <h3>請求サマリー</h3>
          <p>Supabase上の請求書と入金情報をもとに集計しています。</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="請求総額" value={formatCurrency(metrics.totalAmount)} />
        <StatCard label="入金済み金額" value={formatCurrency(metrics.paidAmount)} />
        <StatCard label="未入金金額" value={formatCurrency(metrics.outstandingAmount)} />
        <StatCard label="請求書件数" value={`${metrics.invoiceCount} 件`} />
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
              <p>請求書の進捗をリアルタイムに確認できます。</p>
            </div>
          </div>

          <div className="status-summary-grid">
            {invoiceStatusOptions.map((status) => (
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
  onDeleteInvoice,
  onEditInvoice,
  deletingInvoiceId,
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
        [invoice.invoiceNumber, invoice.clientName, invoice.subject, invoice.notes]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedKeyword))

      return matchesStatus && matchesKeyword
    })
  }, [invoices, keyword, statusFilter])

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>請求書一覧</h3>
          <p>Supabase上の請求書を検索、絞り込み、編集、削除できます。</p>
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
              {invoiceStatusOptions.map((status) => (
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
                        <div className="table-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onEditInvoice(invoice.id)}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className="text-button danger-text"
                            onClick={() => onDeleteInvoice(invoice.id)}
                            disabled={deletingInvoiceId === invoice.id}
                          >
                            {deletingInvoiceId === invoice.id ? '削除中...' : '削除'}
                          </button>
                        </div>
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
                  <div className="card-action-stack">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onEditInvoice(invoice.id)}
                    >
                      編集する
                    </button>
                    <button
                      type="button"
                      className="secondary-button subtle"
                      onClick={() => onDeleteInvoice(invoice.id)}
                      disabled={deletingInvoiceId === invoice.id}
                    >
                      {deletingInvoiceId === invoice.id ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}

function InvoiceEditorScreen({ invoice, invoices, clients, onCancel, onSave }) {
  const [formState, setFormState] = useState(() => buildInitialFormState(invoice))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setFormState(buildInitialFormState(invoice))
    setSaveError('')
    setIsSaving(false)
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
              [field]:
                field === 'name' || field === 'description' ? value : Number(value),
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
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
        },
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaveError('')

    const sanitizedItems = formState.items
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
      }))
      .filter((item) => item.name && item.quantity > 0)

    if (sanitizedItems.length === 0) {
      setSaveError('少なくとも1件の品目を入力してください')
      return
    }

    setIsSaving(true)

    const result = await onSave({
      ...invoice,
      ...formState,
      invoiceNumber: formState.invoiceNumber || buildNextInvoiceNumber(invoices),
      clientName: formState.clientName.trim(),
      subject: formState.subject.trim(),
      notes: formState.notes.trim(),
      items: sanitizedItems,
      subtotal,
      tax,
      total,
    })

    if (!result.ok) {
      setSaveError(result.error)
      setIsSaving(false)
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>{invoice ? '請求書を編集' : '請求書を作成'}</h3>
          <p>保存時に取引先、請求書、品目を順にSupabaseへ反映します。</p>
        </div>
      </div>

      {saveError ? <div className="notice-banner is-error">{saveError}</div> : null}

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field">
            <span>取引先名</span>
            <input
              type="text"
              list="client-suggestions"
              required
              value={formState.clientName}
              onChange={(event) => updateField('clientName', event.target.value)}
              placeholder="株式会社サンプル"
            />
            <datalist id="client-suggestions">
              {clients.map((client) => (
                <option key={client.id} value={client.name} />
              ))}
            </datalist>
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
              {invoiceStatusOptions.map((status) => (
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
            <button type="button" className="secondary-button" onClick={addItem} disabled={isSaving}>
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
                    disabled={formState.items.length === 1 || isSaving}
                  >
                    削除
                  </button>
                </div>

                <div className="line-items-detail-grid">
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

                  <label className="field field-full">
                    <span>説明</span>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => updateItem(item.id, 'description', event.target.value)}
                      placeholder="品目の説明"
                    />
                  </label>

                  <div className="line-item-grid">
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
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            キャンセル
          </button>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? '保存中...' : '保存する'}
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
          <InfoPair label="請求書番号" value={formState.invoiceNumber || buildNextInvoiceNumber(invoices)} />
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

function ApprovalsScreen({ invoices, onEditInvoice, onApprove, onReject, processingInvoiceId }) {
  const pendingInvoices = invoices.filter((invoice) => invoice.status === '承認待ち')

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h3>承認待ち一覧</h3>
          <p>status が pending の請求書を Supabase から表示しています。</p>
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
                    disabled={processingInvoiceId === invoice.id}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="secondary-button subtle"
                    onClick={() => onReject(invoice.id)}
                    disabled={processingInvoiceId === invoice.id}
                  >
                    {processingInvoiceId === invoice.id ? '処理中...' : '差し戻し'}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onApprove(invoice.id)}
                    disabled={processingInvoiceId === invoice.id}
                  >
                    {processingInvoiceId === invoice.id ? '処理中...' : '承認'}
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

function SettingsScreen({ companySettings, onSave, onPreviewLoading, supabaseError }) {
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
          <p>設定画面はローカル保存のまま維持しています。</p>
        </div>
      </div>

      {supabaseError ? <div className="notice-banner is-error">{supabaseError}</div> : null}

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
          <button type="button" className="secondary-button" onClick={onPreviewLoading}>
            読み込みを再表示
          </button>
          <button type="submit" className="primary-button">
            設定を保存
          </button>
        </div>
      </form>
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

function ErrorState({ message, onRetry }) {
  return (
    <section className="page-section">
      <div className="panel error-panel">
        <h3>エラーが発生しました</h3>
        <p>{message}</p>
        <div className="error-actions">
          <button type="button" className="primary-button" onClick={onRetry}>
            再読み込み
          </button>
        </div>
      </div>
    </section>
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

function buildMetrics(invoices) {
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.total, 0)
  const paidAmount = invoices.reduce(
    (sum, invoice) =>
      sum + invoice.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
    0,
  )
  const statusCounts = invoiceStatusOptions.reduce(
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
    totalAmount,
    paidAmount,
    outstandingAmount: Math.max(totalAmount - paidAmount, 0),
    invoiceCount: invoices.length,
    recentInvoices,
    statusCounts,
  }
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
      items: invoice.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }
  }

  return {
    invoiceNumber: '',
    clientName: '',
    subject: '',
    issueDate: toDateInputValue(new Date()),
    dueDate: toDateInputValue(addDays(new Date(), 14)),
    status: '下書き',
    notes: '',
    items: [
      {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
      },
    ],
  }
}

function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0)
}

function getViewDescription(activeView, editingInvoiceId) {
  if (activeView === 'dashboard') {
    return 'Supabaseの請求業務データを確認'
  }

  if (activeView === 'invoices') {
    return '請求書を一覧で管理'
  }

  if (activeView === 'editor') {
    return editingInvoiceId ? '既存の請求書を更新' : '新しい請求書を登録'
  }

  if (activeView === 'approvals') {
    return '承認待ち案件を処理'
  }

  return '会社情報を保存'
}

function getViewFromPath(pathname) {
  if (pathname === '/invoices/new' || pathname === '/invoices/edit') return 'editor'
  if (pathname === '/invoices') return 'invoices'
  if (pathname === '/approvals') return 'approvals'
  if (pathname === '/settings') return 'settings'
  return 'dashboard'
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

function loadSettings() {
  try {
    const stored = window.localStorage.getItem(settingsStorageKey)
    return stored ? JSON.parse(stored) : defaultCompanySettings
  } catch {
    return defaultCompanySettings
  }
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0)
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

async function waitForMinimumLoading(startedAt, minimumMs) {
  const elapsed = Date.now() - startedAt
  const remaining = minimumMs - elapsed

  if (remaining > 0) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, remaining)
    })
  }
}

export default App
