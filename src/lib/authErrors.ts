export function toUserFriendlyError(
  message: string | undefined,
  t: (key: string) => string,
): string {
  if (!message) return t('error');
  const lower = message.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('database') ||
    lower.includes('sqlite')
  ) {
    return t('authErrorCannotReachServer');
  }
  return message;
}

export function toQueryErrorMessage(
  message: string | undefined,
  t: (key: string) => string,
): string {
  if (!message) return t('error');
  const lower = message.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('database') ||
    lower.includes('sqlite')
  ) {
    return t('authErrorCannotReachServer');
  }
  if (
    lower.includes('not found') ||
    lower.includes('0 rows') ||
    lower.includes('rows returned')
  ) {
    return t('notFound');
  }
  return toUserFriendlyError(message, t);
}
