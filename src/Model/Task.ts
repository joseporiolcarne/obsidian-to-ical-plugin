import 'crypto';
import moment from 'moment';
import { TaskDate, TaskDateName, getTaskDatesFromMarkdown, hasTime } from './TaskDate';
import { TaskStatus, getTaskStatusEmoji, getTaskStatusFromMarkdown } from './TaskStatus';
import { getSummaryFromMarkdown } from './TaskSummary';
import { settings } from '../SettingsManager';

export class Task {
  public status: TaskStatus;
  dates: TaskDate[];
  public summary: string;
  fileUri: string;

  constructor(
    status: TaskStatus,
    dates: TaskDate[],
    summary: string,
    fileUri: string,
  ) {
    this.status = status;
    this.dates = dates;
    this.summary = summary;
    this.fileUri = fileUri;
  }

  public getId(): string {
    return crypto.randomUUID();
  }

  public hasA(taskDateName: TaskDateName): boolean {
    return this.dates.some((taskDate: TaskDate) => {
      return taskDate.name === taskDateName;
    });
  }

  public hasAnyDate(): boolean {
    return this.dates.length > 0;
  }

  public getDate(taskDateName: TaskDateName | null, format: string): string {
    // If there are not dates, then return an empty string
    // This happens when TODOs are included as they don't require a date
    if (this.dates.length === 0) {
      return '';
    }

    // HACK: If taskDateName is null then just use the first date that we know about
    if (taskDateName === null) {
      taskDateName = this.dates[0].name;
    }

    const matchingTaskDate = this.dates.find((taskDate: TaskDate) => {
      if (taskDate.name === taskDateName) {
        return taskDate.date;
      }
    });

    if (typeof matchingTaskDate === 'undefined') {
      return '';
    }    

    // If the Task has its time set, and  Day Planner plugin is enabled it means that time is in local timezone, so we need to convert it to UTC.
    if (hasTime(matchingTaskDate) && settings.isDayPlannerPluginFormatEnabled) {
      return moment(matchingTaskDate.date).utc().format(format);
    } else {
      return moment(matchingTaskDate.date).format(format);
    }
  }

  public getSummary(): string {
    let summary = this.summary
      .replace(/\\/gm, '\\\\')
      .replace(/\r?\n/gm, '\\n')
      .replace(/;/gm, '\\;')
      .replace(/,/gm, '\\,')
      .replace(/,?\s*\d{1,2}:\d{2}(:\d{2})?\s*$/, ''); // Remove HH:MM or HH:MM:SS at the end

    // Remove specified hashtags
    settings.hashtagsToRemove.forEach(hashtag => {
      const regex = new RegExp(hashtag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      summary = summary.replace(regex, '');
    });

    // Remove all remaining hashtags
    summary = summary.replace(/#\w+/g, '');

    // Trim any extra whitespace
    summary = summary.trim();

    const emoji = getTaskStatusEmoji(this.status);

    return `${emoji} ${summary}`;
  }

  public getLocation(): string {
    return this.fileUri;
  }

  public getTimeFromSummary() {
    // Updated regex to handle both 12-hour (with AM/PM) and 24-hour formats- (Eg. 10:00,  11:00 AM, 10:00 - 12:00)
    const timeRegex = /(\d{1,2}(?::\d{2}(?::\d{2})?)?\s*(?:[aApP][mM])?)\s*-\s*(\d{1,2}(?::\d{2}(?::\d{2})?)?\s*(?:[aApP][mM])?)/;
    const singleTimeRegex = /(\d{1,2}(?::\d{2}(?::\d{2})?)?\s*(?:[aApP][mM])?)/;
    // Convert the time to 24-hour format
    const to24HourFormat = (time: string) => {
        let [fullTime, ampm] = time.split(/([aApP][mM])/);
        ampm = ampm ? ampm.toLowerCase() : '';
        let [hours, minutes, seconds] = fullTime.trim().split(':').map(part => Number(part) || 0); // Handle empty or invalid parts
        // Handle AM/PM conversion
        if (ampm.includes('p') && hours !== 12) {
            hours += 12;
        } else if (ampm.includes('a') && hours === 12) {
            hours = 0;
        }
        // Ensure values are properly formatted as two digits
        let hoursStr = Number(hours).toString().padStart(2, '0');
        let minutesStr = Number(minutes || 0).toString().padStart(2, '0');
        let secondsStr = String(seconds || 0).padStart(2, '0');
        return `${hoursStr}:${minutesStr}:${secondsStr}`;
    };
    // Attempt to match the full time range (start - end)
    let match = this.summary.match(timeRegex);
    if (!match) {
        // Fallback to single time (assuming end time is the same as start)
        match = this.summary.match(singleTimeRegex);
        if (match) {
            match = [match[0], match[1], match[1]];
        }
    }
    if (match) {
        // Extract start and end times
        let start = to24HourFormat(match[0].trim());
        alert(start);
        let end = start
        if(match[1]) {
          end = to24HourFormat(match[1].trim());
        }
	      //TODO: handle match[2]
       
        // If start and end times are the same, add 30 minutes to the end time
        if (start === end) {
            const [hours, minutes, seconds] = start.split(':').map(Number);
            const endDate = new Date();
            endDate.setHours(hours, minutes, seconds || 0);
            endDate.setMinutes(endDate.getMinutes() + 30);
            const endHours = String(endDate.getHours()).padStart(2, '0');
            const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
            const endSeconds = String(endDate.getSeconds()).padStart(2, '0');
            end = `${endHours}:${endMinutes}:${endSeconds}`;
        }
        // Format time to hhmmss
        const formatTime = (time: string) => {
            const [hours, minutes, seconds] = time.split(':');
            return `${hours}${minutes}${seconds}`;
        };
        return {
            start: formatTime(start),
            end: formatTime(end)
        };
    }
    
    return null;
  }

}


export function createTaskFromLine(line: string, fileUri: string, dateOverride: Date|null): Task|null {
  const taskRegExp = /(\*|-)\s*(?<taskStatus>\[.?])\s*(?<summary>.*)\s*/gi;
  const dateRegExp = /\b(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{1,2})\b/gi;

  const taskMatch = [...line.matchAll(taskRegExp)][0] ?? null;

  // This isn't a task. Bail.
  if (taskMatch === null) {
    return null;
  }

  const dateMatch = [...line.matchAll(dateRegExp)][0] ?? null;

  // This task doesn't have a date and we are not including TODO items. Bail.
  if ((dateMatch === null && dateOverride === null) && settings.isIncludeTodos === false) {
    return null;
  }

  // Extract the Task data points from the matches
  const taskStatus = getTaskStatusFromMarkdown(taskMatch?.groups?.taskStatus ?? '');

  // Task is done and user wants to ignore completed tasks. Bail.
  if (taskStatus === TaskStatus.Done && settings.ignoreCompletedTasks === true) {
    return null;
  }

  const taskDates = getTaskDatesFromMarkdown(line, dateOverride);

  // Ignore old tasks is enabled, and all of the task's dates are after the retention period. Bail.
  if (settings.ignoreOldTasks === true) {
    const now = new Date();
    const thresholdDate = new Date(now.setDate(now.getDate() - settings.oldTaskInDays));

    const isAllDatesOld = taskDates.every((taskDate: TaskDate) => {
      return taskDate.date < thresholdDate;
    });

    if (isAllDatesOld === true) {
      return null;
    }
  }

  const summary = getSummaryFromMarkdown(taskMatch?.groups?.summary ?? '', settings.howToParseInternalLinks);

  return new Task(taskStatus, taskDates, summary, fileUri);
}
