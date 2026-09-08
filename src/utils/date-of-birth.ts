// Local calendar dates: no UTC conversion and no stored age to become stale.
export function parseDateOfBirth(value: string, today = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  if (year < 1) return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function displayDateOfBirth(iso: string) {
  return iso.split('-').reverse().join('/');
}

export function ageFromDateOfBirth(iso: string, today = new Date()) {
  const [year, month, day] = iso.split('-').map(Number);
  return today.getFullYear() - year - Number(today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day));
}
