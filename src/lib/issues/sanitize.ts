/*
 * User-authored text (PRD §16). React escapes everything it renders, so this only has to keep text tidy:
 * normalised Unicode, no control characters, sensible length.
 */

export const TEXT_LIMITS = {
  projectName: 80,
  title: 140,
  description: 2000,
} as const;

// C0/C1 control characters except tab and newline, plus bidi overrides that can disguise text.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

export function cleanText(input: string, maxLength: number, { multiline = false } = {}): string {
  let text = input.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL, "");
  text = multiline ? text.replace(/\n{3,}/g, "\n\n") : text.replace(/\s*\n\s*/g, " ");
  return text.trim().slice(0, maxLength).trim();
}

export const cleanProjectName = (s: string) => cleanText(s, TEXT_LIMITS.projectName);
export const cleanTitle = (s: string) => cleanText(s, TEXT_LIMITS.title);
export const cleanDescription = (s: string) => cleanText(s, TEXT_LIMITS.description, { multiline: true });
