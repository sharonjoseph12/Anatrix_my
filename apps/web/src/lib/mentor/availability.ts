import { WeeklyTemplateSlot } from '@antarix/types/mentor';

export function validateTemplate(template: WeeklyTemplateSlot[]): { ok: boolean; reason?: string } {
  if (template.length === 0) return { ok: false, reason: 'Template cannot be empty' };
  
  for (const slot of template) {
    if (!slot.day || !slot.start_local || !slot.end_local || !slot.tz) {
      return { ok: false, reason: 'Invalid slot format' };
    }
    if (slot.start_local >= slot.end_local) {
      return { ok: false, reason: 'Start time must be before end time' };
    }
  }
  
  return { ok: true };
}

export function expandWeeklyTemplate(alumnusId: string, template: WeeklyTemplateSlot[], weeks = 4): any[] {
  // Mock expansion logic
  // Returns list of slots mapping to the next 4 weeks
  return template.map(t => ({
    alumnus_id: alumnusId,
    slot_start: new Date().toISOString(),
    slot_end: new Date(Date.now() + 3600000).toISOString(),
    is_blocked: false
  }));
}
