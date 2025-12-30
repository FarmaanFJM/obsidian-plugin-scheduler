import { App } from 'obsidian';
import { SchedulerSettings, YearData, SchedulerItem, WeeklySchedule } from '../types';
import { SCHEDULER_DATA_FOLDER, SETTINGS_FILE, BACKLOG_FILE, GOALS_FILE, DEFAULT_SETTINGS } from '../constants';

export class DataManager {
    private app: App;
    
    constructor(app: App) {
        this.app = app;
    }

    private async ensureFolder() {
        const adapter = this.app.vault.adapter;
        if (!(await adapter.exists(SCHEDULER_DATA_FOLDER))) {
            await adapter.mkdir(SCHEDULER_DATA_FOLDER);
        }
    }

    private async atomicWrite(filePath: string, data: any) {
        await this.ensureFolder();
        const dataString = JSON.stringify(data, null, 2);
        await this.app.vault.adapter.write(filePath, dataString);
        // Force file system flush
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    private async atomicRead(filePath: string): Promise<any | null> {
        const adapter = this.app.vault.adapter;
        if (!(await adapter.exists(filePath))) {
            return null;
        }
        try {
            const raw = await adapter.read(filePath);
            return JSON.parse(raw);
        } catch (e) {
            console.error(`Scheduler: Failed to read ${filePath}:`, e);
            return null;
        }
    }

    async loadSettings(): Promise<SchedulerSettings> {
        const loaded = await this.atomicRead(SETTINGS_FILE);
        return Object.assign({}, DEFAULT_SETTINGS, loaded);
    }

    async saveSettings(settings: SchedulerSettings): Promise<void> {
        await this.atomicWrite(SETTINGS_FILE, settings);
    }

    async loadBacklog(): Promise<SchedulerItem[]> {
        const data = await this.atomicRead(BACKLOG_FILE);
        return data?.items || [];
    }

    async saveBacklog(items: SchedulerItem[]): Promise<void> {
        await this.atomicWrite(BACKLOG_FILE, { items });
    }

    async loadGoals(): Promise<SchedulerItem[]> {
        const data = await this.atomicRead(GOALS_FILE);
        return data?.items || [];
    }

    async saveGoals(items: SchedulerItem[]): Promise<void> {
        await this.atomicWrite(GOALS_FILE, { items });
    }

    async loadYearData(year: number): Promise<YearData> {
        const yearFile = `${SCHEDULER_DATA_FOLDER}/${year}.json`;
        let yearData = await this.atomicRead(yearFile);

        if (!yearData) {
            yearData = this.createEmptyYearData(year);
        }

        return yearData;
    }

    async saveYearData(yearData: YearData): Promise<void> {
        const yearFile = `${SCHEDULER_DATA_FOLDER}/${yearData.year}.json`;
        await this.atomicWrite(yearFile, yearData);
    }

    createEmptyYearData(year: number): YearData {
        return {
            year,
            weeks: [],
            monthlyTasks: this.createEmptyMonthlyTasks()
        };
    }

    createEmptyMonthlyTasks() {
        const tasks: any = {};
        for (let month = 0; month < 12; month++) {
            tasks[month] = [];
        }
        return tasks;
    }

    createEmptyWeeklySchedule(): WeeklySchedule {
        const schedule: WeeklySchedule = {};
        for (let day = 0; day < 7; day++) {
            schedule[day] = {};
            for (let hour = 0; hour < 24; hour++) {
                schedule[day][hour] = [];
            }
        }
        return schedule;
    }
}