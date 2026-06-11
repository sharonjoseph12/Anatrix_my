export interface CronRegistration {
  name: string;
  schedule: string | "event-triggered";
  functionName: string;
}

export const COLLAB_CRON_REGISTRATIONS: readonly CronRegistration[] = [
  { name: "teamwork-scorer", schedule: "event-triggered", functionName: "teamwork-scorer" },
  { name: "collab-recording-purge-daily", schedule: "0 3 * * *", functionName: "collab-recording-purge" },
  { name: "collab-snapshot-cleanup-daily", schedule: "0 4 * * *", functionName: "collab-snapshot-cleanup" },
];
