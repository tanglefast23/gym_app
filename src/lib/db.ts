import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutLog,
  ExerciseHistoryEntry,
  UnlockedAchievement,
  UserSettings,
  CrashRecoveryData,
} from '@/types/workout';

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  logs!: Table<WorkoutLog, string>;
  exerciseHistory!: Table<ExerciseHistoryEntry, number>;
  achievements!: Table<UnlockedAchievement, string>;
  settings!: Table<UserSettings, string>;
  crashRecovery!: Table<CrashRecoveryData, string>;

  constructor() {
    super('workout-pwa-db');

    this.version(1).stores({
      exercises: 'id, name',
      templates: 'id, name, isArchived, createdAt',
      logs: 'id, templateId, startedAt, status, [templateId+startedAt]',
      exerciseHistory:
        '++id, exerciseId, exerciseName, logId, performedAt, [exerciseName+performedAt]',
      achievements: 'achievementId, unlockedAt',
      settings: 'id',
      crashRecovery: 'id',
    });

    // v2: add an index for efficient "latest history entry by exerciseId"
    // and to avoid sorting/scanning the full table for that lookup.
    this.version(2).stores({
      exercises: 'id, name',
      templates: 'id, name, isArchived, createdAt',
      logs: 'id, templateId, startedAt, status, [templateId+startedAt]',
      exerciseHistory:
        '++id, exerciseId, exerciseName, logId, performedAt, [exerciseId+performedAt], [exerciseName+performedAt]',
      achievements: 'achievementId, unlockedAt',
      settings: 'id',
      crashRecovery: 'id',
    });
  }
}

export const db = new WorkoutDB();
