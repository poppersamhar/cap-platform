import { useState } from 'react';
import { Plus, X, Bot, BookOpen, Shield, Code } from 'lucide-react';
import type { Agent } from '../data/mockData';
import { skills as allSkills } from '../data/mockData';

const agentIconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  knowledge: BookOpen,
  governance: Shield,
  analysis: BookOpen,
  code: Code,
};

interface AgentPageProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onCreateAgent?: (agent: Agent) => void;
}

export default function AgentPage({ agents, selectedAgentId, onSelectAgent, onCreateAgent }: AgentPageProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  const domainLabels: Record<string, { label: string; bg: string; text: string }> = {
    knowledge: { label: '知识工程', bg: 'bg-agent-host-subtle', text: 'text-agent-host' },
    governance: { label: '数据治理', bg: 'bg-success-subtle', text: 'text-success' },
    analysis: { label: '智能分析', bg: 'bg-info-subtle', text: 'text-info' },
    code: { label: '代码助手', bg: 'bg-warning-subtle', text: 'text-warning' },
  };

  const skillIconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    's1': Bot, 's2': Bot, 's3': Bot, 's4': Bot,
    's5': Bot, 's6': Bot, 's7': Bot, 's8': Bot,
  };

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleConfirm = () => {
    if (!name.trim() || !onCreateAgent) return;
    const newAgent: Agent = {
      id: `a${Date.now()}`,
      name: name.trim(),
      avatar: '🤖',
      domain: 'knowledge',
      description: '由用户创建的数字员工',
      status: 'online',
      calls: 0,
      mountedSkills: selectedSkillIds,
      workLine: '未分配',
      currentTask: '等待调度',
      recentOutputs: [],
    };
    onCreateAgent(newAgent);
    setShowModal(false);
    setName('');
    setSelectedSkillIds([]);
  };

  const handleClose = () => {
    setShowModal(false);
    setName('');
    setSelectedSkillIds([]);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <h1 className="text-xl font-semibold text-text tracking-tight mb-6">数字员工</h1>

        {/* Agent Grid */}
        <div className="grid grid-cols-3 gap-3">
          {agents.map((agent) => {
            const domain = domainLabels[agent.domain];
            const isSelected = selectedAgentId === agent.id;
            const IconComponent = agentIconMap[agent.domain] || Bot;
            return (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                className={`bg-surface border rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-primary/30 shadow-md shadow-primary/5 ring-1 ring-primary/10'
                    : 'border-border hover:border-primary/20 hover:shadow-sm'
                }`}
              >
                {/* Top row: Avatar + Name + Status + Tag */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-bg border border-border rounded-full flex items-center justify-center shrink-0">
                      <IconComponent className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-text text-xs tracking-tight">{agent.name}</h3>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            agent.status === 'online'
                              ? 'bg-success'
                              : agent.status === 'busy'
                                ? 'bg-warning'
                                : 'bg-text-muted'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-[2px] rounded-full font-semibold ${domain.bg} ${domain.text}`}>
                    {domain.label}
                  </span>
                </div>

                {/* Properties list */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">已挂载 Skills</span>
                    <span className="text-text">{agent.mountedSkills.length} skills</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">调用次数</span>
                    <span className="text-text">{agent.calls.toLocaleString()} 次</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-text-muted leading-relaxed">{agent.description}</p>
              </div>
            );
          })}

          {/* Create new agent card */}
          <div
            onClick={() => setShowModal(true)}
            className="bg-surface border border-dashed border-border rounded-2xl p-4 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[180px] hover:border-primary/40 hover:shadow-sm group"
          >
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-3 group-hover:border-primary/40 transition-colors">
              <Plus className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" strokeWidth={1.8} />
            </div>
            <span className="text-xs text-text-muted group-hover:text-text transition-colors">新增数字员工</span>
          </div>
        </div>
      </div>

      {/* Create Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface rounded-2xl shadow-xl w-[420px] max-w-[90vw] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-dark" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-semibold text-text text-sm">新建数字员工</h3>
                  <p className="text-[11px] text-text-muted">输入名称并选择 Skills 即可创建</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-bg rounded-lg transition-colors text-text-muted"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-5 space-y-4">
              {/* Name input */}
              <div>
                <label className="block text-xs font-medium text-text mb-1.5">员工名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：智能客服"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/5 transition-all"
                />
              </div>

              {/* Skills selection */}
              <div>
                <label className="block text-xs font-medium text-text mb-1.5">
                  添加 Skills <span className="text-text-muted font-normal">（{selectedSkillIds.length} 个已选）</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {allSkills.map((skill) => {
                    const SkillIcon = skillIconMap[skill.id] || Bot;
                    return (
                      <button
                        key={skill.id}
                        onClick={() => handleToggleSkill(skill.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                          selectedSkillIds.includes(skill.id)
                            ? 'border-primary/30 bg-primary-subtle'
                            : 'border-border hover:border-primary/20 hover:bg-bg'
                        }`}
                      >
                        <SkillIcon className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.5} />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-text truncate">{skill.name}</div>
                          <div className="text-[10px] text-text-muted truncate">{skill.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-primary/20"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
