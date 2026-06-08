const SYNC_ALARM_NAME = "antarix:sync";
const FOCUS_POLL_ALARM = "antarix:focus-poll";

export function registerAlarms(): void {
  chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 60 });
  chrome.alarms.create(FOCUS_POLL_ALARM, { periodInMinutes: 1 });
}

export function getSyncAlarmName(): string {
  return SYNC_ALARM_NAME;
}

export function getFocusPollAlarmName(): string {
  return FOCUS_POLL_ALARM;
}
