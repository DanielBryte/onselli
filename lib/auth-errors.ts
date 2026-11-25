type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function readError(cause: unknown): AuthErrorLike {
  if (typeof cause !== 'object' || cause === null) return {};
  return cause as AuthErrorLike;
}

/** Maps auth provider errors to stable, user-safe copy. */
export function getAuthErrorMessage(cause: unknown, fallback = 'We couldn’t complete that request. Please try again.') {
  const error = readError(cause);
  const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const message = typeof error.message === 'string' ? error.message : '';
  const status = typeof error.status === 'number' ? error.status : undefined;

  if (status !== undefined && status >= 500 || /connection|network|fetch failed|internal server error|server error/i.test(message)) {
    return 'We couldn’t reach the account service. Check your connection and try again in a moment.';
  }

  switch (code) {
    case 'EMAIL_NOT_VERIFIED':
      return 'Verify your email address before signing in. You can request a fresh link below.';
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'That email and password combination doesn’t match. Check your details and try again.';
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.';
    case 'PASSWORD_TOO_SHORT':
      return 'Choose a password with at least 8 characters.';
    case 'PASSWORD_TOO_LONG':
      return 'Choose a shorter password and try again.';
    case 'INVALID_TOKEN':
    case 'EXPIRED_TOKEN':
    case 'TOKEN_EXPIRED':
      return 'This link has expired or was already used. Request a new one to continue.';
    case 'TOO_MANY_REQUESTS':
      return 'Too many attempts. Wait a little and try again.';
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'We couldn’t create the account with those details. Try signing in or use another email address.';
    case 'USER_ALREADY_EXISTS':
      return 'An account with this email already exists. Please log in.';
    default:
      return fallback;
  }
}

export function isAuthTokenError(cause: unknown) {
  const code = readError(cause).code;
  return typeof code === 'string' && ['INVALID_TOKEN', 'EXPIRED_TOKEN', 'TOKEN_EXPIRED'].includes(code.toUpperCase());
}
