import { SchedulerSettings } from './types';

export const SCHEDULER_DATA_FOLDER = 'SchedulerData';
export const SETTINGS_FILE = `${SCHEDULER_DATA_FOLDER}/settings.json`;
export const BACKLOG_FILE = `${SCHEDULER_DATA_FOLDER}/backlog.json`;
export const GOALS_FILE = `${SCHEDULER_DATA_FOLDER}/goals.json`;

export const DEFAULT_SETTINGS: SchedulerSettings = {
    categories: [
        { id: 'personal', name: 'Personal', color: '#2ECC71' },
        { id: 'health', name: 'Health', color: '#E74C3C' },
        { id: 'school', name: 'School', color: '#8B4513' },
        { id: 'work', name: 'Work', color: '#3498DB' },
        { id: 'projects', name: 'Projects', color: '#9B59B6' },
        { id: 'other', name: 'Other', color: '#95A5A6' }
    ],
    standardItems: [
        {
            name: 'Gym',
            description: 'Morning workout',
            categoryId: 'health',
            schedule: {
                0: [5],
                2: [5],
                4: [5]
            }
        }
    ],
    sleepSchedule: {
        enabled: true,
        sleepTime: 22,
        wakeTime: 4,
        excludeWakeDays: [],
        excludeSleepDays: []
    },
    backlogExpanded: true,
};