// Local calendar dates: no UTC conversion and no stored age to become stale.
export function daysInBirthMonth(month: number, year: number) {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function chooseBirthPart(value: string, index: number, part: number, today = new Date()) {
  const parts = [value.split('/')[0] ?? '', value.split('/')[1] ?? '', value.split('/')[2] ?? ''];
  parts[index] = String(part).padStart(index === 2 ? 4 : 2, '0');
  const [day, month, year] = parts.map(Number);
  // Clear incompatible choices instead of silently changing the birthday.
  if (day && month && day > daysInBirthMonth(month, year || 2000)) parts[0] = '';
  if (year === today.getFullYear()) {
    if (month > today.getMonth() + 1) { parts[1] = ''; parts[0] = ''; }
    else if (month === today.getMonth() + 1 && day > today.getDate()) parts[0] = '';
  }
  return parts.join('/');
}

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
