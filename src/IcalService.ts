import { Task } from './Model/Task';
import { TaskDateName } from './Model/TaskDate';
import { TaskStatus } from './Model/TaskStatus';
import { settings } from './SettingsManager';

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

  private add30Minutes(datetimeStr: string, p0: number): string {
    const year = datetimeStr.slice(0, 4);
    const month = datetimeStr.slice(4, 6);
    const day = datetimeStr.slice(6, 8);
    const hour = datetimeStr.slice(9, 11);
    const minute = datetimeStr.slice(11, 13);
    const second = datetimeStr.slice(13, 15);

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    date.setMinutes(date.getMinutes() + 30);

    const pad = (num: number) => String(num).padStart(2, '0');

    const newYear = date.getFullYear();
    const newMonth = pad(date.getMonth() + 1);
    const newDay = pad(date.getDate());
    const newHour = pad(date.getHours());
    const newMinute = pad(date.getMinutes());
    const newSecond = pad(date.getSeconds());

    return `${newYear}${newMonth}${newDay}T${newHour}${newMinute}${newSecond}`;
  }

  private getEvents(tasks: Task[]): string {
    return tasks
      .map((task: Task) => {
        return this.getEvent(task, null, '');
      })
      .join('');
  }

  private getEvent(task: Task, date: string | null, prependSummary: string): string {
    // console.log({task});

    // This task does not have a date.
    // Therefore it must be included because it is a TODO and isIncludeTodos setting is true.
    // Don't add it to the VEVENT block, as it will be added to the VTODO block later.
    if (task.hasAnyDate() === false) {
      return '';
    }

    let event = "BEGIN:VEVENT\r\nUID:" + task.getId() + "\r\nDTSTAMP:" + task.getDate(null, "YYYYMMDDTHHmmss") + "\r\n";
    const times = task.getTimeFromSummary();
    const defaultdate = task.getDate(null, "YYYYMMDD");
    if (date === null) {
      if (times) {
        let dtstart = task.getDate(null, "YYYYMMDD");
        let dtend = task.getDate(null, "YYYYMMDD");
        if (task.hasA(TaskDateName.Scheduled)) {
          dtstart = task.getDate(TaskDateName.Scheduled, "YYYYMMDD");
        }
        if (task.hasA(TaskDateName.Due)) {
          dtend = task.getDate(TaskDateName.Due, "YYYYMMDD");
        }
        event += `DTSTART:${dtstart}T${times.start}\r\n`;
        event += `DTEND:${dtend}T${times.end}\r\n`;
      } else {
        switch (settings.howToProcessMultipleDates) {
          case "PreferScheduledDate":
            if (task.hasA(
              TaskDateName.Scheduled
              /* Scheduled */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.Scheduled, "YYYYMMDDTHHmmss") + "\r\n";
              event += "DTEND:" + this.add30Minutes(task.getDate(TaskDateName.Scheduled, "YYYYMMDDTHHmmss"), 30) + "\r\n";
            } else if (task.hasA(
              TaskDateName.Due
              /* Due */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.Due, "YYYYMMDDTHHmmss") + "\r\n";
              event += "DTEND:" + this.add30Minutes(task.getDate(TaskDateName.Due, "YYYYMMDDTHHmmss"), 30) + "\r\n";
            } else if (task.hasA(
              TaskDateName.TimeStart
              /* TimeStart */
            ) && task.hasA(
              TaskDateName.TimeEnd
              /* TimeEnd */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.TimeStart, "YYYYMMDD[T]HHmmss[Z]") + "\r\n";
              event += "DTEND:" + task.getDate(TaskDateName.TimeStart, "YYYYMMDD[T]HHmmss[Z]") + "\r\n";
            } else {
              event += "DTSTART:" + task.getDate(null, "YYYYMMDDTHHmmss") + "\r\n";
              event += "DTEND:" + this.add30Minutes(task.getDate(null, "YYYYMMDDTHHmmss"), 30) + "\r\n";
            }
            break;
          case "CreateMultipleEvents":
            event = "";
            if (task.hasA(
              TaskDateName.Start
              /* Start */
            )) {
              event += this.getEvent(task, task.getDate(TaskDateName.Start, "YYYYMMDDTHHmmss"), "\u{1F6EB} ");
            }
            if (task.hasA(
              TaskDateName.Scheduled
              /* Scheduled */
            )) {
              event += this.getEvent(task, task.getDate(TaskDateName.Scheduled, "YYYYMMDDTHHmmss"), "\u23F3 ");
            }
            if (task.hasA(
              TaskDateName.Due
              /* Due */
            )) {
              event += this.getEvent(task, task.getDate(TaskDateName.Due, "YYYYMMDDTHHmmss"), "\u{1F4C5} ");
            }
            if (event === "") {
              event += this.getEvent(task, task.getDate(null, "YYYYMMDDTHHmmss"), "");
            }
            return event;
          case "PreferDueDate":
            if (task.hasA(
              TaskDateName.Scheduled
              /* Scheduled */
            ) && task.hasA(
              TaskDateName.Due
              /* Due */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.Scheduled, "YYYYMMDDTHHmmss") + "\r\nDTEND:" + task.getDate(TaskDateName.Due, "YYYYMMDDTHHmmss") + "\r\n";
            } else if (task.hasA(
              TaskDateName.Due
              /* Due */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.Due, "YYYYMMDDTHHmmss") + "\r\n";
              event += "DTEND:" + this.add30Minutes(task.getDate(TaskDateName.Due, "YYYYMMDDTHHmmss"), 30) + "\r\n";
            } else if (task.hasA(
              TaskDateName.Scheduled
              /* Scheduled */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.Scheduled, "YYYYMMDDTHHmmss") + "\r\n";
              event += "DTEND:" + this.add30Minutes(task.getDate(TaskDateName.Scheduled, "YYYYMMDDTHHmmss"), 30) + "\r\n";
            } else if (task.hasA(
              TaskDateName.TimeStart
              /* TimeStart */
            ) && task.hasA(
              TaskDateName.TimeEnd
              /* TimeEnd */
            )) {
              event += "DTSTART:" + task.getDate(TaskDateName.TimeStart, "YYYYMMDD[T]HHmmss[Z]") + "\r\n";
              event += "DTEND:" + task.getDate(TaskDateName.TimeEnd, "YYYYMMDD[T]HHmmss[Z]") + "\r\n";
            } else {
              event += "DTSTART:" + task.getDate(null, "YYYYMMDDTHHmmss") + "\r\n";
              event += "DTEND:" + this.add30Minutes(task.getDate(null, "YYYYMMDDTHHmmss"), 30) + "\r\n";
            }
            break;
        }
      }
    } else {
      if (times) {
        event += `DTSTART:${date.slice(0, 8)}T${times.start}00\r\n`;
        event += `DTEND:${date.slice(0, 8)}T${times.end}00\r\n`;
        event += `times:${times}\r\n`;
      } else {
        event += `DTSTART:${date}\r\n`;
        event += `DTEND:${this.add30Minutes(date, 30)}\r\n`;
      }
    }
    event += "SUMMARY:" + prependSummary + task.getSummary() + '\r\nLOCATION:ALTREP="' + encodeURI(task.getLocation()) + '":' + encodeURI(task.getLocation()) + "\r\nEND:VEVENT\r\n";
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
    
    // Buffer is not used here because it relies on Node.js-specific APIs like Buffer.from and Buffer.toString,    
    // which are not available in environments like mobile versions of Obsidian.
    // Instead, TextEncoder and TextDecoder are used for compatibility.

    // Ensure we are UTF-8
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const encoded = encoder.encode(calendar);
    calendar = decoder.decode(encoded);

    return calendar;
  }
}
