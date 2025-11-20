/**
 * Type definitions for Visual Scheduler Plugin
 */

export interface SchedulerSettings {
    categories: CategoryConfig[];
    weeklySchedule: WeeklySchedule;
    monthlyTasks: MonthlyTasks;
    standardItems: StandardItemConfig[];
    sleepSchedule: SleepSchedule;
    showNotifications: boolean;
}

export interface SleepSchedule {
    enabled: boolean;
    sleepTime: number; // Hour (0-23)
    wakeTime: number; // Hour (0-23)
    excludeWakeDays: number[]; // Days to skip "Wake Up" (0-6)
    excludeSleepDays: number[]; // Days to skip "Sleep" (0-6)
}

export interface CategoryConfig {
    id: string;
    name: string;
    color: string;
}

export interface SchedulerItem {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    isStandard?: boolean;
    standardTaskName?: string; // Link back to standard task for updates
}

export interface StandardItemConfig {
    name: string;
    description: string;
    categoryId: string;
    schedule: DayHourSchedule; // New structure: day -> hours mapping
}

// New structure for per-day hour selection
export interface DayHourSchedule {
    [day: number]: number[]; // Day (0-6) -> array of hours
}

// Weekly Schedule Structure
export interface WeeklySchedule {
    [day: string]: DaySchedule; // 0-6 (Monday-Sunday)
}

export interface DaySchedule {
    [hour: string]: SchedulerItem[]; // "00"-"23"
}

// Monthly Tasks Structure
export interface MonthlyTasks {
    [month: string]: SchedulerItem[]; // "0"-"11" (Jan-Dec)
}

export interface CellPosition {
    day: number; // 0-6 (Monday-Sunday)
    hour: number; // 0-23
}

export interface MonthPosition {
    month: number; // 0-11 (Jan-Dec)
}