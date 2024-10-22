import { Task } from './Model/Task';
import { TaskDateName } from './Model/TaskDate';
import { TaskStatus } from './Model/TaskStatus';
import { settings } from './SettingsManager';
import { DATE_FORMATS } from './Model/DateFormats';
import moment from 'moment';

export class IcalService {
  getCalendar(tasks: Task[]): string {
    const events = this.getEvents(tasks);
    const toDos = settings.isIncludeTodos ? this.getToDos(tasks) : '';

    let calendar = '' +
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'PRODID:-//Andrew Brereton//obsidian-ical-plugin v1.19.0//EN\r\n' +
      'X-WR-CALNAME:Obsidian Calendar\r\n' +
      'NAME:Obsidian Calendar\r\n' +
      'CALSCALE:GREGORIAN\r\n' +
      events +
      toDos +
      'END:VCALENDAR\r\n'
      ;

    calendar = this.pretty(calendar);

    return calendar;
  }

  private getEvents(tasks: Task[]): string {
    return tasks
      .map((task: Task) => {
        return this.getEvent(task, null, '');
      })
      .join('');
  }

  private getEvent(task: Task, date: string|null, prependSummary: string): string {
    if (task.hasAnyDate() === false) {
      return '';
    }

    let event = '' +
      'BEGIN:VEVENT\r\n' +
      'UID:' + task.getId() + '\r\n' +
      'DTSTAMP:' + task.getDate(null, 'YYYYMMDDTHHmmss') + '\r\n';

    if (date === null) {
      switch (settings.howToProcessMultipleDates) {
        case 'PreferStartDate':
          if (task.hasA(TaskDateName.Start)) {
            event += 'DTSTART:' + task.getDate(TaskDateName.Start, 'YYYYMMDD') + '\r\n';
          } else if (task.hasA(TaskDateName.Due)) {
            event += 'DTSTART:' + task.getDate(TaskDateName.Due, 'YYYYMMDD') + '\r\n';
          } else if (task.hasA(TaskDateName.TimeStart) && task.hasA(TaskDateName.TimeEnd)) {
            event += 'DTSTART:' + task.getDate(TaskDateName.TimeStart, 'YYYYMMDD[T]HHmmss[Z]') + '\r\n';
            event += 'DTEND:' + task.getDate(TaskDateName.TimeEnd, 'YYYYMMDD[T]HHmmss[Z]') + '\r\n';
          } else {
            event += 'DTSTART:' + task.getDate(null, 'YYYYMMDD') + '\r\n';
          }
          break;

        case 'CreateMultipleEvents':
          event = '';
          if (task.hasA(TaskDateName.Start)) {
            event += this.getEvent(task, task.getDate(TaskDateName.Start, 'YYYYMMDD'), '🛫 ');
          }
          if (task.hasA(TaskDateName.Scheduled)) {
            event += this.getEvent(task, task.getDate(TaskDateName.Scheduled, 'YYYYMMDD'), '⏳ ');
          }
          if (task.hasA(TaskDateName.Due)) {
            event += this.getEvent(task, task.getDate(TaskDateName.Due, 'YYYYMMDD'), '📅 ');
          }
          if (event === '') {
            event += this.getEvent(task, task.getDate(null, 'YYYYMMDD'), '');
          }
          return event;

        case 'PreferDueDate':
        case 'PreferDueDateWithTime':
        default:
          if (task.hasA(TaskDateName.Due)) {
            const dueDate = task.getDate(TaskDateName.Due, 'YYYY-MM-DD HH:mm:ss');
            const dueMoment = moment(dueDate, 'YYYY-MM-DD HH:mm:ss');
            
            if (dueMoment.isValid() && (dueMoment.hours() !== 0 || dueMoment.minutes() !== 0 || dueMoment.seconds() !== 0)) {
              event += 'DTSTART:' + dueMoment.format('YYYYMMDDTHHmmss') + '\r\n';
            } else {
              const defaultTime = settings.defaultStartTime || '00:00:00';
              event += 'DTSTART:' + dueMoment.format('YYYYMMDD') + 'T' + defaultTime.replace(/:/g, '') + '\r\n';
            }

            // Calculate end time
            const endMoment = dueMoment.clone().add(settings.defaultDuration, 'minutes');
            event += 'DTEND:' + endMoment.format('YYYYMMDDTHHmmss') + '\r\n';
          } else if (task.hasA(TaskDateName.Start)) {
            const startDate = task.getDate(TaskDateName.Start, 'YYYY-MM-DD HH:mm:ss');
            const startMoment = moment(startDate, 'YYYY-MM-DD HH:mm:ss');
            const defaultTime = settings.defaultStartTime || '00:00:00';
            
            if (startMoment.isValid() && (startMoment.hours() !== 0 || startMoment.minutes() !== 0 || startMoment.seconds() !== 0)) {
              event += 'DTSTART:' + startMoment.format('YYYYMMDDTHHmmss') + '\r\n';
            } else {
              event += 'DTSTART:' + startMoment.format('YYYYMMDD') + 'T' + defaultTime.replace(/:/g, '') + '\r\n';
            }

            const endMoment = startMoment.clone().add(settings.defaultDuration, 'minutes');
            event += 'DTEND:' + endMoment.format('YYYYMMDDTHHmmss') + '\r\n';
          } else if (task.hasA(TaskDateName.TimeStart) && task.hasA(TaskDateName.TimeEnd)) {
            event += 'DTSTART:' + task.getDate(TaskDateName.TimeStart, 'YYYYMMDD[T]HHmmss[Z]') + '\r\n';
            event += 'DTEND:' + task.getDate(TaskDateName.TimeEnd, 'YYYYMMDD[T]HHmmss[Z]') + '\r\n';
          } else {
            const defaultDate = task.getDate(null, 'YYYYMMDD');
            const defaultTime = settings.defaultStartTime || '00:00:00';
            event += 'DTSTART:' + defaultDate + 'T' + defaultTime.replace(/:/g, '') + '\r\n';
            
            const endMoment = moment(defaultDate + ' ' + defaultTime, 'YYYYMMDD HH:mm:ss').add(settings.defaultDuration, 'minutes');
            event += 'DTEND:' + endMoment.format('YYYYMMDDTHHmmss') + '\r\n';
          }
          break;
      }
    } else {
      event += 'DTSTART:' + date + '\r\n';
    }

    const summary = task.getSummary().replace(/,\s*\d{2}:\d{2}$/, '');
    event += 'SUMMARY:' + prependSummary + summary + '\r\n' +
             'LOCATION:ALTREP="' + encodeURI(task.getLocation()) + '":' + encodeURI(task.getLocation()) + '\r\n' +
             'END:VEVENT\r\n';

    return event;
  }

  private getToDos(tasks: Task[]): string {
    return tasks
      .map((task: Task) => {
        if (settings.isOnlyTasksWithoutDatesAreTodos && task.hasAnyDate() === true) {
          // User only wants tasks without dates to be added as TODO items
          return '';
        }

        return this.getToDo(task);
      })
      .join('');
  }

  private getToDo(task: Task): string {
    let toDo = '' +
      'BEGIN:VTODO\r\n' +
      'UID:' + task.getId() + '\r\n' +
      'SUMMARY:' + task.getSummary() + '\r\n' +
      // If a task does not have a date, do not include the DTSTAMP property
      (task.hasAnyDate() ? 'DTSTAMP:' + task.getDate(null, 'YYYYMMDDTHHmmss') + '\r\n' : '') +
      'LOCATION:ALTREP="' + encodeURI(task.getLocation()) + '":' + encodeURI(task.getLocation()) + '\r\n';

    if (task.hasA(TaskDateName.Due)) {
      toDo += 'DUE;VALUE=DATE:' + task.getDate(TaskDateName.Due, 'YYYYMMDD') + '\r\n';
    }

    if (task.hasA(TaskDateName.Done)) {
      toDo += 'COMPLETED;VALUE=DATE:' + task.getDate(TaskDateName.Done, 'YYYYMMDD') + '\r\n';
    }

    switch (task.status) {
      case TaskStatus.ToDo:
        toDo += 'STATUS:NEEDS-ACTION\r\n';
        break;
      case TaskStatus.InProgress:
        toDo += 'STATUS:IN-PROCESS\r\n';
        break;
      case TaskStatus.Done:
        toDo += 'STATUS:COMPLETED\r\n';
        break;
      case TaskStatus.Cancelled:
        toDo += 'STATUS:CANCELLED\r\n';
        break;
    }

    toDo += 'END:VTODO\r\n';

    return toDo;
  }

  private pretty(calendar: string): string {
    // Replace two or more /r or /n or /r/n with a single CRLF
    calendar = calendar.replace('/\R{2,}/', '\r\n');

    // Ensure all line endings are CRLF. Have to do 'BSR_ANYCRLF' so we don't break emojis
    calendar = calendar.replace('~(*BSR_ANYCRLF)\R~', '\r\n');

    // Line length should not be longer than 75 characters (https://icalendar.org/iCalendar-RFC-5545/3-1-content-lines.html)
    //#TODO I can't be bothered implementing this *should* requirement

    // Ensure we are UTF-8
    calendar = Buffer.from(calendar, 'utf8').toString('utf8');

    return calendar;
  }
}
