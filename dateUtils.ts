/**
 * Utility functions for date and week calculations
 */

export class DateUtils {
    /**
     * Get ISO week number for a given date
     */
    static getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    /**
     * Get Monday of the week for a given date
     */
    static getMonday(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    /**
     * Get Sunday of the week for a given date
     */
    static getSunday(date: Date): Date {
        const monday = this.getMonday(date);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return sunday;
    }

    /**
     * Format date as ISO string (YYYY-MM-DD)
     */
    static toISODateString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Parse ISO date string to Date
     */
    static fromISODateString(dateStr: string): Date {
        return new Date(dateStr);
    }

    /**
     * Get date range string for display (e.g., "November 17-22, 2025")
     */
    static getWeekRangeString(startDate: Date, endDate: Date): string {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const startMonth = monthNames[startDate.getMonth()];
        const endMonth = monthNames[endDate.getMonth()];
        const startDay = startDate.getDate();
        const endDay = endDate.getDate();
        const year = startDate.getFullYear();

        if (startMonth === endMonth) {
            return `${startMonth} ${startDay}-${endDay}, ${year}`;
        } else {
            return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
        }
    }

    /**
     * Get the date of a specific week number in a year
     */
    static getDateOfWeek(weekNumber: number, year: number): Date {
        const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        return ISOweekStart;
    }

    /**
     * Get current week info
     */
    static getCurrentWeekInfo(): { weekNumber: number; year: number; startDate: Date; endDate: Date } {
        const now = new Date();
        const weekNumber = this.getWeekNumber(now);
        const startDate = this.getMonday(now);
        const endDate = this.getSunday(now);
        return { weekNumber, year: now.getFullYear(), startDate, endDate };
    }

    /**
     * Add weeks to a date
     */
    static addWeeks(date: Date, weeks: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + weeks * 7);
        return result;
    }
}