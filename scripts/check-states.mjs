import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const consoleErrors = []
page.on('pageerror', (error) => {
  consoleErrors.push(`pageerror: ${error.message}`)
})
page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(`console: ${message.text()}`)
  }
})

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })

  await page.getByText('読み込み中...').waitFor({ timeout: 1500 })
  const loadingButtonDisabled = await page
    .getByRole('button', { name: '新規請求書' })
    .isDisabled()
  if (!loadingButtonDisabled) {
    throw new Error('読み込み中に操作ボタンが無効化されていません')
  }
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '請求書一覧' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: '全件クリア' }).click()
  await page.getByText('請求書がまだありません').waitFor()
  await page.getByRole('button', { name: '請求書を作成' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('heading', { name: '請求書を作成' }).waitFor()

  await page.getByRole('button', { name: '設定' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'ダミーデータ復元' }).first().click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '承認待ちを0件にする' }).click()
  await page.getByRole('button', { name: /承認待ち一覧/ }).click()
  await page.waitForTimeout(800)
  await page.getByText('承認待ちの請求書はありません').waitFor()
  await page.getByText('現在、確認が必要な請求書はありません').waitFor()

  await page.getByRole('button', { name: '請求書一覧' }).click()
  await page.waitForTimeout(800)
  await page.getByLabel('キーワード検索').fill('zzz-no-result')
  await page.getByText('条件に一致する請求書がありません').waitFor()
  await page.getByText('検索条件やステータスを変更してください').waitFor()
  await page.getByRole('button', { name: '条件をリセット' }).click()
  await page.waitForTimeout(200)
  await page.getByLabel('キーワード検索').waitFor()
  const searchValue = await page.getByLabel('キーワード検索').inputValue()
  if (searchValue !== '') {
    throw new Error('条件リセット後も検索キーワードが残っています')
  }

  await page.getByRole('button', { name: '設定' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: '読み込みを再表示' }).click()
  await page.getByText('読み込み中...').waitFor({ timeout: 1500 })

  if (consoleErrors.length > 0) {
    throw new Error(consoleErrors.join('\n'))
  }

  console.log('state QA passed')
} finally {
  await browser.close()
}
