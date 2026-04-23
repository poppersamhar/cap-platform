import { useState, useRef, useEffect } from 'react';
import {
  Home, Bot, Wrench, Plus, User,
  Bell, LogOut, Settings, HelpCircle, Shield, Moon, Check,
  ChevronLeft, ChevronRight,
  Folder, Briefcase, Target, Rocket, Globe, Zap,
  BarChart3, Users, Lightbulb, Layers, Star,
  MessageCircle,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { WorkLine } from '../data/mockData';

interface SidebarProps {
  activeView: string;
  activeProjectId: string | null;
  activeChatId: string | null;
  projects: WorkLine[];
  onNavigate: (view: string, projectId?: string, chatId?: string | null) => void;
  onCreateProject: () => void;
  onCreateTask?: (projectId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { key: 'home', label: '主页', icon: Home },
  { key: 'agent', label: '数字员工', icon: Bot },
  { key: 'skill', label: 'Skills', icon: Wrench },
];

const themeOptions = [
  { key: 'coral' as const, label: '珊瑚花瓣', color: '#e17055' },
  { key: 'azure' as const, label: '苍蓝骑士', color: '#0984e3' },
  { key: 'emerald' as const, label: '翡翠周日', color: '#00b894' },
];

const projectIconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  folder: Folder, briefcase: Briefcase, target: Target, rocket: Rocket,
  globe: Globe, zap: Zap, shield: Shield, barchart: BarChart3,
  users: Users, lightbulb: Lightbulb, layers: Layers, star: Star,
};

function ProjectIcon({ icon, collapsed, isActive }: { icon?: string; collapsed: boolean; isActive: boolean }) {
  const Icon = projectIconMap[icon || 'folder'] || Folder;
  return (
    <div className={`shrink-0 flex items-center justify-center ${collapsed ? '' : 'mt-0.5'}`}>
      <Icon className={`w-[14px] h-[14px] ${isActive ? 'text-primary-dark' : 'text-text-muted'}`} strokeWidth={1.5} />
    </div>
  );
}

function ProjectTree({
  projects, activeView, activeProjectId, activeChatId, onNavigate, onCreateTask, collapsed,
}: {
  projects: WorkLine[];
  activeView: string;
  activeProjectId: string | null;
  activeChatId: string | null;
  onNavigate: (view: string, projectId?: string, chatId?: string | null) => void;
  onCreateTask?: (projectId: string) => void;
  collapsed: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(projects.map(p => p.id)));

  const toggleExpand = (projectId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {projects.map((project) => {
          const isActiveProject = activeView === 'project' && activeProjectId === project.id;
          return (
            <button
              key={project.id}
              onClick={() => onNavigate('project', project.id, null)}
              className={`w-full flex items-center rounded-xl text-left transition-all duration-200 relative ${
                isActiveProject ? 'bg-primary-subtle' : 'hover:bg-primary/5'
              } justify-center px-2 py-2.5`}
              title={project.name}
            >
              {isActiveProject && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <ProjectIcon icon={project.icon} collapsed={true} isActive={isActiveProject} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {projects.map((project) => {
        const isExpanded = expandedIds.has(project.id);
        const isActiveProject = activeView === 'project' && activeProjectId === project.id;
        return (
          <div key={project.id}>
            {/* Project row */}
            <div
              className={`group w-full flex items-center rounded-xl text-left transition-all duration-200 relative ${
                isActiveProject ? 'bg-primary-subtle' : 'hover:bg-primary/5'
              } gap-2 px-2.5 py-2`}
            >
              {isActiveProject && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <button
                onClick={() => toggleExpand(project.id)}
                className="shrink-0 p-0.5 hover:bg-primary/10 rounded-md transition-colors"
              >
                <ChevronRight
                  className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  strokeWidth={2}
                />
              </button>
              <button
                onClick={() => onNavigate('project', project.id, null)}
                className="min-w-0 flex-1 flex items-center gap-2 text-left"
              >
                <ProjectIcon icon={project.icon} collapsed={false} isActive={isActiveProject} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] font-medium truncate leading-snug ${isActiveProject ? 'text-primary-dark' : 'text-text'}`}>
                    {project.name}
                  </div>
                </div>
              </button>

              {/* Hover actions: + / ... */}
              <div className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-150 ${isActiveProject ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {onCreateTask && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateTask(project.id);
                    }}
                    className="p-1 hover:bg-primary/10 rounded-md transition-colors text-text-muted hover:text-text"
                    title="新建任务"
                  >
                    <Plus className="w-3 h-3" strokeWidth={2} />
                  </button>
                )}
                <button
                  className="p-1 hover:bg-primary/10 rounded-md transition-colors text-text-muted hover:text-text"
                  title="更多"
                >
                  <span className="text-[10px] font-bold leading-none">···</span>
                </button>
              </div>

              {project.unread && (
                <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
              )}
            </div>

            {/* Chat list */}
            {isExpanded && (
              <div className="ml-5 pl-3 border-l border-border-light mt-0.5 space-y-0.5">
                {project.chats.map((chat) => {
                  const isActiveChat = activeView === 'project' && activeChatId === chat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => onNavigate('project', project.id, chat.id)}
                      className={`w-full flex items-center gap-2 rounded-xl text-left transition-all duration-200 px-2.5 py-1.5 ${
                        isActiveChat ? 'bg-primary-subtle/60' : 'hover:bg-primary/5'
                      }`}
                    >
                      <MessageCircle className={`w-3 h-3 shrink-0 ${isActiveChat ? 'text-primary-dark' : 'text-text-muted'}`} strokeWidth={1.5} />
                      <span className={`text-[12px] truncate ${isActiveChat ? 'text-primary-dark font-medium' : 'text-text-secondary'}`}>
                        {chat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Sidebar({ activeView, activeProjectId, activeChatId, projects, onNavigate, onCreateProject, onCreateTask, collapsed, onToggleCollapse }: SidebarProps) {
  const { themeColor, setThemeColor } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Company Header */}
      <div className={`shrink-0 pt-5 pb-3 ${collapsed ? 'px-3' : 'px-4'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* H Logo */}
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm shadow-primary/20 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4v16M20 4v16M4 12h16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
              </svg>
            </div>
            {!collapsed && (
              <span className="font-semibold text-text tracking-tight text-sm truncate">海致科技</span>
            )}
          </div>
          {/* Collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-primary/10 rounded-lg transition-colors text-text-muted"
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Scrollable middle */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden pb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* Main Nav */}
        <nav className="space-y-0.5 mb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 relative ${
                  isActive
                    ? 'bg-primary-subtle text-primary-dark'
                    : 'text-text-secondary hover:bg-primary/5 hover:text-text'
                } ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Projects Section */}
        <div className={`mb-2 flex items-center justify-between ${collapsed ? 'px-1' : 'px-1'}`}>
          {!collapsed && (
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">项目</span>
          )}
          {collapsed && <span className="w-1" />}
          <button
            onClick={onCreateProject}
            className="p-1 hover:bg-primary/5 rounded-lg transition-colors"
            title="新建项目"
          >
            <Plus className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
        <ProjectTree
          projects={projects}
          activeView={activeView}
          activeProjectId={activeProjectId}
          activeChatId={activeChatId}
          onNavigate={onNavigate}
          onCreateTask={onCreateTask}
          collapsed={collapsed}
        />
      </div>

      {/* Bottom fixed area: Notification → samhar → Collapse toggle */}
      <div className={`shrink-0 pb-4 space-y-1.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* Notification bell */}
        <button className={`w-full flex items-center rounded-xl hover:bg-primary/5 transition-colors text-left group ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'}`}>
          <div className="relative">
            <Bell className="w-[18px] h-[18px] text-text-secondary" strokeWidth={1.8} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full ring-2 ring-sidebar-bg" />
          </div>
          {!collapsed && (
            <>
              <span className="text-[13px] font-medium text-text">通知</span>
              <span className="ml-auto text-[11px] text-text-muted bg-main-bg px-2 py-[1px] rounded-full font-medium border border-border">3</span>
            </>
          )}
        </button>

        {/* samhar user card with dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`w-full flex items-center rounded-xl transition-all duration-200 text-left ${
              menuOpen
                ? 'bg-primary/10'
                : 'hover:bg-primary/5'
            } ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2'}`}
          >
            <div className="w-8 h-8 bg-primary-subtle rounded-full flex items-center justify-center border border-primary/10 shrink-0">
              <User className="w-[16px] h-[16px] text-primary-dark" strokeWidth={1.8} />
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text tracking-tight">samhar</div>
                </div>
                <div className="w-2 h-2 bg-success rounded-full shrink-0 ring-2 ring-sidebar-bg" />
              </>
            )}
          </button>

          {/* Dropdown menu - opens upward from bottom */}
          {menuOpen && !collapsed && (
            <div className="absolute left-0 bottom-full mb-2 w-60 bg-surface border border-border rounded-2xl shadow-xl shadow-black/[0.06] overflow-hidden animate-fade-in z-50">
              {/* Theme Color Selector */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">主题色</div>
                <div className="space-y-1">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setThemeColor(opt.key)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm text-text hover:bg-bg transition-colors"
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border-2"
                        style={{ backgroundColor: opt.color, borderColor: opt.color }}
                      />
                      <span className="flex-1 text-left">{opt.label}</span>
                      {themeColor === opt.key && (
                        <Check className="w-4 h-4 text-primary" strokeWidth={2} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border-light mx-3" />

              <div className="p-1.5">
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text hover:bg-bg transition-colors">
                  <Settings className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                  设置
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text hover:bg-bg transition-colors">
                  <Shield className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                  账户安全
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text hover:bg-bg transition-colors">
                  <Moon className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                  深色模式
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text hover:bg-bg transition-colors">
                  <HelpCircle className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                  帮助与反馈
                </button>
              </div>
              <div className="border-t border-border-light mx-1.5" />
              <div className="p-1.5">
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-danger hover:bg-danger-subtle transition-colors">
                  <LogOut className="w-4 h-4" strokeWidth={1.8} />
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
