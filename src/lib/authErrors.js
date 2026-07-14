export function buildAuthError(error, action = 'login') {
  if (!error) {
    return action === 'signup'
      ? 'アカウントを作成できませんでした'
      : '認証処理に失敗しました。もう一度お試しください'
  }

  const message = String(error.message ?? '').toLowerCase()
  const status = Number(error.status ?? 0)

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('email or password')
  ) {
    return 'メールアドレスまたはパスワードが正しくありません'
  }

  if (message.includes('email not confirmed')) {
    return 'メールアドレスの確認が完了していません'
  }

  if (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('user already exists')
  ) {
    return 'このメールアドレスはすでに登録されています'
  }

  if (
    status === 0 ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return '通信に失敗しました。もう一度お試しください'
  }

  if (message.includes('password') && message.includes('6')) {
    return 'パスワードは6文字以上で入力してください'
  }

  if (message.includes('rate limit') || status === 429) {
    return 'しばらく時間をおいてから、もう一度お試しください'
  }

  return action === 'signup'
    ? 'アカウントを作成できませんでした'
    : action === 'logout'
      ? 'ログアウトできませんでした。もう一度お試しください'
      : '認証処理に失敗しました。もう一度お試しください'
}
