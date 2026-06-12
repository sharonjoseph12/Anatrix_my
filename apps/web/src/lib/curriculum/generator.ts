import { CurriculumLesson } from '@antarix/types/curriculum';

export async function generateLessonsForStudent(student: any, env: any): Promise<Partial<CurriculumLesson>[]> {
  return [
    {
      topic: 'React Hooks',
      concept: 'Understanding useEffect dependencies',
      exercise_starter_code: 'function App() { ... }',
      reflection_question: 'Why did the component re-render?',
      alumnus_project_link: 'https://github.com/alumnus/react-project',
      duration_minutes: 10,
      scheduled_window_start: new Date().toISOString(),
      scheduled_window_end: new Date(Date.now() + 3600000).toISOString(),
      created_for_date: new Date().toISOString().split('T')[0]
    }
  ];
}
