import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, CheckCircle2, MinusCircle, XCircle, Wrench, History, MessageSquare } from 'lucide-react';
import { agents, skills } from '../data/mockData';

interface AgentChatProps {
  agentId: string;
  onClose: () => void;
}

interface ChatMsg {
  id: string;
  role: 'system' | 'agent' | 'human';
  content: string;
  timestamp: string;
  card?: {
    type: 'result' | 'config';
    title: string;
    data: Record<string, string>;
  };
}

const mockConversations: Record<string, ChatMsg[]> = {
  a1: [
    { id: '1', role: 'system', content: '已进入 知识工程-制度梳理 聚焦视图', timestamp: '10:00' },
    { id: '2', role: 'agent', content: '你好 samhar，我是知识工程智能体。我可以帮你将企业制度、SOP、口径说明转化为结构化知识资产。当前任务：提取 sales_q3.xlsx 关键指标', timestamp: '10:00' },
    { id: '3', role: 'human', content: '这个季度消费者业务下滑了，帮我梳理一下相关的业务口径定义', timestamp: '10:01' },
    { id: '4', role: 'agent', content: '正在梳理消费者业务的口径定义...', timestamp: '10:01' },
    { id: '5', role: 'agent', content: '梳理完成，已更新消费者业务口径定义：', timestamp: '10:02', card: { type: 'result', title: '消费者业务口径定义', data: { '收入口径': '含直营+经销+线上', '成本口径': '含COGS+物流+售后', '统计周期': '自然月', '责任部门': '消费者BG' } } },
  ],
  a3: [
    { id: '1', role: 'system', content: '已进入 智能分析-营收分析 聚焦视图', timestamp: '10:00' },
    { id: '2', role: 'agent', content: '你好，我是智能分析智能体。当前正在执行：生成 Q3 各业务线对比图表。状态：忙碌中。', timestamp: '10:00' },
  ],
  default: [
    { id: '1', role: 'system', content: '已进入聚焦视图', timestamp: '10:00' },
    { id: '2', role: 'agent', content: '你好，有什么可以帮你的？', timestamp: '10:00' },
  ],
};

export default function AgentChat({ agentId, onClose }: AgentChatProps) {
  const agent = agents.find(a => a.id === agentId);
  const [messages, setMessages] = useState<ChatMsg[]>(mockConversations[agentId] || mockConversations.default);
  const [input, setInput] = useState('');
  const [activeSection, setActiveSection] = useState<'chat' | 'skills' | 'outputs'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages(mockConversations[agentId] || mockConversations.default);
  }, [agentId]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: ChatMsg = { id: Date.now().toString(), role: 'human', content: input, timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', content: '收到，我正在处理你的请求...', timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }]);
    }, 800);
  };

  if (!agent) return null;

  const statusIcon = agent.status === 'online' ? <CheckCircle2 className="w-3 h-3 text-success" strokeWidth={1.8} /> : agent.status === 'busy' ? <MinusCircle className="w-3 h-3 text-warning" strokeWidth={1.8} /> : <XCircle className="w-3 h-3 text-text-muted" strokeWidth={1.8} />;
  const mountedSkillDetails = skills.filter(s => agent.mountedSkills.includes(s.id));

  return (
    <div className="h-full flex flex-col bg-bg border-l border-border">
      {/* Header */}
      <div className="h-[52px] bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{agent.avatar}</span>
          <div>
            <div className="text-sm font-semibold text-text tracking-tight">{agent.name}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              {statusIcon}
              {agent.status === 'online' ? '在线' : agent.status === 'busy' ? '忙碌' : '离线'} · {agent.workLine} · {agent.calls.toLocaleString()} 次调用
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-bg rounded-xl transition-colors text-text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center border-b border-border shrink-0 bg-surface/50">
        {[
          { key: 'chat' as const, label: '单聊测试', icon: MessageSquare },
          { key: 'skills' as const, label: '已挂载 Skill', icon: Wrench },
          { key: 'outputs' as const, label: '历史产出', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all duration-200 ${
                activeSection === tab.key
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeSection === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Current Task Info */}
            {agent.currentTask && agent.currentTask !== '等待调度' && agent.currentTask !== '离线' && (
              <div className="bg-surface/80 backdrop-blur-sm border-b border-border p-4 shrink-0">
                <div className="text-[11px] text-text-muted mb-1 font-medium">当前任务</div>
                <div className="text-sm text-text font-semibold tracking-tight">{agent.currentTask}</div>
                {agent.status === 'busy' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-border-light rounded-full h-1.5 overflow-hidden">
                      <div className="bg-warning h-1.5 rounded-full animate-pulse" style={{ width: '65%' }} />
                    </div>
                    <span className="text-[10px] text-text-muted">执行中...</span>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 animate-slide-in ${msg.role === 'human' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    msg.role === 'agent' ? 'bg-agent-normal-subtle text-agent-normal' :
                    msg.role === 'human' ? 'bg-primary-subtle text-primary-dark' : 'bg-bg'
                  }`}>
                    {msg.role === 'agent' ? '🤖' : msg.role === 'human' ? '👤' : '🔔'}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs border ${
                    msg.role === 'agent' ? 'bg-agent-normal-subtle border-agent-normal/10' :
                    msg.role === 'human' ? 'bg-primary-subtle border-primary/10' :
                    'bg-bg border-border text-text-muted'
                  }`}>
                    <div className="text-text whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    {msg.card && (
                      <div className="mt-2.5 bg-white/80 border border-border rounded-xl p-2.5">
                        <div className="text-[10px] font-semibold text-text-muted mb-1.5">{msg.card.title}</div>
                        <div className="space-y-1">
                          {Object.entries(msg.card.data).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between text-[11px]">
                              <span className="text-text-secondary">{k}</span>
                              <span className="font-semibold text-text">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-[10px] text-text-muted mt-1 text-right">{msg.timestamp}</div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-surface/80 backdrop-blur-md border-t border-border p-3 shrink-0">
              <div className="flex items-end gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/5 transition-all">
                <button className="p-1 hover:bg-border-light rounded-lg transition-colors shrink-0">
                  <Paperclip className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.8} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`给 ${agent.name} 发消息...`}
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-xs text-text py-1"
                  style={{ minHeight: '20px' }}
                />
                <button onClick={handleSend} className="p-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors shrink-0 shadow-sm shadow-primary/20">
                  <Send className="w-3 h-3" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'skills' && (
          <div className="h-full overflow-y-auto p-4 space-y-2">
            <div className="text-[11px] text-text-muted mb-2 font-medium">已挂载 {mountedSkillDetails.length} 个 Skill</div>
            {mountedSkillDetails.map((skill) => (
              <div key={skill.id} className="bg-surface border border-border rounded-xl p-4 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{skill.icon}</span>
                    <span className="text-sm font-semibold text-text tracking-tight">{skill.name}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-[3px] rounded-full font-semibold ${skill.enabled ? 'bg-success-subtle text-success' : 'bg-text-muted/10 text-text-muted'}`}>
                    {skill.enabled ? '已启用' : '已停用'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{skill.description}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">来源：{skill.source}</span>
                  <button className="text-[11px] text-danger hover:text-danger/80 transition-colors font-medium">
                    解除挂载
                  </button>
                </div>
              </div>
            ))}
            <button className="w-full py-2.5 border border-dashed border-border rounded-xl text-xs text-text-muted hover:border-primary hover:text-primary transition-colors font-medium">
              + 挂载新 Skill
            </button>
          </div>
        )}

        {activeSection === 'outputs' && (
          <div className="h-full overflow-y-auto p-4 space-y-2">
            <div className="text-[11px] text-text-muted mb-2 font-medium">最近完成的任务</div>
            {agent.recentOutputs.map((output, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-4 transition-all hover:shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text tracking-tight">{output.title}</span>
                  <span className="text-[11px] text-text-muted">{output.completedAt}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-border-light rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-success h-1.5 rounded-full"
                      style={{ width: `${output.quality}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-text-muted font-medium w-8 text-right">{output.quality}分</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
