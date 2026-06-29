import type { Task } from '@/lib/task-parser';
import { ActivityFeed } from './activity-feed';
import { ProjectInfo } from './project-info';
import { StatsCards } from './stats-cards';

interface DashboardProps {
  tasks: Task[];
}

export function Dashboard({ tasks }: DashboardProps) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 pb-8 sm:gap-6">
      <StatsCards tasks={tasks} />
      <ActivityFeed tasks={tasks} />

      <ProjectInfo />
    </div>
  );
}
