import type { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { TranslationKey } from '../i18n';
import type { ReminderType } from './types';

export const category: Record<ReminderType, { key: TranslationKey; icon: ComponentProps<typeof MaterialIcons>['name'] }> = {
  medicine: { key: 'dayMedicine', icon: 'medication' }, hydration: { key: 'dayWater', icon: 'water-drop' },
  activity: { key: 'dayActivity', icon: 'directions-walk' }, appointment: { key: 'dayAppointment', icon: 'event' },
  custom: { key: 'dayOther', icon: 'notifications-none' },
};

// Presets only fill the existing editor. A meal is an ordinary custom reminder; no hidden metadata.
export const reminderPresets = [
  { id: 'medicine', type: 'medicine', ...category.medicine, time: '08:00', repeat: 'daily' },
  { id: 'water', type: 'hydration', ...category.hydration, time: '10:00', repeat: 'daily' },
  { id: 'meal', type: 'custom', key: 'dayMeal', icon: 'restaurant', time: '12:00', repeat: 'daily' },
  { id: 'activity', type: 'activity', ...category.activity, time: '16:00', repeat: 'daily' },
  { id: 'appointment', type: 'appointment', ...category.appointment, time: '09:00', repeat: 'once' },
] as const;
