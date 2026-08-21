export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENT_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;

export function meetsPasswordMinimum(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export function safeSignUpError(message: string | undefined): string {
  if (message?.toLowerCase().includes("password")) return PASSWORD_REQUIREMENT_MESSAGE;
  return "Unable to create your account. Please try again.";
}

export function safeSignInError(_message: string | undefined): string {
  return "Email or password is incorrect, or the email has not been verified.";
}

export function safePasswordUpdateError(message: string | undefined): string {
  if (message?.toLowerCase().includes("password")) return PASSWORD_REQUIREMENT_MESSAGE;
  return "Unable to update your password. Request a new reset link and try again.";
}
