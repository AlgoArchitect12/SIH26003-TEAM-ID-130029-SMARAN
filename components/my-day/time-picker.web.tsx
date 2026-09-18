import { useThemeColors } from '@/hooks/use-theme-color';
import { t } from '@i18n/index';
import type { Language } from '@db/schema.types';

export function TimePicker({ value, onChange, language, disabled }: {
  value: string; onChange: (value: string) => void; language: Language; disabled?: boolean;
}) {
  const colors = useThemeColors();
  return <label style={{ color: colors.text, display: 'grid', gap: 12, fontSize: 22 }}>
    {t(language, 'dayTime')}
    <input aria-label={t(language, 'dayTime')} type="time" value={value} disabled={disabled}
      style={{ minHeight: 64, fontSize: 24, color: colors.text, background: colors.surface, border: `2px solid ${colors.border}`, borderRadius: 12, padding: 12 }}
      onChange={event => { if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.target.value)) onChange(event.target.value); }} />
  </label>;
}
