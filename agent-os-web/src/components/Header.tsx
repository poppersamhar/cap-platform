import type { WorkLine } from '../data/mockData';

interface HeaderProps {
  activeView: string;
  activeProjectId: string | null;
  projects: WorkLine[];
}

const viewTitles: Record<string, string> = {
  home: '主页',
  agent: '数字员工',
  skill: 'Skills',
  'project-wizard': '新建项目',
};

export default function Header({ activeView, activeProjectId, projects }: HeaderProps) {
  const getTitle = () => {
    if (activeView === 'project' && activeProjectId) {
      const project = projects.find(p => p.id === activeProjectId);
      return project?.name || '项目';
    }
    return viewTitles[activeView] || '';
  };

  return (
    <header className="h-14 bg-transparent flex items-center px-5 shrink-0 z-20">
      <h1 className="text-base font-semibold text-text tracking-tight">{getTitle()}</h1>
    </header>
  );
}
