export type DateRangeKey = "7D" | "14D" | "30D" | "MTD" | "YTD" | "ALL";

function parseDateLocal(dateLike: string | Date): Date {
  if (dateLike instanceof Date) return dateLike;

  const s = String(dateLike);

  // If it's exactly "YYYY-MM-DD", parse as LOCAL date to avoid UTC shifting
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // Otherwise fall back to normal parsing (works for MM/DD/YYYY, full ISO, etc.)
  return new Date(s);
}

export function getDateRange(key: DateRangeKey, now: Date = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (key === "ALL") return { start: null as Date | null, end: null as Date | null };

  if (key === "7D" || key === "14D" || key === "30D") {
    const days = key === "7D" ? 7 : key === "14D" ? 14 : 30;
    start.setDate(start.getDate() - (days - 1));
    return { start, end };
  }

  if (key === "MTD") {
    start.setDate(1);
    return { start, end };
  }

  // YTD
  start.setMonth(0, 1);
  return { start, end };
}

export function isWithinRange(dateLike: string | Date, range: { start: Date | null; end: Date | null }) {
  if (!range.start || !range.end) return true;
  const d = parseDateLocal(dateLike);
  return d >= range.start && d <= range.end;
}

