import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { myDayRepository as repository } from '../db/repositories/my-day.repository';
import { patientRepository } from '../db/repositories/patient.repository';
import { strings, t } from '../i18n/index';
import { localDateTime, localDay, type ReminderInput } from '../my-day/types';
import { capturePatientRequest, captureReminderManagement } from '../stores/patient-session.store';
import { resolveActivePatient } from './active-patient.service';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export type NotificationResult = { permission: ReminderPermission; failed: boolean };
// Android fixes a channel's sound at creation, so the bundled alarm tone
// ships on a new channel; reconcile() below migrates schedules off 'my-day'.
// iOS and pre-8 Android read the filename from the notification content.
const channelId = 'smaran-reminders';
const alarmSound = 'smaran-alarm.wav';
const notificationPrefix = 'smaran-my-day-';
let scheduledTimezone: string | null = null;

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function reminderPermission(request = false, language?: Parameters<typeof t>[0]): Promise<ReminderPermission> {
  if (Platform.OS === 'web') return 'unavailable';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, {
    name: t(language, 'dayNotificationTitle'), importance: Notifications.AndroidImportance.HIGH,
    sound: alarmSound, vibrationPattern: [0, 500, 250, 500],
  });
  const permission = request ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
  if (permission.granted || (permission.ios && [Notifications.IosAuthorizationStatus.PROVISIONAL,
    Notifications.IosAuthorizationStatus.EPHEMERAL].includes(permission.ios.status))) return 'granted';
  return permission.status === 'denied' ? 'denied' : 'undetermined';
}

async function reconcile(patientId: string, request = false): Promise<NotificationResult> {
  let permission: ReminderPermission = 'unavailable';
  try {
    const settings = await patientRepository.getSettings(patientId).catch(() => null);
    permission = await reminderPermission(request, settings?.language);
    if (Platform.OS === 'web') return { permission, failed: false };
    // Language lookup is optional; a failed read must not prevent safe scheduling after a save.
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
        const scheduledItem = scheduled.get(identifier);
        const content = scheduledItem?.content;
        const scheduledChannel = (scheduledItem?.trigger as { channelId?: string } | undefined)?.channelId;
        // iOS triggers carry no channel; the channel migration check is Android-only
        // so daily iOS alarms are not needlessly rescheduled on every sync.
        if (wanted && !timezoneChanged && reminder.repeatRule === 'daily' && reminder.notificationRevision === reminder.revision && reminder.notificationId === identifier
            && content?.title === privateContent.title && content.body === privateContent.body
            && content.data?.alarmSound === alarmSound
            && (Platform.OS !== 'android' || scheduledChannel === channelId)) continue;
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
            content: { ...privateContent, sound: alarmSound, data: { reminderId: reminder.id, alarmSound } },
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
function mutate<T>(patientId: string, work: (isCurrent: () => boolean) => Promise<T>, administrative = true): Promise<T> {
  // Capture before entering the queue: returning to the same patient still invalidates old work.
  const isCurrent = administrative ? captureReminderManagement() : capturePatientRequest();
  return serialized(async () => {
    if (!isCurrent()) throw new Error('Reminder patient changed before saving.');
    const active = await resolveActivePatient();
    if (!isCurrent() || active.status !== 'ready' || active.profile.id !== patientId) {
      throw new Error('Reminder patient changed before saving.');
    }
    return work(isCurrent);
  });
}
export const myDayService = {
  sync: (patientId: string, request = false) => serialized(() => reconcile(patientId, request)),
  save: (patientId: string, input: ReminderInput, id?: string) => mutate(patientId, async isCurrent => {
    const reminder = await repository.save(patientId, input, id, isCurrent);
    return { reminder, notifications: await reconcile(patientId) };
  }),
  setEnabled: (patientId: string, id: string, enabled: boolean) => mutate(patientId, async isCurrent => {
    await repository.setEnabled(patientId, id, enabled, isCurrent);
    return reconcile(patientId);
  }),

  remove: (patientId: string, id: string) => mutate(patientId, async isCurrent => {
    await repository.remove(patientId, id, isCurrent);
    return reconcile(patientId);
  }),
  complete: (patientId: string, id: string, day = localDay()) => mutate(patientId, async isCurrent => {
    await repository.complete(patientId, id, day, isCurrent);
    return reconcile(patientId);
  }, false),
};
