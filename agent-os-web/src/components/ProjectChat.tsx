import { useState, useRef, useEffect } from 'react';
import { Send, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { workLines } from '../data/mockData';
import type { ChatMessage } from '../data/mockData';

interface ProjectChatProps {
  chatId: string;
}

function UserAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const colors: Record<string, string> = {
    s: 'bg-emerald-500',
    b: 'bg-blue-500',
    a: 'bg-amber-500',
    k: 'bg-rose-500',
  };
  const bg = colors[initial.toLowerCase()] || 'bg-gray-400';
  return (
    <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center text-white text-[11px] font-semibold shrink-0`}>
      {initial}
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-xl bg-black flex items-center justify-center text-white text-[10px] font-bold shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isHuman = msg.role === 'human';
  const isHost = msg.role === 'host';

  return (
    <div className={`flex gap-3 ${isHuman ? 'flex-row-reverse' : ''}`}>
      {isHost && <BotAvatar />}
      {isHuman && <UserAvatar name={msg.senderName} />}
      {!isHost && !isHuman && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] shrink-0">
          {msg.senderName.charAt(0)}
        </div>
      )}

      <div className={`max-w-[75%] ${isHuman ? 'items-end' : 'items-start'}`}>
        {!isHuman && (
          <div className="text-[11px] text-text-muted mb-0.5 ml-0.5">{msg.senderName}</div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
          isHuman
            ? 'bg-gray-100 text-text rounded-tr-sm'
            : 'bg-white text-text border border-border/60 rounded-tl-sm shadow-sm'
        }`}>
          {msg.content}
        </div>
        {isHuman && (
          <div className="flex items-center gap-2 mt-1 mr-1">
            <span className="text-[10px] text-text-muted/60">{msg.timestamp}</span>
            <button className="text-[10px] text-text-muted/50 hover:text-text-muted transition-colors">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectChat({ chatId }: ProjectChatProps) {
  let chatMessages: ChatMessage[] = [];
  let chatName = '';
  for (const project of workLines) {
    const chat = project.chats.find(c => c.id === chatId);
    if (chat) {
      chatMessages = chat.messages;
      chatName = chat.name;
      break;
    }
  }
  const [messages] = useState<ChatMessage[]>(chatMessages);
  const [input, setInput] = useState('');
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    setInput('');
  };

  if (!chatName) return <div className="flex items-center justify-center h-full text-text-muted text-sm">对话不存在</div>;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-gray-100">
        <h1 className="text-[15px] font-semibold text-text tracking-tight">{chatName}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <div className="flex -space-x-1.5">
              {['S', 'B', 'A', 'K'].map((letter, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white ${
                    i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-blue-500' : i === 2 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                >
                  {letter}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-text-muted ml-2">5 members</span>
          </div>
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-text-muted"
          >
            {rightCollapsed ? <PanelRightOpen className="w-4 h-4" strokeWidth={1.5} /> : <PanelRightClose className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="text-[11px] text-text-muted/50 bg-gray-50 rounded-full px-3 py-1">No more messages</span>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <span className="text-[11px] text-text-muted/40">Today</span>
            </div>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-5 pb-4 pt-2">
        <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3 focus-within:border-gray-200 focus-within:ring-1 focus-within:ring-gray-100 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message... (@ to mention or reference files)"
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-[13px] text-text placeholder:text-text-muted/50 max-h-32 leading-relaxed"
            style={{ minHeight: '20px' }}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors text-text-muted">
                <span className="text-sm leading-none">+</span>
              </button>
              <button className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>project</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted/60">Default Permission</span>
              <button
                onClick={handleSend}
                className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-text rounded-full transition-colors"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
