/**
 * Type definitions for Visual Scheduler Plugin
 */
export interface SchedulerSettings {
    categories: CategoryConfig[];
    standardItems: StandardItemConfig[];
    sleepSchedule: SleepSchedule;
}

export interface BacklogData {
    items: SchedulerItem[];
}

export interface GoalsData {
    items: SchedulerItem[];
}


// Year-based data structure (stored in separate files like 2025.json)
export interface YearData {
    year: number;
    weeks: WeekData[];
    monthlyTasks: MonthlyTasks;
}
export interface WeekData {
    weekNumber: number; // ISO week number
    startDate: string; // ISO date string (Monday of the week)
    endDate: string; // ISO date string (Sunday of the week)
    schedule: WeeklySchedule;
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
export type ItemType = 'regular' | 'task' | 'goal' | 'deadline';
export interface SchedulerItem {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    itemType: ItemType; // Type of item with different visual styling
    completed?: boolean; // For 'task' type items
    isStandard?: boolean;
    standardTaskName?: string; // Link back to standard task for updates
    deadlineDate?: string;  // ISO date "YYYY-MM-DD"
    deadlineHour?: number;  // 0–23
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