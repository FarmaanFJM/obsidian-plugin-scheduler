export interface SchedulerSettings {
    categories: CategoryConfig[];
    standardItems: StandardItem[];
}

export interface CategoryConfig {
    id: string;
    name: string;
    color: string;
}

export interface StandardItem {
    name: string;
    description: string;
    categoryId: string;
    days: number[]; // 0 = Monday, 6 = Sunday
    startTime: string; // "HH:00" format
    endTime: string;
}

export interface SchedulerItem {
    name: string;
    description: string;
    categoryId: string;
    color: string;
}

export interface CellPosition {
    day: number; // 0-6 (Monday-Sunday)
    time: string; // "HH:00"
}