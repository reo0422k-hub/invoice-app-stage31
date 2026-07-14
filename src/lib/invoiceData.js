import { supabase, supabaseConfigError } from './supabase'

const dbToUiStatusMap = {
  draft: '下書き',
  pending: '承認待ち',
  sent: '送付済み',
  paid: '入金済み',
  overdue: '期限超過',
  rejected: '差し戻し',
}

const uiToDbStatusMap = Object.fromEntries(
  Object.entries(dbToUiStatusMap).map(([dbStatus, uiStatus]) => [uiStatus, dbStatus]),
)

const invoiceSummarySelect = `
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
  notes,
  created_at,
  updated_at,
  client:clients!invoices_client_id_fkey (
    id,
    name,
    contact_name,
    email,
    phone,
    address,
    created_at,
    updated_at
  ),
  payments:payments!payments_invoice_id_fkey (
    id,
    payment_date,
    amount,
    payment_method,
    notes,
    created_at
  )
`

const invoiceDetailSelect = `
  ${invoiceSummarySelect},
  items:invoice_items!invoice_items_invoice_id_fkey (
    id,
    item_name,
    description,
    quantity,
    unit_price,
    amount,
    sort_order,
    created_at
  )
`

export const invoiceStatusOptions = [
  '下書き',
  '承認待ち',
  '送付済み',
  '入金済み',
  '期限超過',
  '差し戻し',
]

export async function fetchWorkspaceData(userId) {
  ensureAuthenticatedUser(userId)

  const [invoiceResponse, clientResponse] = await Promise.all([
    supabase.from('invoices').select(invoiceSummarySelect).eq('user_id', userId).eq('client.user_id', userId).eq('payments.user_id', userId).order('issue_date', { ascending: false }),
    supabase.from('clients').select('*').eq('user_id', userId).order('name', { ascending: true }),
  ])

  if (invoiceResponse.error) {
    throw invoiceResponse.error
  }

  if (clientResponse.error) {
    throw clientResponse.error
  }

  return {
    invoices: invoiceResponse.data.map((invoice) => formatInvoiceRecord(invoice)),
    clients: clientResponse.data.map((client) => formatClientRecord(client)),
  }
}

export async function fetchInvoiceDetail(invoiceId, userId) {
  ensureAuthenticatedUser(userId)

  const { data, error } = await supabase
    .from('invoices')
    .select(invoiceDetailSelect)
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .eq('client.user_id', userId)
    .eq('payments.user_id', userId)
    .eq('items.user_id', userId)
    .single()

  if (error) {
    throw error
  }

  return formatInvoiceRecord(data)
}

export async function saveInvoiceRecord({ invoice, currentInvoice, clients, userId }) {
  ensureAuthenticatedUser(userId)

  const resolvedClient = await resolveClient({
    clientName: invoice.clientName,
    currentInvoice,
    clients,
    userId,
  })

  const invoicePayload = {
    invoice_number: invoice.invoiceNumber,
    client_id: resolvedClient.id,
    title: invoice.subject.trim(),
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    status: mapUiStatusToDb(invoice.status),
    subtotal: invoice.subtotal,
    tax_amount: invoice.tax,
    total_amount: invoice.total,
    notes: invoice.notes.trim() || null,
    user_id: userId,
  }

  const isEditing = Boolean(currentInvoice?.id)
  let invoiceId = currentInvoice?.id ?? ''

  if (isEditing) {
    const { error } = await supabase.from('invoices').update(invoicePayload).eq('id', currentInvoice.id).eq('user_id', userId)
    if (error) {
      throw error
    }
  } else {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoicePayload)
      .select('id')
      .single()

    if (error) {
      throw error
    }

    invoiceId = data.id
  }

  const itemRows = invoice.items.map((item, index) => ({
    id: item.id,
    invoice_id: invoiceId,
    item_name: item.name.trim(),
    description: item.description?.trim() || null,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unitPrice) || 0,
    amount: Number(item.quantity) * Number(item.unitPrice),
    sort_order: index,
    user_id: userId,
  }))

  const originalItemIds = new Set((currentInvoice?.items ?? []).map((item) => item.id))
  const existingItemRows = itemRows.filter((item) => originalItemIds.has(item.id))
  const newItemRows = itemRows.filter((item) => !originalItemIds.has(item.id))

  const itemResponses = await Promise.all([
    ...existingItemRows.map((item) =>
      supabase
        .from('invoice_items')
        .update(item)
        .eq('id', item.id)
        .eq('user_id', userId),
    ),
    ...(newItemRows.length > 0
      ? [supabase.from('invoice_items').insert(newItemRows)]
      : []),
  ])
  const itemError = itemResponses.find((response) => response.error)?.error

  if (itemError) {
    if (!isEditing && invoiceId) {
      await supabase.from('invoices').delete().eq('id', invoiceId).eq('user_id', userId)
    }
    throw itemError
  }

  if (isEditing) {
    const originalItemIdList = [...originalItemIds]
    const nextItemIds = itemRows.map((item) => item.id)
    const removedItemIds = originalItemIdList.filter((itemId) => !nextItemIds.includes(itemId))

    if (removedItemIds.length > 0) {
      const { error: deleteItemsError } = await supabase
        .from('invoice_items')
        .delete()
        .in('id', removedItemIds)
        .eq('user_id', userId)

      if (deleteItemsError) {
        throw deleteItemsError
      }
    }
  }

  return invoiceId
}

export async function deleteInvoiceRecord(invoiceId, userId) {
  ensureAuthenticatedUser(userId)

  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId).eq('user_id', userId)

  if (error) {
    throw error
  }
}

export async function updateInvoiceStatusRecord(invoiceId, nextStatus, userId) {
  ensureAuthenticatedUser(userId)

  const { error } = await supabase
    .from('invoices')
    .update({ status: mapUiStatusToDb(nextStatus) })
    .eq('id', invoiceId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

export function buildFriendlyError(error, fallbackMessage) {
  if (supabaseConfigError) {
    return supabaseConfigError
  }

  if (!error) {
    return fallbackMessage
  }

  if (error.code === '42501' || String(error.message).includes('row-level security')) {
    return 'Supabaseの権限設定を確認してください。必要なRLSポリシーが不足している可能性があります'
  }

  if (error.code === '23505') {
    return '請求書番号が重複しています'
  }

  if (error.code === '23503') {
    return '関連するデータの保存に失敗しました'
  }

  return fallbackMessage
}

export function mapUiStatusToDb(uiStatus) {
  return uiToDbStatusMap[uiStatus] ?? 'draft'
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError || 'Supabaseの接続設定を確認してください')
  }
}

function ensureAuthenticatedUser(userId) {
  ensureSupabase()
  if (!userId) {
    throw new Error('ログイン情報を確認できません。もう一度ログインしてください')
  }
}

async function resolveClient({ clientName, currentInvoice, clients, userId }) {
  const normalizedName = normalizeText(clientName)
  const matchingClient = clients.find((client) => normalizeText(client.name) === normalizedName)

  if (currentInvoice?.client?.id) {
    if (matchingClient && matchingClient.id !== currentInvoice.client.id) {
      return matchingClient
    }

    if (
      normalizeText(currentInvoice.client.name) !== normalizedName &&
      !matchingClient
    ) {
      const { data, error } = await supabase
        .from('clients')
        .update({ name: clientName.trim() })
        .eq('id', currentInvoice.client.id)
        .eq('user_id', userId)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      return formatClientRecord(data)
    }

    return matchingClient ?? currentInvoice.client
  }

  if (matchingClient) {
    return matchingClient
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ name: clientName.trim(), user_id: userId })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return formatClientRecord(data)
}

function formatInvoiceRecord(record) {
  const client = toSingleRelation(record.client)
  const payments = (record.payments ?? []).map((payment) => ({
    id: payment.id,
    paymentDate: payment.payment_date,
    amount: Number(payment.amount) || 0,
    paymentMethod: payment.payment_method ?? '',
    notes: payment.notes ?? '',
    createdAt: payment.created_at,
  }))
  const items = (record.items ?? [])
    .map((item) => ({
      id: item.id,
      name: item.item_name,
      description: item.description ?? '',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unit_price) || 0,
      amount: Number(item.amount) || 0,
      sortOrder: item.sort_order ?? 0,
      createdAt: item.created_at,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)

  return {
    id: record.id,
    invoiceNumber: record.invoice_number,
    clientId: record.client_id,
    client: client ? formatClientRecord(client) : null,
    clientName: client?.name ?? '取引先未設定',
    subject: record.title,
    issueDate: record.issue_date,
    dueDate: record.due_date,
    status: deriveUiStatus(record.status, record.due_date),
    rawStatus: record.status,
    subtotal: Number(record.subtotal) || 0,
    tax: Number(record.tax_amount) || 0,
    total: Number(record.total_amount) || 0,
    notes: record.notes ?? '',
    payments,
    items,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

function formatClientRecord(client) {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contact_name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  }
}

function deriveUiStatus(dbStatus, dueDate) {
  if (dbStatus === 'sent' && dueDate) {
    const today = startOfDay(new Date())
    const limit = startOfDay(new Date(dueDate))

    if (!Number.isNaN(limit.getTime()) && limit < today) {
      return '期限超過'
    }
  }

  return dbToUiStatusMap[dbStatus] ?? '下書き'
}

function normalizeText(value) {
  return value.trim().toLowerCase()
}

function toSingleRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
