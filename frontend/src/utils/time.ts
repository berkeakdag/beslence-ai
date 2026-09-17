// Time helpers — everything is anchored to Europe/Istanbul (UTC+3).
// Fixes the P0 bug where UTC ISO strings caused entries to land 3 h earlier.

/**
 * Returns an ISO string representing the current wall-clock time in Istanbul,
 * with an explicit +03:00 offset.
 * Example output: "2026-07-01T19:15:42+03:00"
 */
export function istanbulNowISO(): string {
  const d = new Date();
  // sv-SE returns "YYYY-MM-DD HH:MM:SS" which is easy to split.
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value])) as any;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
}

/**
 * Returns today's date string ("YYYY-MM-DD") in Istanbul local time.
 */
export function istanbulTodayStr(): string {
  return istanbulNowISO().slice(0, 10);
}

/**
 * Returns current "HH:MM" in Istanbul.
 */
export function istanbulHHMM(): string {
  return istanbulNowISO().slice(11, 16);
}
