import { useState } from 'react';
import {
  Database, Network, Shield,
  CheckCircle2, Circle, Loader2, Terminal, ArrowRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { taskFlow, auditLogs } from '../data/mockData';

interface RightPanelProps {
  activeView: string;
  activeProjectId: string | null;
}

type BottomTabKey = 'data' | 'graph' | 'audit';

const bottomTabs: { key: BottomTabKey; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { key: 'data', label: '数据', icon: Database },
  { key: 'graph', label: '图谱', icon: Network },
  { key: 'audit', label: '审计', icon: Shield },
];

// 横向任务流组件
function TaskFlowHorizontal() {
  return (
    <div className="h-full flex flex-col px-4 py-2.5">
      <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 shrink-0">任务工作流</h3>
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="flex items-center gap-1.5 w-full overflow-x-auto pb-1">
          {taskFlow.map((step, i) => {
            const isLast = i === taskFlow.length - 1;
            return (
              <div key={i} className="flex items-center gap-1.5 shrink-0">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 ${
                    step.status === 'completed'
                      ? 'bg-success-subtle border-success text-success'
                      : step.status === 'in-progress'
                      ? 'bg-warning-subtle border-warning text-warning'
                      : 'bg-bg border-border text-text-muted'
                  }`}>
                    {step.status === 'completed' && <CheckCircle2 className="w-4 h-4" strokeWidth={2} />}
                    {step.status === 'in-progress' && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
                    {step.status === 'pending' && <Circle className="w-4 h-4" strokeWidth={2} />}
                  </div>
                  <span className={`text-[11px] font-medium text-center leading-tight ${
                    step.status === 'completed' ? 'text-success' :
                    step.status === 'in-progress' ? 'text-warning' : 'text-text-muted'
                  }`}>
                    {step.name}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 text-center leading-tight">{step.agent}</span>
                </div>
                {!isLast && (
                  <div className="flex flex-col items-center px-0.5">
                    <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${
                      step.status === 'completed' ? 'text-success/40' : 'text-border'
                    }`} strokeWidth={1.5} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 数据 Tab：上传文件 + 产出
function DataPanel() {
  return (
    <div className="h-full flex flex-col px-4 py-3 overflow-y-auto">
      {/* 上传文件 */}
      <div className="mb-3">
        <h4 className="text-[11px] font-semibold text-text-muted mb-2">上传文件</h4>
        <div className="space-y-1.5">
          {[
            { name: 'sales_q3.xlsx', size: '2.3MB' },
            { name: 'region_data.csv', size: '856KB' },
            { name: 'budget_notes.md', size: '12KB' },
          ].map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] text-primary font-medium">{f.name.split('.').pop()?.toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-text truncate">{f.name}</div>
                <div className="text-[10px] text-text-muted">{f.size}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border-light my-2" />

      {/* 产出 */}
      <div className="flex-1">
        <h4 className="text-[11px] font-semibold text-text-muted mb-2">产出</h4>
        <div className="space-y-1.5">
          {[
            { name: 'Q3营收对比图.png', size: '1.2MB' },
            { name: '分析报告.pdf', size: '3.5MB' },
            { name: '趋势数据.xlsx', size: '1.8MB' },
          ].map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] text-success font-medium">{f.name.split('.').pop()?.toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-text truncate">{f.name}</div>
                <div className="text-[10px] text-text-muted">{f.size}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 图谱 Tab：项目维度关系
function GraphPanel() {
  return (
    <div className="h-full flex flex-col px-4 py-3 overflow-y-auto">
      <h4 className="text-[11px] font-semibold text-text-muted mb-2">项目关系图谱</h4>
      <div className="space-y-2">
        <div className="bg-bg border border-border rounded-xl p-3">
          <div className="text-xs font-medium text-text mb-1">中心节点</div>
          <div className="text-[11px] text-text-secondary">Q3 财报分析</div>
        </div>
        <div className="bg-bg border border-border rounded-xl p-3">
          <div className="text-xs font-medium text-text mb-1.5">关联 Agent</div>
          <div className="flex flex-wrap gap-1.5">
            {['知识工程', '数据治理', '图表生成'].map((a) => (
              <span key={a} className="text-[11px] px-2 py-0.5 bg-agent-host-subtle text-agent-host rounded-md">{a}</span>
            ))}
          </div>
        </div>
        <div className="bg-bg border border-border rounded-xl p-3">
          <div className="text-xs font-medium text-text mb-1.5">关联 Skill</div>
          <div className="flex flex-wrap gap-1.5">
            {['SQL执行器', '企业搜索', 'PDF解析'].map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 bg-skill-subtle text-skill rounded-md">{s}</span>
            ))}
          </div>
        </div>
        <div className="bg-bg border border-border rounded-xl p-3">
          <div className="text-xs font-medium text-text mb-1.5">关键洞察</div>
          <div className="space-y-1 text-[11px] text-text-secondary">
            <div>• 营收对比分析</div>
            <div>• 消费者业务下滑 5%</div>
            <div>• 海外市场增长 34%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 审计日志面板
function AuditPanel() {
  return (
    <div className="h-full flex flex-col px-4 py-3 overflow-y-auto">
      <h4 className="text-[11px] font-semibold text-text-muted mb-2">审计日志</h4>
      <div className="space-y-2">
        {auditLogs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <Terminal className="w-3 h-3 text-text-muted shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <div className="text-text-muted">{log.time}</div>
              <div className="text-text-secondary leading-relaxed">{log.event}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RightPanel({ activeView, activeProjectId }: RightPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTabKey>('data');

  const isProjectView = activeView === 'project' && activeProjectId;
  if (!isProjectView) return null;

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        className="h-full w-8 flex flex-col items-center py-4 bg-surface/80 backdrop-blur-md border-l border-border cursor-pointer hover:bg-surface transition-colors shrink-0"
      >
        <ChevronLeft className="w-4 h-4 text-text-muted mb-2" strokeWidth={1.5} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-text-muted [writing-mode:vertical-lr] tracking-widest">任务面板</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-56 flex flex-col bg-surface/80 backdrop-blur-md border-l border-border shrink-0">
      {/* 折叠按钮 */}
      <div className="flex items-center justify-end px-2 py-1.5 border-b border-border shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-bg rounded-md transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
        </button>
      </div>

      {/* 上半部分：横向任务流 */}
      <div className="h-[28%] shrink-0 border-b border-border">
        <TaskFlowHorizontal />
      </div>

      {/* 下半部分：选项卡切换 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-border shrink-0 bg-surface/50">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setBottomTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium border-b-2 transition-all duration-200 ${
                  bottomTab === tab.key
                    ? 'border-primary text-primary-dark'
                    : 'border-transparent text-text-secondary hover:text-text'
                }`}
              >
                <Icon className="w-3 h-3" strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {bottomTab === 'data' && <DataPanel />}
          {bottomTab === 'graph' && <GraphPanel />}
          {bottomTab === 'audit' && <AuditPanel />}
        </div>
      </div>
    </div>
  );
}
