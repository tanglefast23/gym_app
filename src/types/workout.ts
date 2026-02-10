// === EXERCISE LIBRARY ===
export interface Exercise {
  id: string;                              // crypto.randomUUID()
  name: string;                            // "Bench Press"
  visualKey: string;                       // maps to built-in illustration asset
  createdAt: string;
  updatedAt: string;
}

// === TEMPLATE BLOCKS ===
export type RepTarget = { min: number; max: number };

export interface ExerciseBlockExercise {
  exerciseId: string;
  repsMin: number;
  repsMax: number;
}

export interface ExerciseBlock {
  id: string;
  type: 'exercise';
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restBetweenSetsSec: number | null;
  /**
   * Rest time after this block, before the next block starts.
   * Null means: use the global default transition rest from settings.
   */
  transitionRestSec: number | null;
}

export interface SupersetBlock {
  id: string;
  type: 'superset';
  sets: number;
  exercises: ExerciseBlockExercise[];
  restBetweenExercisesSec: number;
  restBetweenSupersetsSec: number;
  /**
   * Rest time after this block, before the next block starts.
   * Null means: use the global default transition rest from settings.
   */
  transitionRestSec: number | null;
}

export type TemplateBlock = ExerciseBlock | SupersetBlock;

export interface WorkoutTemplate {
  id: string;
  name: string;
  blocks: TemplateBlock[];
  defaultRestBetweenSetsSec: number | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  /** ISO timestamp of when this template was last used to complete a workout. */
  lastPerformedAt?: string;
}

// === WORKOUT SESSION (in-progress) ===
export type SessionState = 'exercising' | 'resting' | 'recap' | 'complete';

export interface WorkoutSessionState {
  id: string;
  templateSnapshot: TemplateBlock[];
  startedAt: string;
  state: SessionState;
  timerEndsAt: string | null;
}

// === WORKOUT LOG ===
export type LogStatus = 'completed' | 'partial';

export interface PerformedSet {
  exerciseId: string;
  exerciseNameSnapshot: string;
  blockPath: string;
  setIndex: number;
  repsTargetMin: number;
  repsTargetMax: number;
  repsDone: number;
  weightG: number;
}

export interface WorkoutLog {
  id: string;
  status: LogStatus;
  templateId: string | null;
  templateName: string;
  templateSnapshot: TemplateBlock[];
  performedSets: PerformedSet[];
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  totalVolumeG: number;
}

// === DENORMALIZED CHART DATA ===
export interface ExerciseHistoryEntry {
  id?: number;
  logId: string;
  exerciseId: string;
  exerciseName: string;
  performedAt: string;
  bestWeightG: number;
  totalVolumeG: number;
  totalSets: number;
  totalReps: number;
  estimated1RM_G: number | null;
}

// === ACHIEVEMENTS ===
export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: string;
  context: string | null;
}

/** Summary of a newly unlocked achievement, used for overlay/celebration display. */
export interface NewAchievementInfo {
  id: string;
  name: string;
  icon: string;
  iconSrc: string;
  context: string | null;
}

// === BODY WEIGHT ===
export interface BodyWeightEntry {
  id: string;               // local date key (YYYY-MM-DD) to enforce one entry per day
  recordedAt: string;       // ISO timestamp
  weightG: number;          // integer grams
}

// === SETTINGS ===
export type UnitSystem = 'kg' | 'lb';
export type ThemeMode = 'dark' | 'light' | 'system';
export type Sex = 'male' | 'female';

export type FontSize = 'S' | 'M' | 'L' | 'XL';

export interface UserSettings {
  id: 'settings';
  unitSystem: UnitSystem;
  defaultRestBetweenSetsSec: number;
  /** Default rest between blocks (exercise/superset) during a workout. */
  defaultTransitionsSec: number;
  weightStepsKg: number[];
  weightStepsLb: number[];
  hapticFeedback: boolean;
  soundEnabled: boolean;
  restTimerSound: boolean;
  autoStartRestTimer: boolean;
  theme: ThemeMode;
  /** Height in centimeters, null if not set. */
  heightCm: number | null;
  /** Age in years, null if not set. */
  age: number | null;
  /**
   * ISO timestamp for when `age` was last set/normalized.
   * Used to auto-increment age by +1 every 365 days.
   */
  ageUpdatedAt: string | null;
  /** Biological sex, null if not set. */
  sex: Sex | null;
  /** UI font size preference. */
  fontSize: FontSize;
}

// === CRASH RECOVERY ===
export interface CrashRecoveryData {
  id: 'recovery';
  sessionState: WorkoutSessionState;
  templateId: string | null;
  templateName: string;
  savedAt: string;
}

// === EXPORT/IMPORT ===
export interface ExportData {
  schemaVersion: number;
  exportedAt: string;
  settings: UserSettings;
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  logs: WorkoutLog[];
  exerciseHistory: ExerciseHistoryEntry[];
  achievements: UnlockedAchievement[];
  /** Optional for backward compatibility with older backups. */
  bodyWeights?: BodyWeightEntry[];
}

// === STEP ENGINE ===
export type StepType = 'exercise' | 'rest' | 'superset-rest' | 'complete';

export interface ExerciseStep {
  type: 'exercise';
  blockIndex: number;
  exerciseId: string;
  exerciseName?: string;
  setIndex: number;
  totalSets: number;
  repsMin: number;
  repsMax: number;
  visualKey?: string;
  isSuperset: boolean;
  supersetExerciseIndex?: number;
  supersetTotalExercises?: number;
}

export interface RestStep {
  type: 'rest' | 'superset-rest';
  blockIndex: number;
  restDurationSec: number;
  isSuperset?: boolean;
}

export interface CompleteStep {
  type: 'complete';
  blockIndex: number;
}

export type WorkoutStep = ExerciseStep | RestStep | CompleteStep;

// === VALIDATION CONSTRAINTS ===
export const VALIDATION = {
  WORKOUT_NAME_MAX: 100,
  EXERCISE_NAME_MAX: 80,
  NOTES_MAX: 500,
  MAX_SETS: 20,
  MAX_REPS: 999,
  MAX_WEIGHT_G: 999_000, // 999kg
  MIN_REST_SEC: 5,
  MAX_REST_SEC: 600,
  RECOVERY_MAX_AGE_MS: 4 * 60 * 60 * 1000, // 4 hours
} as const;

// === DEFAULT SETTINGS ===
export const DEFAULT_SETTINGS: UserSettings = {
  id: 'settings',
  unitSystem: 'kg',
  defaultRestBetweenSetsSec: 60,
  defaultTransitionsSec: 60,
  weightStepsKg: [1, 2.5, 5],
  weightStepsLb: [2.5, 5, 10],
  hapticFeedback: true,
  soundEnabled: true,
  restTimerSound: true,
  autoStartRestTimer: true,
  theme: 'dark',
  heightCm: null,
  age: null,
  ageUpdatedAt: null,
  sex: null,
  fontSize: 'M',
};
