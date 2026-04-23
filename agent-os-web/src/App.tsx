import { useState, useRef, useCallback, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProjectChat from './components/ProjectChat';
import ProjectWizard from './components/ProjectWizard';
import AgentPage from './components/AgentPage';
import SkillPage from './components/SkillPage';
import RightPanel from './components/RightPanel';
import BizAgentPanel from './components/BizAgentPanel';
import KnowledgeGraph from './components/KnowledgeGraph';
import DraggableChat from './components/DraggableChat';
import FilePanel from './components/FilePanel';
import TaskWizard from './components/TaskWizard';
import { projects as initialProjects, agents as initialAgents } from './data/mockData';
import type { Project, Agent } from './data/mockData';
import type { ExcludeRect } from './components/DraggableChat';

type ViewType = 'home' | 'project' | 'agent' | 'skill';

function AppContent() {
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<Project[]>(initialProjects);
  const [agentList, setAgentList] = useState<Agent[]>(initialAgents);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);
  const excludeRectRef = useRef<ExcludeRect>({ x: 0, y: 0, width: 340, height: 320, active: false });

  // 项目聊天视图分割条状态
  const [projectSplitPercent, setProjectSplitPercent] = useState(40);
  const [isProjectResizing, setIsProjectResizing] = useState(false);
  const projectContainerRef = useRef<HTMLDivElement>(null);

  const activeProject = projectList.find(p => p.id === activeProjectId);

  const isProjectOverview = activeView === 'project' && activeProjectId && !activeChatId;
  const isProjectChat = activeView === 'project' && activeProjectId && activeChatId;
  const isHomeView = activeView === 'home';
  const isAgentView = activeView === 'agent';
  const isSkillView = activeView === 'skill';

  const handleNavigate = (view: string, projectId?: string, chatId?: string | null) => {
    setActiveView(view as ViewType);
    if (projectId !== undefined) {
      setActiveProjectId(projectId);
    }
    if (chatId !== undefined) {
      setActiveChatId(chatId);
    }
    if (view !== 'agent') setSelectedAgentId(null);
    if (view !== 'skill') setSelectedSkillId(null);
  };

  const handleCreateProject = (name: string, desc: string, icon: string) => {
    const pid = `p${Date.now()}`;
    const newProject: Project = {
      id: pid,
      name,
      description: desc,
      updatedAt: '刚刚',
      memberCount: 1,
      unread: false,
      status: 'active',
      icon,
      chats: [{ id: `c${Date.now()}`, name: '主对话', projectId: pid, messages: [] }],
    };
    setProjectList(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setActiveChatId(null); // 新建项目显示项目展示页（图谱）
    setActiveView('project');
    setShowProjectModal(false);
  };

  const handleCreateAgent = (agent: Agent) => {
    setAgentList(prev => [...prev, agent]);
  };

  const handleCreateTask = (projectId: string) => {
    setTaskProjectId(projectId);
    setShowTaskModal(true);
  };

  const handleConfirmCreateTask = (name: string, _desc: string) => {
    if (!taskProjectId) return;
    const cid = `c${Date.now()}`;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const defaultMessages = [
      {
        id: `m${Date.now()}-1`,
        role: 'human' as const,
        senderId: 'u1',
        senderName: 'samhar',
        content: '大家好，我是samhar',
        timestamp: timeStr,
        status: 'sent' as const,
      },
      {
        id: `m${Date.now()}-2`,
        role: 'host' as const,
        senderId: 'host1',
        senderName: 'BizAgent',
        content: '你好，我是你的助理bizagent，也是这个团队的负责人。让我们一起协作完成这个任务吧！',
        timestamp: timeStr,
        status: 'sent' as const,
      },
    ];
    setProjectList(prev => prev.map(p => {
      if (p.id !== taskProjectId) return p;
      return {
        ...p,
        chats: [...p.chats, { id: cid, name, projectId: p.id, messages: defaultMessages }],
      };
    }));
    setActiveProjectId(taskProjectId);
    setActiveChatId(cid);
    setActiveView('project');
    setShowTaskModal(false);
    setTaskProjectId(null);
  };

  // 项目聊天视图拖拽逻辑
  const handleProjectResizeStart = useCallback(() => {
    setIsProjectResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleProjectResizeMove = useCallback((e: MouseEvent) => {
    if (!isProjectResizing || !projectContainerRef.current) return;
    const rect = projectContainerRef.current.getBoundingClientRect();
    const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
    setProjectSplitPercent(Math.min(Math.max(newPercent, 20), 80));
  }, [isProjectResizing]);

  const handleProjectResizeEnd = useCallback(() => {
    setIsProjectResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isProjectResizing) {
      window.addEventListener('mousemove', handleProjectResizeMove);
      window.addEventListener('mouseup', handleProjectResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleProjectResizeMove);
      window.removeEventListener('mouseup', handleProjectResizeEnd);
    };
  }, [isProjectResizing, handleProjectResizeMove, handleProjectResizeEnd]);

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      {/* Sidebar */}
      <div className={`h-full shrink-0 overflow-hidden bg-sidebar-bg transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-[220px]'}`}>
        <Sidebar
          activeView={activeView}
          activeProjectId={activeProjectId}
          activeChatId={activeChatId}
          projects={projectList}
          onNavigate={handleNavigate}
          onCreateProject={() => setShowProjectModal(true)}
          onCreateTask={handleCreateTask}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        />
      </div>

      {/* Main content area */}
      {isHomeView ? (
        <>
          <div className="flex-1 min-w-0 bg-main-bg overflow-y-auto relative">
            <div className="pr-[372px]">
              <Dashboard />
            </div>
          </div>
          <div className="fixed right-3 top-[60px] bottom-14 w-[360px] z-10">
            <BizAgentPanel activeView={activeView} />
          </div>
        </>
      ) : isProjectOverview ? (
        // 项目展示页：3D 图谱 + 浮动 BizAgent + 文件列表
        <div className="flex-1 flex flex-col min-w-0 bg-main-bg relative">
          <div className="h-[52px] shrink-0 flex flex-col justify-center px-5 bg-white/70 backdrop-blur-md z-20">
            <h1 className="text-[13px] font-semibold text-text leading-none tracking-tight">{activeProject?.name}</h1>
            <p className="text-[11px] text-text-muted leading-none mt-1.5">{activeProject?.description}</p>
          </div>
          <div className="flex-1 flex min-h-0 relative">
            <div className="flex-1 relative">
              <KnowledgeGraph projectId={activeProjectId} excludeRectRef={excludeRectRef} />
              <DraggableChat projectId={activeProjectId} rectRef={excludeRectRef} />
            </div>
            <FilePanel projectId={activeProjectId} />
          </div>
        </div>
      ) : isProjectChat ? (
        // 项目聊天页：左右分栏（ProjectChat + RightPanel）
        <div ref={projectContainerRef} className="flex-1 flex min-w-0 bg-main-bg">
          <div className="h-full overflow-hidden" style={{ width: `${projectSplitPercent}%` }}>
            <ProjectChat chatId={activeChatId} />
          </div>
          <div
            onMouseDown={handleProjectResizeStart}
            className={`w-1.5 shrink-0 relative group transition-colors ${
              isProjectResizing ? 'bg-primary' : 'bg-border hover:bg-primary'
            }`}
            style={{ cursor: 'col-resize' }}
          >
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${
                isProjectResizing ? 'bg-primary-dark' : 'bg-text-muted/30 group-hover:bg-primary/60'
              }`}
            />
          </div>
          <div className="h-full overflow-hidden" style={{ width: `${100 - projectSplitPercent}%` }}>
            <RightPanel activeView={activeView} activeProjectId={activeProjectId} />
          </div>
        </div>
      ) : isAgentView ? (
        <>
          <div className="flex-1 min-w-0 bg-main-bg overflow-y-auto relative">
            <div className="pr-[372px]">
              <AgentPage
                agents={agentList}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
                onCreateAgent={handleCreateAgent}
              />
            </div>
          </div>
          <div className="fixed right-3 top-[60px] bottom-14 w-[360px] z-10">
            <BizAgentPanel activeView={activeView} selectedAgentId={selectedAgentId} agents={agentList} />
          </div>
        </>
      ) : isSkillView ? (
        <>
          <div className="flex-1 min-w-0 bg-main-bg overflow-y-auto relative">
            <div className="pr-[372px]">
              <SkillPage
                selectedSkillId={selectedSkillId}
                onSelectSkill={setSelectedSkillId}
              />
            </div>
          </div>
          <div className="fixed right-3 top-[60px] bottom-14 w-[360px] z-10">
            <BizAgentPanel activeView={activeView} selectedSkillId={selectedSkillId} />
          </div>
        </>
      ) : (
        <main className="flex-1 min-w-0 overflow-hidden bg-main-bg">
          <Dashboard />
        </main>
      )}

      {/* Create Project Modal */}
      {showProjectModal && (
        <ProjectWizard
          onCreateProject={handleCreateProject}
          onCancel={() => setShowProjectModal(false)}
        />
      )}

      {/* Create Task Modal */}
      {showTaskModal && taskProjectId && (
        <TaskWizard
          projectName={projectList.find(p => p.id === taskProjectId)?.name || ''}
          onCreateTask={handleConfirmCreateTask}
          onCancel={() => {
            setShowTaskModal(false);
            setTaskProjectId(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
