import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:5173/'
const viewport = { width: 375, height: 812 }

const screens = [
  { id: 'dashboard', label: 'ダッシュボード' },
  { id: 'invoices', label: '請求書一覧' },
  { id: 'editor', label: '請求書作成・編集' },
  { id: 'approvals', label: '承認待ち一覧' },
  { id: 'settings', label: '設定' },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport })

const failures = []

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  for (const screen of screens) {
    await openMenu(page)
    await page.getByRole('button', { name: new RegExp(screen.label) }).click()
    await page.waitForTimeout(700)

    const sidebarOpenAfterNav = await page.locator('.sidebar').evaluate((node) =>
      node.classList.contains('is-open'),
    )

    if (sidebarOpenAfterNav) {
      failures.push(`${screen.label}: ナビゲーション後もサイドバーが閉じていません`)
    }

    const metrics = await page.evaluate(() => {
      const viewportWidth = window.innerWidth
      const doc = document.documentElement
      const scrollOverflow = Math.max(doc.scrollWidth - viewportWidth, 0)

      const overflowingElements = Array.from(document.querySelectorAll('*'))
        .map((element) => {
          const style = window.getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < viewportWidth

          if (!isVisible) {
            return null
          }

          const rightOverflow = rect.right - viewportWidth
          const leftOverflow = 0 - rect.left
          const horizontalOverflow = Math.max(rightOverflow, leftOverflow, 0)

          if (horizontalOverflow <= 1) {
            return null
          }

          return {
            tag: element.tagName.toLowerCase(),
            className: element.className,
            text: (element.textContent || '').trim().slice(0, 80),
            overflow: Number(horizontalOverflow.toFixed(2)),
          }
        })
        .filter(Boolean)
        .slice(0, 10)

      const smallButtons = Array.from(document.querySelectorAll('button'))
        .map((button) => {
          const style = window.getComputedStyle(button)
          const rect = button.getBoundingClientRect()
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight

          if (!isVisible) {
            return null
          }

          if (rect.width >= 40 && rect.height >= 40) {
            return null
          }

          return {
            text: (button.textContent || button.getAttribute('aria-label') || '')
              .trim()
              .slice(0, 40),
            width: Number(rect.width.toFixed(1)),
            height: Number(rect.height.toFixed(1)),
          }
        })
        .filter(Boolean)

      return {
        scrollOverflow,
        overflowingElements,
        smallButtons,
      }
    })

    if (metrics.scrollOverflow > 1) {
      failures.push(`${screen.label}: 横スクロールがあります (${metrics.scrollOverflow}px)`)
    }

    if (metrics.overflowingElements.length > 0) {
      failures.push(
        `${screen.label}: はみ出し要素 ${JSON.stringify(metrics.overflowingElements)}`,
      )
    }

    if (metrics.smallButtons.length > 0) {
      failures.push(`${screen.label}: 小さすぎるボタン ${JSON.stringify(metrics.smallButtons)}`)
    }
  }

  await openMenu(page)
  await page.mouse.click(viewport.width - 12, 120)
  await page.waitForTimeout(150)

  const sidebarStillOpen = await page.locator('.sidebar').evaluate((node) =>
    node.classList.contains('is-open'),
  )

  if (sidebarStillOpen) {
    failures.push('サイドバー: 背景クリック後も閉じていません')
  }
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error('375px mobile QA failed')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('375px mobile QA passed for all 5 screens')

async function openMenu(pageHandle) {
  const sidebar = pageHandle.locator('.sidebar')
  const menuButton = pageHandle.getByRole('button', { name: 'メニューを開く' })

  if (await sidebar.evaluate((node) => node.classList.contains('is-open'))) {
    return
  }

  await menuButton.click()
  await pageHandle.waitForTimeout(150)
}
