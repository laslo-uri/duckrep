import {
  Dumbbell,
  Heart,
  HeartPulse,
  BicepsFlexed,
  HandMetal,
  Footprints,
  Hand,
  Bone,
  Brain,
  Activity,
  CircleUser,
  type LucideIcon,
} from 'lucide-react';
import type { WorkoutDayIcon } from '../types';

export const WORKOUT_ICON_MAP: Record<WorkoutDayIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  heart: Heart,
  'heart-pulse': HeartPulse,
  'biceps-flexed': BicepsFlexed,
  'hand-metal': HandMetal,
  footprints: Footprints,
  hand: Hand,
  bone: Bone,
  brain: Brain,
  activity: Activity,
  'circle-user': CircleUser,
};

export function getWorkoutIcon(iconKey: string | null): LucideIcon | null {
  if (!iconKey || !(iconKey in WORKOUT_ICON_MAP)) return null;
  return WORKOUT_ICON_MAP[iconKey as WorkoutDayIcon];
}
