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
    isStandard?: boolean; // Flag for standard/recurring items
}

export interface StandardItemConfig {
    name: string;
    description: string;
    categoryId: string;
    days: number[]; // 0-6 (Monday-Sunday), empty array = all days
    hours: number[]; // Hours to appear (0-23)
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