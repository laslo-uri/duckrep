export function toUserFriendlyError(
  message: string | undefined,
  t: (key: string) => string,
): string {
  if (!message) return t('error');
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid login') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid credentials')
  ) {
    return t('authErrorInvalidCredentials');
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return t('authErrorUserAlreadyExists');
  }
  if (lower.includes('password') && (lower.includes('too short') || lower.includes('at least'))) {
    return t('authErrorWeakPassword');
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return t('authErrorRateLimited');
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  ) {
    return t('authErrorCannotReachSupabase');
  }
  return message;
}
