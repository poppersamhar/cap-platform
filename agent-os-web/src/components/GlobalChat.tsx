import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, AtSign, ArrowRight } from 'lucide-react';

interface ChatMsg {
  id: string;
  role: 'system' | 'assistant' | 'human';
  senderName: string;
  avatar: string;
  content: string;
  timestamp: string;
  cards?: Array<{
    type: 'delegation' | 'skill' | 'agent';
    title: string;
    desc: string;
    meta?: string;
    action?: string;
  }>;
}

const initialMessages: ChatMsg[] = [
  {
    id: 'd1',
    role: 'system',
    senderName: '系统',
    avatar: '🔔',
    content: 'BizAgent已就绪',
    timestamp: '09:00',
  },
  {
    id: 'd2',
    role: 'assistant',
    senderName: 'BizAgent',
    avatar: '👑',
    content: '你好 samhar，我是你的个人管理助手。我可以帮你：\n• 任务委派与 Skill 覆盖检查\n• 执行跟踪与进度查看\n• 任务结果审核与 Skill 沉淀\n• 能力教学与 Skill 形成\n\n请描述你想完成的任务目标、约束和优先级，我将为你生成结构化委派草案。',
    timestamp: '09:00',
  },
  {
    id: 'd3',
    role: 'human',
    senderName: 'samhar',
    avatar: '👤',
    content: '帮我分析 Q3 各业务线的营收对比，并检查是否有合适的数字员工和 Skill 覆盖',
    timestamp: '09:05',
  },
  {
    id: 'd4',
    role: 'assistant',
    senderName: 'BizAgent',
    avatar: '👑',
    content: '已分析你的需求。以下是结构化委派草案：',
    timestamp: '09:05',
    cards: [
      {
        type: 'delegation',
        title: 'Q3 营收对比分析',
        desc: '提取 sales_q3.xlsx 数据，按业务线汇总对比，生成可视化图表',
        meta: '目标：营收对比分析 · 约束：使用已治理数据',
        action: '确认委派 →',
      },
      {
        type: 'agent',
        title: '知识工程-制度梳理',
        desc: '数据提取与结构化',
        meta: '在线 · 已挂载 SQL执行器、企业搜索',
      },
      {
        type: 'skill',
        title: 'SQL执行器 + 图表生成',
        desc: 'Skill 覆盖充足，可直接委派',
        meta: '2/2 Skill 已覆盖',
      },
    ],
  },
];

function renderMentions(text: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="inline-flex items-center gap-0.5 bg-primary-subtle text-primary px-1.5 py-0.5 rounded-md font-semibold text-xs">
          <AtSign className="w-3 h-3" />
          {part.slice(1)}
        </span>
      );
    }
    return part;
  });
}

export default function GlobalChat() {
  const [messages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState('');
  const [showMention, setShowMention] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Chat Header */}
      <div className="h-[52px] bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-agent-host/10 rounded-xl flex items-center justify-center text-sm">👑</div>
          <div>
            <h2 className="font-semibold text-text text-sm tracking-tight">BizAgent</h2>
            <p className="text-[11px] text-text-muted">个人管理助手 · 任务委派与审核</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium">委派模式</span>
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3 animate-slide-in">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
              msg.role === 'assistant' ? 'bg-agent-host/10' :
              msg.role === 'human' ? 'bg-primary-subtle' : 'bg-bg'
            }`}>
              {msg.avatar}
            </div>
            <div className="max-w-[85%]">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold ${
                  msg.role === 'assistant' ? 'text-agent-host' : msg.role === 'human' ? 'text-primary-dark' : 'text-text-muted'
                }`}>
                  {msg.senderName}
                </span>
                <span className="text-[11px] text-text-muted">{msg.timestamp}</span>
              </div>
              <div className={`rounded-2xl px-4 py-3 text-sm border ${
                msg.role === 'assistant' ? 'bg-agent-host-subtle border-agent-host/10' :
                msg.role === 'human' ? 'bg-primary-subtle border-primary/10' :
                'bg-bg border-border'
              }`}>
                <div className="text-text whitespace-pre-wrap leading-relaxed">{renderMentions(msg.content)}</div>

                {/* Cards */}
                {msg.cards && (
                  <div className="grid grid-cols-1 gap-2.5 mt-4">
                    {msg.cards.map((card, i) => (
                      <div
                        key={i}
                        className="bg-white/80 border border-border rounded-xl p-3.5 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {card.type === 'delegation' && <span className="text-sm">🎯</span>}
                          {card.type === 'agent' && <span className="text-sm">🤖</span>}
                          {card.type === 'skill' && <span className="text-sm">🔧</span>}
                          <span className="text-sm font-semibold text-text tracking-tight">{card.title}</span>
                        </div>
                        <p className="text-xs text-text-secondary mb-2.5 leading-relaxed">{card.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-text-muted">{card.meta}</span>
                          {card.action && (
                            <span className="text-[11px] text-primary font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {card.action} <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-surface/80 backdrop-blur-md border-t border-border p-4 shrink-0">
        <div className="relative">
          <div className="flex items-end gap-2 bg-bg border border-border rounded-2xl px-4 py-3 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/5 transition-all">
            <button className="p-1.5 hover:bg-border-light rounded-xl transition-colors shrink-0">
              <Paperclip className="w-[18px] h-[18px] text-text-muted" strokeWidth={1.8} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
                if (e.key === '@') setShowMention(true);
              }}
              placeholder="描述任务目标、约束和优先级..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm text-text max-h-32 py-1.5 leading-relaxed"
              style={{ minHeight: '24px' }}
            />
            <button className="p-1.5 hover:bg-border-light rounded-xl transition-colors shrink-0" onClick={() => setShowMention(!showMention)}>
              <AtSign className="w-[18px] h-[18px] text-text-muted" strokeWidth={1.8} />
            </button>
            <button
              onClick={handleSend}
              className="p-2 bg-primary hover:bg-primary-dark text-white rounded-xl transition-colors shrink-0 shadow-sm shadow-primary/20"
            >
              <Send className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>

          {showMention && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface border border-border rounded-2xl shadow-lg overflow-hidden animate-fade-in">
              <div className="px-3 py-2 text-xs font-semibold text-text-muted border-b border-border-light">快速选择</div>
              {[
                { name: '知识工程-制度梳理', type: '数字员工', icon: '📚' },
                { name: '数据治理-质量检查', type: '数字员工', icon: '🛡️' },
                { name: '智能分析-营收分析', type: '数字员工', icon: '📊' },
                { name: 'SQL执行器', type: 'Skill', icon: '🗄️' },
                { name: '图表生成', type: 'Skill', icon: '📈' },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => { setInput(input + '@' + item.name + ' '); setShowMention(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-bg transition-colors text-left"
                >
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-sm text-text font-medium">{item.name}</div>
                    <div className="text-xs text-text-muted">{item.type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="text-[11px] text-text-muted">按 Enter 发送，Shift + Enter 换行</div>
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1"><AtSign className="w-3 h-3" /> @ 召唤数字员工</span>
          </div>
        </div>
      </div>
    </div>
  );
}
