import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, ArrowUp, BrainCircuit, GripHorizontal, X } from 'lucide-react';

interface Message {
  text: string;
  isUser: boolean;
}

export interface ExcludeRect {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

interface DraggableChatProps {
  projectId: string;
  rectRef?: React.RefObject<ExcludeRect | null>;
}

export default function DraggableChat({ projectId, rectRef }: DraggableChatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const [messages, setMessages] = useState<Message[]>([
    { text: '关于这个项目，你想问什么...', isUser: false },
  ]);
  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);

  // 初始化到容器中心偏下
  useEffect(() => {
    const setCenter = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      setPosition({
        x: Math.max(40, rect.width / 2 - 170),
        y: Math.max(40, rect.height * 0.58),
      });
    };
    setCenter();
    window.addEventListener('resize', setCenter);
    return () => window.removeEventListener('resize', setCenter);
  }, []);

  // 向外报告当前位置和尺寸
  useEffect(() => {
    if (!rectRef?.current) return;
    const el = containerRef.current;
    const h = el ? el.getBoundingClientRect().height : (minimized ? 36 : 280);
    rectRef.current.x = position.x;
    rectRef.current.y = position.y;
    rectRef.current.width = 340;
    rectRef.current.height = h;
    rectRef.current.active = !minimized;
  }, [position, minimized, rectRef]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const parent = containerRef.current?.parentElement;
      const newX = dragStart.current.posX + (e.clientX - dragStart.current.x);
      const newY = dragStart.current.posY + (e.clientY - dragStart.current.y);
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const maxX = rect.width - 340;
        const maxY = rect.height - (minimized ? 40 : 200);
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      } else {
        setPosition({ x: newX, y: newY });
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minimized]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { text: input, isUser: true }]);
    setInput('');
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          text: `已收到关于项目 ${projectId} 的问题，正在为您查询相关数据...`,
          isUser: false,
        },
      ]);
    }, 800);
  };

  if (minimized) {
    return (
      <div
        ref={containerRef}
        className="absolute z-50"
        style={{ left: position.x, top: position.y }}
      >
        <div
          onMouseDown={handleMouseDown}
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-primary/15 cursor-pointer hover:bg-white/95 transition-all ${
            isDragging ? 'scale-105' : ''
          }`}
        >
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
          </div>
          <span className="text-xs font-semibold text-text">BizAgent</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 select-none"
      style={{ left: position.x, top: position.y, width: 340 }}
    >
      <div className="rounded-2xl bg-white/80 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-primary/15 overflow-hidden">
        {/* 拖拽手柄 / Header */}
        <div
          onMouseDown={handleMouseDown}
          className={`flex items-center justify-between px-3 py-2 cursor-move border-b border-border/50 transition-colors ${
            isDragging ? 'bg-primary/5' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
            <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="w-3 h-3 text-primary" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-semibold text-text">BizAgent</span>
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(true);
            }}
            className="p-1 hover:bg-bg rounded-md transition-colors"
          >
            <X className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
          </button>
        </div>

        {/* 消息区 */}
        <div className="px-3 py-2.5 min-h-[72px] max-h-[220px] overflow-y-auto space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-xl px-3 py-1.5 text-xs max-w-[92%] leading-relaxed ${
                  msg.isUser
                    ? 'bg-primary-subtle text-primary-dark rounded-tr-sm'
                    : 'bg-bg text-text-secondary rounded-tl-sm border border-border-light'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* 输入区 */}
        <div className="px-2.5 pb-2.5 pt-1">
          <div className="flex items-center gap-1.5 bg-white/60 rounded-xl px-2.5 py-1.5 shadow-sm border border-border/50 focus-within:border-primary/20 focus-within:ring-1 focus-within:ring-primary/5 transition-all">
            <button className="p-1 text-text-muted hover:text-text transition-colors">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="问我关于项目的任何问题..."
              className="flex-1 bg-transparent outline-none text-xs text-text py-0.5"
            />
            <button
              onClick={handleSend}
              className="p-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors shadow-sm"
            >
              <ArrowUp className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
