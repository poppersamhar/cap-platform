import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, CheckCircle2, Settings, Plus } from 'lucide-react';
import { skills, workLines, agents } from '../data/mockData';

interface SkillChatProps {
  skillId: string;
  onClose: () => void;
}

interface ChatMsg {
  id: string;
  role: 'system' | 'skill' | 'human';
  content: string;
  timestamp: string;
  card?: {
    type: 'result' | 'config';
    title: string;
    data: Record<string, string>;
  };
}

const mockConversations: Record<string, ChatMsg[]> = {
  s1: [
    { id: '1', role: 'system', content: '已进入 SQL执行器 测试模式', timestamp: '10:00' },
    { id: '2', role: 'skill', content: 'SQL执行器已就绪。请提供要执行的 SQL 语句，或描述你的数据需求。', timestamp: '10:00' },
    { id: '3', role: 'human', content: 'SELECT * FROM sales_q3 ORDER BY revenue DESC', timestamp: '10:01' },
    { id: '4', role: 'skill', content: '执行中...', timestamp: '10:01' },
    { id: '5', role: 'skill', content: '查询成功，返回 4 行数据：', timestamp: '10:02', card: { type: 'result', title: '查询结果', data: { '云服务': '3,240万', '企业服务': '2,890万', '消费者业务': '1,560万', '海外市场': '980万' } } },
  ],
  s4: [
    { id: '1', role: 'system', content: '已进入 图表生成 测试模式', timestamp: '10:00' },
    { id: '2', role: 'skill', content: '图表生成 Skill 已就绪。请提供数据和图表类型要求。', timestamp: '10:00' },
  ],
  default: [
    { id: '1', role: 'system', content: '已进入测试模式', timestamp: '10:00' },
    { id: '2', role: 'skill', content: 'Skill 已就绪，请输入测试参数或指令。', timestamp: '10:00' },
  ],
};

export default function SkillChat({ skillId, onClose }: SkillChatProps) {
  const skill = skills.find(s => s.id === skillId);
  const [messages, setMessages] = useState<ChatMsg[]>(mockConversations[skillId] || mockConversations.default);
  const [input, setInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showMount, setShowMount] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [mountedTo, setMountedTo] = useState<Array<{ type: 'workline' | 'agent'; name: string }>>([
    { type: 'workline', name: 'Q3 财报分析' },
    { type: 'agent', name: '知识工程-制度梳理' },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages(mockConversations[skillId] || mockConversations.default);
    const defaults: Record<string, string> = {};
    skill?.configFields.forEach((f, i) => {
      defaults[f] = ['企业数据仓库', '30秒', '1024MB', '全量索引', '企业主题', '15s', 'SMTP服务器'][i] || '';
    });
    setConfigValues(defaults);
  }, [skillId, skill]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: ChatMsg = { id: Date.now().toString(), role: 'human', content: input, timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'skill', content: '收到，Skill 正在执行你的指令...', timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }]);
    }, 800);
  };

  if (!skill) return null;

  return (
    <div className="h-full flex flex-col bg-bg border-l border-border">
      {/* Header */}
      <div className="h-[52px] bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{skill.icon}</span>
          <div>
            <div className="text-sm font-semibold text-text tracking-tight">{skill.name}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              {skill.enabled ? <CheckCircle2 className="w-3 h-3 text-success" strokeWidth={1.8} /> : <span className="w-2 h-2 rounded-full bg-text-muted" />}
              {skill.enabled ? '已启用' : '已停用'} · {skill.source}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowConfig(!showConfig); setShowMount(false); }}
            className={`p-1.5 rounded-xl transition-colors ${showConfig ? 'bg-primary-subtle text-primary-dark' : 'hover:bg-bg text-text-muted'}`}
            title="配置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowMount(!showMount); setShowConfig(false); }}
            className={`p-1.5 rounded-xl transition-colors ${showMount ? 'bg-primary-subtle text-primary-dark' : 'hover:bg-bg text-text-muted'}`}
            title="挂载管理"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-bg rounded-xl transition-colors text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta Info */}
      <div className="bg-surface/60 border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-5 text-[11px] text-text-muted">
          <span>版本：<span className="text-text-secondary font-medium">{skill.version}</span></span>
          <span>创建：<span className="text-text-secondary font-medium">{skill.createdAt}</span></span>
          <span>作者：<span className="text-text-secondary font-medium">{skill.author}</span></span>
          <span>适用范围：<span className="text-text-secondary font-medium">{skill.scopeCount} 个项目/实例</span></span>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="bg-surface border-b border-border p-4 shrink-0 animate-fade-in">
          <h4 className="text-xs font-semibold text-text mb-3 tracking-tight">Skill 配置</h4>
          <div className="space-y-2.5">
            {skill.configFields.map((field) => (
              <div key={field} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary font-medium">{field}</span>
                <input
                  type="text"
                  value={configValues[field] || ''}
                  onChange={(e) => setConfigValues(prev => ({ ...prev, [field]: e.target.value }))}
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-xs w-44 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all"
                />
              </div>
            ))}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button className="text-[11px] text-text-muted hover:text-text transition-colors font-medium">重置</button>
              <button className="text-[11px] bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm shadow-primary/20">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Mount Panel */}
      {showMount && (
        <div className="bg-surface border-b border-border p-4 shrink-0 animate-fade-in">
          <h4 className="text-xs font-semibold text-text mb-3 tracking-tight">挂载管理</h4>
          <div className="space-y-1.5 mb-3">
            {mountedTo.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-bg rounded-xl px-3 py-2 border border-border-light">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted font-medium">{m.type === 'workline' ? '项目' : '实例'}</span>
                  <span className="text-text font-medium">{m.name}</span>
                </div>
                <button
                  onClick={() => setMountedTo(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-[10px] text-danger hover:text-danger/80 transition-colors font-medium"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-primary/30">
              <option>选择项目或实例...</option>
              {workLines.map(wl => <option key={wl.id}>{wl.name}</option>)}
              {agents.map(a => <option key={a.id}>{a.name}</option>)}
            </select>
            <button className="text-xs bg-primary text-white px-3.5 py-2 rounded-xl hover:bg-primary-dark transition-colors font-medium shadow-sm shadow-primary/20">
              挂载
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 animate-slide-in ${msg.role === 'human' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
              msg.role === 'skill' ? 'bg-skill-subtle text-skill' :
              msg.role === 'human' ? 'bg-primary-subtle text-primary-dark' : 'bg-bg'
            }`}>
              {msg.role === 'skill' ? '🔧' : msg.role === 'human' ? '👤' : '🔔'}
            </div>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs border ${
              msg.role === 'skill' ? 'bg-skill-subtle border-skill/10' :
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
            placeholder={`测试 ${skill.name}...`}
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
  );
}
