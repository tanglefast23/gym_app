import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutLog,
  ExerciseHistoryEntry,
  UnlockedAchievement,
  BodyWeightEntry,
  UserSettings,
  CrashRecoveryData,
} from '@/types/workout';

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  logs!: Table<WorkoutLog, string>;
  exerciseHistory!: Table<ExerciseHistoryEntry, number>;
  achievements!: Table<UnlockedAchievement, string>;
  bodyWeights!: Table<BodyWeightEntry, string>;
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

    // v3: add body weight tracking
    this.version(3).stores({
      exercises: 'id, name',
      templates: 'id, name, isArchived, createdAt',
      logs: 'id, templateId, startedAt, status, [templateId+startedAt]',
      exerciseHistory:
        '++id, exerciseId, exerciseName, logId, performedAt, [exerciseId+performedAt], [exerciseName+performedAt]',
      achievements: 'achievementId, unlockedAt',
      bodyWeights: 'id, recordedAt',
      settings: 'id',
      crashRecovery: 'id',
    });

    // v4: denormalize lastPerformedAt onto templates to avoid loading all logs on the home page.
    // No new index needed — the field is read alongside the template row.
    this.version(4)
      .stores({
        exercises: 'id, name',
        templates: 'id, name, isArchived, createdAt',
        logs: 'id, templateId, startedAt, status, [templateId+startedAt]',
        exerciseHistory:
          '++id, exerciseId, exerciseName, logId, performedAt, [exerciseId+performedAt], [exerciseName+performedAt]',
        achievements: 'achievementId, unlockedAt',
        bodyWeights: 'id, recordedAt',
        settings: 'id',
        crashRecovery: 'id',
      })
      .upgrade(async (tx) => {
        const logs = await tx.table('logs').toArray();
        // Build a map of templateId -> latest startedAt
        const latestByTemplate = new Map<string, string>();
        for (const log of logs) {
          // Dexie upgrade records are untyped (previous schema shape); cast documents the expected field type.
          const tid = log.templateId as string | null;
          if (!tid) continue;
          // Dexie upgrade records are untyped; startedAt is an ISO string in the previous schema.
          const startedAt = log.startedAt as string;
          const existing = latestByTemplate.get(tid);
          if (!existing || startedAt > existing) {
            latestByTemplate.set(tid, startedAt);
          }
        }
        // Update each template that has logs
        const templates = tx.table('templates');
        await templates.toCollection().modify((template) => {
          // Dexie upgrade records are untyped; template.id is a string UUID in all schema versions.
          const lastPerformed = latestByTemplate.get(template.id as string);
          if (lastPerformed) {
            template.lastPerformedAt = lastPerformed;
          }
        });
      });

  }
}

export const db = new WorkoutDB();
