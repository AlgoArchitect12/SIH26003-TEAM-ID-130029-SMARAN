import type { SQLiteDatabase } from 'expo-sqlite';

export const MY_DAY_SQL = `
  CREATE TABLE reminders (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    patient_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('medicine','hydration','activity','appointment','custom')),
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
    note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 300),
    time_of_day TEXT NOT NULL CHECK (
      time_of_day GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(time_of_day,1,2) <= '23'
    ),
    scheduled_date TEXT,
    repeat_rule TEXT NOT NULL CHECK (repeat_rule IN ('daily','once')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
    notification_id TEXT,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    notification_revision INTEGER NOT NULL DEFAULT 0 CHECK (notification_revision >= 0),
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (id, patient_id),
    CHECK ((repeat_rule = 'daily' AND scheduled_date IS NULL) OR
      (repeat_rule = 'once' AND scheduled_date IS NOT NULL AND
       scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND
       date(scheduled_date, '+0 days') IS NOT NULL AND date(scheduled_date, '+0 days') = scheduled_date)),
    CHECK (deleted_at IS NULL OR is_enabled = 0),
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE RESTRICT
  );
  CREATE INDEX idx_reminders_patient_time ON reminders(patient_id, time_of_day);

  CREATE TABLE reminder_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    scheduled_for TEXT NOT NULL CHECK (
      length(scheduled_for) = 16 AND substr(scheduled_for,11,1) = 'T' AND
      date(substr(scheduled_for,1,10), '+0 days') IS NOT NULL AND
      date(substr(scheduled_for,1,10), '+0 days') = substr(scheduled_for,1,10) AND
      substr(scheduled_for,12) GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(scheduled_for,12,2) <= '23'
    ),
    status TEXT NOT NULL CHECK (status = 'completed'),
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (reminder_id, patient_id) REFERENCES reminders(id, patient_id) ON DELETE RESTRICT
  );
  CREATE UNIQUE INDEX idx_reminder_completion_day
    ON reminder_events(reminder_id, substr(scheduled_for,1,10));
  CREATE INDEX idx_reminder_events_patient ON reminder_events(patient_id, scheduled_for);
  CREATE TRIGGER reminder_events_no_update BEFORE UPDATE ON reminder_events
    BEGIN SELECT RAISE(ABORT, 'Reminder events are append-only'); END;
  CREATE TRIGGER reminder_events_no_delete BEFORE DELETE ON reminder_events
    BEGIN SELECT RAISE(ABORT, 'Reminder events are append-only'); END;
`;

export const myDayMigration = {
  version: 4,
  name: 'my_day',
  async up(database: SQLiteDatabase) { await database.execAsync(MY_DAY_SQL); },
} as const;
