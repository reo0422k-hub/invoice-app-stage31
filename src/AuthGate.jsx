import { useEffect, useState } from 'react'
import App from './App.jsx'
import { buildAuthError } from './lib/authErrors.js'
import { supabase, supabaseConfigError } from './lib/supabase.js'

const protectedPaths = new Set([
  '/',
  '/dashboard',
  '/invoices',
  '/invoices/new',
  '/invoices/edit',
  '/approvals',
  '/settings',
])

export default function AuthGate() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let isMounted = true

    if (!supabase) {
      setCheckingSession(false)
      return undefined
    }

    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession)
        setCheckingSession(false)
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) console.error('セッションの取得に失敗しました', error)
      setSession(data.session ?? null)
      setCheckingSession(false)
    })

    return () => {
      isMounted = false
      subscriptionData.subscription.unsubscribe()
    }
  }, [])

  if (checkingSession) {
    return <SessionLoading />
  }

  const path = normalizePath(window.location.pathname)

  if (!session) {
    if (path !== '/login') replacePath('/login')
    return <AuthScreen configError={supabaseConfigError} />
  }

  if (path === '/login' || !protectedPaths.has(path)) {
    replacePath('/dashboard')
  }

  return <App session={session} />
}

function AuthScreen({ configError }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(configError || '')
  const [message, setMessage] = useState('')

  const switchMode = (nextMode) => {
    if (submitting) return
    setMode(nextMode)
    setPassword('')
    setPasswordConfirmation('')
    setError(configError || '')
    setMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    if (mode === 'signup' && password !== passwordConfirmation) {
      setError('パスワードが一致しません')
      return
    }

    if (!supabase) {
      setError(configError || 'Supabaseの接続設定を確認してください')
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError

        if (data.user?.identities?.length === 0) {
          setError('このメールアドレスはすでに登録されています')
          return
        }

        if (!data.session) {
          setMessage('確認メールを送信しました。メール内のリンクを確認してからログインしてください。')
          setMode('login')
          setPassword('')
          setPasswordConfirmation('')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        replacePath('/dashboard')
      }
    } catch (authError) {
      setError(buildAuthError(authError, mode))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <div className="brand-mark">請</div>
          <div>
            <p className="eyebrow">Invoice Workspace</p>
            <h1 id="auth-title">請求書管理</h1>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="認証方法">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')}>
            ログイン
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => switchMode('signup')}>
            新規登録
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-heading">
            <h2>{mode === 'login' ? 'ログイン' : 'アカウント作成'}</h2>
            <p>{mode === 'login' ? '登録済みの情報を入力してください。' : '請求書管理を始めるための情報を入力してください。'}</p>
          </div>

          {error ? <div className="auth-alert is-error" role="alert">{error}</div> : null}
          {message ? <div className="auth-alert is-success" role="status">{message}</div> : null}

          <label className="field">
            <span>メールアドレス</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required disabled={submitting} />
          </label>

          <label className="field">
            <span>パスワード</span>
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required disabled={submitting} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'} disabled={submitting}>
                {showPassword ? '隠す' : '表示'}
              </button>
            </div>
            <small>6文字以上で入力してください</small>
          </label>

          {mode === 'signup' ? (
            <label className="field">
              <span>パスワード確認</span>
              <input type={showPassword ? 'text' : 'password'} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" minLength={6} required disabled={submitting} />
            </label>
          ) : null}

          <button type="submit" className="primary-button auth-submit" disabled={submitting || Boolean(configError)}>
            {submitting ? (mode === 'login' ? 'ログイン中...' : '登録中...') : (mode === 'login' ? 'ログイン' : '新規登録')}
          </button>

          <button type="button" className="auth-switch" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} disabled={submitting}>
            {mode === 'login' ? 'アカウントをお持ちでない方は新規登録' : '登録済みの方はログインへ戻る'}
          </button>
        </form>
      </section>
    </main>
  )
}

function SessionLoading() {
  return (
    <main className="session-loading" aria-live="polite" aria-busy="true">
      <div className="session-spinner" aria-hidden="true" />
      <p>ログイン状態を確認しています...</p>
    </main>
  )
}

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path
}

function replacePath(path) {
  if (window.location.pathname !== path) {
    window.history.replaceState({}, '', path)
  }
}
