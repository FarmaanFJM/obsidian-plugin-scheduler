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
        // January 4th is always in week 1 according to ISO 8601
        const jan4 = new Date(year, 0, 4);
        
        // Get the Monday of week 1
        const dayOfWeek = jan4.getDay();
        const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjust Sunday to -6, others normally
        const week1Monday = new Date(jan4);
        week1Monday.setDate(jan4.getDate() + diff);
        
        // Add the number of weeks to get to the target week
        const targetDate = new Date(week1Monday);
        targetDate.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
        
        return targetDate;
    }

    /**
     * Get current week info
     */
    static getCurrentWeekInfo(): { weekNumber: number; year: number; startDate: Date; endDate: Date } {
        const now = new Date();
        const weekNumber = this.getWeekNumber(now);
        const startDate = this.getMonday(now);
        const endDate = this.getSunday(now);
        
        // ISO week-year can differ from calendar year
        // Week 1 might belong to the previous year if it starts in December
        // Week 52/53 might belong to the next year if it ends in January
        const weekYear = this.getYearForWeek(weekNumber, now);
        
        return { weekNumber, year: weekYear, startDate, endDate };
    }

    /**
     * Get the ISO week-year for a given week number and date
     * This handles edge cases where the ISO week year differs from calendar year
     */
    static getYearForWeek(weekNumber: number, date: Date): number {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // If it's week 1 and we're in December, it belongs to next year
        if (weekNumber === 1 && month === 11) {
            return year + 1;
        }
        
        // If it's week 52 or 53 and we're in January, it belongs to previous year
        if ((weekNumber === 52 || weekNumber === 53) && month === 0) {
            return year - 1;
        }
        
        return year;
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