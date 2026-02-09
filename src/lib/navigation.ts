import { Dumbbell, PlusCircle, BarChart2, TrendingUp } from 'lucide-react';
import { type ComponentType } from 'react';

export interface Tab {
  readonly href: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

export const tabs: readonly Tab[] = [
  { href: '/', label: 'Workouts', icon: Dumbbell },
  { href: '/create', label: 'Create', icon: PlusCircle },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/history', label: 'History', icon: BarChart2 },
] as const;
