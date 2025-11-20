export interface SchedulerSettings {
    categories: CategoryConfig[];
    weeklySchedule: WeeklySchedule;
    monthlyTasks: MonthlyTasks;
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