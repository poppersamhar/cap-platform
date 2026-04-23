import { useState, useEffect, useRef } from 'react';
import {
  Send, BrainCircuit, Sparkles, Bot, Wrench, AtSign, CheckCircle2,
  Database, Terminal, Search, BarChart3, MessageSquare,
  ClipboardList, Mail, FileText,
} from 'lucide-react';
import { skills } from '../data/mockData';
import type { Agent, Skill } from '../data/mockData';

const skillIconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  's1': Database, 's2': Terminal, 's3': Search, 's4': BarChart3,
  's5': MessageSquare, 's6': ClipboardList, 's7': Mail, 's8': FileText,
};

interface BizAgentPanelProps {
  activeView: string;
  selectedAgentId?: string | null;
  selectedSkillId?: string | null;
  agents?: Agent[];
}

/* ─── Skill 详情子组件 ─── */
function SkillDetailPanel({ skill }: { skill: Skill }) {
  const categoryLabels: Record<string, string> = {
    knowledge: '知识工程',
    governance: '数据治理',
    analysis: '分析',
    tool: '通用工具',
  };
  const SkillIcon = skillIconMap[skill.id] || FileText;

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 animate-fade-in">
      {/* Name */}
      <div className="flex items-center gap-2 mb-2">
        <SkillIcon className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-text">{skill.name}</span>
        <span className={`text-[10px] px-2 py-[2px] rounded-full font-medium ${skill.enabled ? 'bg-success-subtle text-success' : 'bg-text-muted/10 text-text-muted'}`}>
          {skill.enabled ? '已启用' : '已停用'}
        </span>
      </div>

      {/* Overview */}
      <p className="text-xs text-text-secondary leading-relaxed mb-3">{skill.description}</p>

      {/* Meta tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[10px] bg-bg text-text-muted px-2 py-[2px] rounded-md border border-border-light">{skill.source}</span>
        <span className="text-[10px] bg-bg text-text-muted px-2 py-[2px] rounded-md border border-border-light">{skill.version}</span>
        <span className="text-[10px] bg-bg text-text-muted px-2 py-[2px] rounded-md border border-border-light">{skill.author}</span>
        <span className="text-[10px] bg-bg text-text-muted px-2 py-[2px] rounded-md border border-border-light">{skill.scopeCount} 个项目</span>
        <span className="text-[10px] bg-bg text-text-muted px-2 py-[2px] rounded-md border border-border-light">{categoryLabels[skill.category]}</span>
      </div>

      {/* Divider */}
      <div className="border-t border-border-light my-3" />

      {/* Steps Timeline */}
      <div className="text-xs font-medium text-text mb-2">执行步骤</div>
      <div className="space-y-0">
        {skill.steps && skill.steps.length > 0 ? (
          skill.steps.map((step, idx) => (
            <div key={step.order} className="flex gap-3">
              {/* Timeline: circle + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-5 h-5 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary-subtle">
                  <span className="text-[9px] font-bold text-primary-dark">{step.order}</span>
                </div>
                {idx < skill.steps!.length - 1 && (
                  <div className="w-px flex-1 bg-border-light min-h-[16px] my-0.5" />
                )}
              </div>
              {/* Step content */}
              <div className="pb-3">
                <div className="text-xs font-medium text-text leading-5">{step.name}</div>
                <div className="text-[11px] text-text-muted leading-relaxed">{step.description}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-text-muted">
            <CheckCircle2 className="w-6 h-6 mb-1 opacity-30" strokeWidth={1.5} />
            <p className="text-[11px]">暂无执行步骤说明</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 主组件 ─── */
export default function BizAgentPanel({ activeView, selectedAgentId, selectedSkillId, agents = [] }: BizAgentPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ text: string; isUser: boolean }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
  const selectedSkill = selectedSkillId ? skills.find(s => s.id === selectedSkillId) : null;

  // 选中 Agent 时自动填入 @mention
  useEffect(() => {
    if (selectedAgent && activeView === 'agent') {
      const mention = `@${selectedAgent.name} `;
      setInput(mention);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = mention.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
    }
  }, [selectedAgentId, activeView]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { text: input, isUser: true }]);
    setInput('');
  };

  // 输入框 placeholder 根据上下文变化
  const getPlaceholder = () => {
    if (activeView === 'agent' && selectedAgent) return `输入针对 @${selectedAgent.name} 的指令...`;
    if (activeView === 'skill' && selectedSkill) return `输入针对 ${selectedSkill.name} 的指令...`;
    return '问我任何问题...';
  };

  return (
    <div className="h-full flex flex-col rounded-3xl bg-white/70 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="h-[52px] flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="w-4.5 h-4.5 text-primary-dark" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="font-semibold text-text text-sm tracking-tight">BizAgent</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
              自管理运行中
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 relative">
        {/* ── Home 视图 ── */}
        {activeView === 'home' && messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <Sparkles className="w-10 h-10 text-primary/30 mb-4" strokeWidth={1.2} />
            <h3 className="text-base font-semibold text-text tracking-tight mb-2">
              让我们一起高效协作
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[220px]">
              你可以问我任何问题——我可以帮你查找 Agent、Skill 或项目
            </p>
          </div>
        )}

        {activeView === 'home' && messages.length > 0 && (
          <div className="space-y-3 pt-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-xs max-w-[85%] ${
                  msg.isUser
                    ? 'bg-primary-subtle text-primary-dark rounded-tr-sm'
                    : 'bg-bg text-text-secondary rounded-tl-sm border border-border-light'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Agent 视图 ── */}
        {activeView === 'agent' && !selectedAgent && messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <Bot className="w-10 h-10 text-primary/30 mb-4" strokeWidth={1.2} />
            <h3 className="text-base font-semibold text-text tracking-tight mb-2">
              选择数字员工
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[220px]">
              点击左侧卡片，即可@该员工并发送指令
            </p>
          </div>
        )}

        {/* Agent 对话模式（选中 Agent 后） */}
        {activeView === 'agent' && selectedAgent && (
          <div className="space-y-3 pt-2">
            {/* @提示 */}
            {messages.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
                <AtSign className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
                <span>已选中 <span className="text-text font-medium">{selectedAgent.name}</span>，直接输入指令即可</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-xs max-w-[85%] ${
                  msg.isUser
                    ? 'bg-primary-subtle text-primary-dark rounded-tr-sm'
                    : 'bg-bg text-text-secondary rounded-tl-sm border border-border-light'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Skill 视图 ── */}
        {activeView === 'skill' && !selectedSkill && messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <Wrench className="w-10 h-10 text-primary/30 mb-4" strokeWidth={1.2} />
            <h3 className="text-base font-semibold text-text tracking-tight mb-2">
              选择 Skill
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[220px]">
              点击左侧卡片查看详情与执行步骤
            </p>
          </div>
        )}

        {activeView === 'skill' && selectedSkill && (
          <SkillDetailPanel skill={selectedSkill} />
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0">
        <div className="flex items-end gap-2 bg-white/60 rounded-xl px-3 py-2 shadow-sm focus-within:border-primary/20 focus-within:ring-2 focus-within:ring-primary/5 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={getPlaceholder()}
            rows={1}
            className="bizagent-textarea flex-1 bg-transparent resize-none outline-none text-xs text-text py-1"
            style={{ minHeight: '20px' }}
          />
          <button
            onClick={handleSend}
            className="p-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors shrink-0 shadow-sm shadow-primary/20"
          >
            <Send className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
