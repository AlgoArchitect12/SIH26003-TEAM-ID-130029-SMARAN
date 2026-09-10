import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { myDayRepository as repository } from '../db/repositories/my-day.repository';
import { patientRepository } from '../db/repositories/patient.repository';
import { strings, t } from '../i18n/index';
import { localDateTime, localDay, type ReminderInput } from '../my-day/types';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export type NotificationResult = { permission: ReminderPermission; failed: boolean };
const channelId = 'my-day';
const notificationPrefix = 'smaran-my-day-';
let scheduledTimezone: string | null = null;

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function reminderPermission(request = false): Promise<ReminderPermission> {
  if (Platform.OS === 'web') return 'unavailable';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Smaran reminders', importance: Notifications.AndroidImportance.DEFAULT,
  });
  const permission = request ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
  if (permission.granted || (permission.ios && [Notifications.IosAuthorizationStatus.PROVISIONAL,
    Notifications.IosAuthorizationStatus.EPHEMERAL].includes(permission.ios.status))) return 'granted';
  return permission.status === 'denied' ? 'denied' : 'undetermined';
}

async function reconcile(patientId: string, request = false): Promise<NotificationResult> {
  let permission: ReminderPermission = 'unavailable';
  try {
    permission = await reminderPermission(request);
    if (Platform.OS === 'web') return { permission, failed: false };
    // Language lookup is optional; a failed read must not prevent safe scheduling after a save.
    const settings = await patientRepository.getSettings(patientId).catch(() => null);
    const privateContent = { title: t(settings?.language, 'dayNotificationTitle'), body: t(settings?.language, 'dayNotificationBody') };
    const [reminders, pending, events] = await Promise.all([
      repository.list(patientId, true), Notifications.getAllScheduledNotificationsAsync(), repository.currentCompletions(patientId),
    ]);
    const scheduled = new Map(pending.map(item => [item.identifier, item]));
    let failed = false;
    const timezone = `${Intl.DateTimeFormat().resolvedOptions().timeZone}:${new Date().getTimezoneOffset()}`;
    // Rebuild daily alarms after cold start or a device timezone/offset change.
    const timezoneChanged = scheduledTimezone !== timezone;
    for (const reminder of reminders) {
      // A deterministic identifier also covers a crash between native scheduling and SQLite acknowledgement.
      const identifier = `${notificationPrefix}${reminder.id}`;
      const past = reminder.repeatRule === 'once' && localDateTime(reminder.scheduledDate!, reminder.timeOfDay).getTime() <= Date.now();
      const completed = reminder.repeatRule === 'once' && events.some(event => event.reminderId === reminder.id);
      const wanted = permission === 'granted' && reminder.isEnabled && !reminder.deletedAt && !past && !completed;
      try {
        const content = scheduled.get(identifier)?.content;
        if (wanted && !timezoneChanged && reminder.repeatRule === 'daily' && reminder.notificationRevision === reminder.revision && reminder.notificationId === identifier
            && content?.title === privateContent.title && content.body === privateContent.body) continue;
        if (scheduled.has(identifier) || reminder.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(reminder.notificationId ?? identifier);
          if (reminder.notificationId && reminder.notificationId !== identifier && scheduled.has(identifier))
            await Notifications.cancelScheduledNotificationAsync(identifier);
        }
        let notificationId: string | null = null;
        if (wanted) {
          const [hour, minute] = reminder.timeOfDay.split(':').map(Number);
          notificationId = await Notifications.scheduleNotificationAsync({
            identifier,
            content: { ...privateContent, sound: 'default', data: { reminderId: reminder.id } },
            trigger: reminder.repeatRule === 'daily'
              ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId }
              : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: localDateTime(reminder.scheduledDate!, reminder.timeOfDay), channelId },
          });
        }
        if (!await repository.acknowledgeNotification(reminder, notificationId)) failed = true;
      } catch { failed = true; }
    }
    // Upgrade cleanup is independent of scheduling: an OS dismissal failure must not stop saved reminders.
    try {
      for (const { request } of await Notifications.getPresentedNotificationsAsync()) {
        if (request.identifier.startsWith(notificationPrefix)
            && !Object.values(strings).some(catalog => request.content.title === catalog.dayNotificationTitle
              && request.content.body === catalog.dayNotificationBody)) {
          await Notifications.dismissNotificationAsync(request.identifier);
        }
      }
    } catch { failed = true; }
    if (!failed) scheduledTimezone = timezone;
    return { permission, failed };
  } catch { return { permission, failed: true }; }
}

// ponytail: one queue for local reminder writes and OS scheduling; per-patient queues only if concurrent patient use is introduced.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
export const myDayService = {
  sync: (patientId: string, request = false) => serialized(() => reconcile(patientId, request)),
  save: (patientId: string, input: ReminderInput, id?: string) => serialized(async () => {
    const reminder = await repository.save(patientId, input, id);
    return { reminder, notifications: await reconcile(patientId) };
  }),
  setEnabled: (patientId: string, id: string, enabled: boolean) => serialized(async () => {
    await repository.setEnabled(patientId, id, enabled);
    return reconcile(patientId);
  }),
  remove: (patientId: string, id: string) => serialized(async () => {
    await repository.remove(patientId, id);
    return reconcile(patientId);
  }),
  complete: (patientId: string, id: string, day = localDay()) => serialized(async () => {
    await repository.complete(patientId, id, day);
  }),
};
