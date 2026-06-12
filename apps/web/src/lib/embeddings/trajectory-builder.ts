import { UserRole } from '@antarix/types/trajectory';

// Mock DB interface for the builder
export async function buildTrajectoryText(userId: string, role: UserRole): Promise<string> {
  // In a real implementation, this would query the DB for the user's completed tasks,
  // projects, mock interviews, and format them chronologically.
  
  const events = [
    { timestamp: '2026-01-10T10:00:00Z', skill: 'React Native', score_delta: 5 },
    { timestamp: '2026-02-15T14:30:00Z', skill: 'Supabase', project: 'E-commerce App', score_delta: 8 }
  ];

  if (events.length === 0) {
    return 'No trajectory events recorded.';
  }

  const lines = events.map(e => 
    `[${e.timestamp}] Developed skill: ${e.skill} ${e.project ? `in project ${e.project}` : ''} (+${e.score_delta} score)`
  );
  
  return `Role: ${role}\nTrajectory:\n${lines.join('\n')}`;
}
