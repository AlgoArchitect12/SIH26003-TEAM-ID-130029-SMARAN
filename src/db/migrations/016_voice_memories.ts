import type { SQLiteDatabase } from 'expo-sqlite';

export const voiceMemoriesMigration = {
  version: 16,
  name: 'voice_memories',
  async up(database: SQLiteDatabase) {
    // Local only: the existing explicit sync column allowlist excludes audio_path.
    await database.execAsync(`ALTER TABLE personal_memories ADD COLUMN audio_path TEXT
      CHECK (audio_path IS NULL OR (
        length(audio_path) <= 200 AND
        substr(audio_path,1,length('memories/' || patient_id || '/')) = 'memories/' || patient_id || '/' AND
        substr(audio_path,-4) = '.m4a' AND instr(audio_path,'..') = 0 AND instr(audio_path,char(92)) = 0
      ));`);
  },
} as const;
