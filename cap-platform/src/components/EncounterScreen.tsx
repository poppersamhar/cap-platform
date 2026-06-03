import { useState, useRef, useEffect } from 'react';
import { store, useSession, useLoading } from '../store/Store';
import type { ChatMessage } from '../types';

export function EncounterScreen() {
  const session = useSession();
  const isLoading = useLoading();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  if (!session) {
    store.setScreen('home');
    return null;
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    store.sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const emotion = session.emotion_state;

  return (
    <div className="flex flex-col h-screen bg-cap-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-cap-line bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => store.setScreen('endConfirm')}
            className="text-cap-ink-2 hover:text-cap-ink font-semibold text-lg transition-colors"
          >
            ←
          </button>
          <div>
            <h3 className="font-bold text-sm text-cap-ink">{session.mode === 'training' ? '销售对练' : '用户调研'}</h3>
            <p className="text-xs text-cap-ink-2 font-medium">第 {session.round} 轮</p>
          </div>
        </div>
        <button
          onClick={() => store.setScreen('endConfirm')}
          className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-white border border-cap-line text-cap-ink-2 hover:bg-cap-cream-2 hover:border-cap-ink-soft transition-all"
        >
          结束对话
        </button>
      </div>

      {/* Emotion Bar — 商务仪表盘风格 */}
      <div className="px-6 py-3 border-b border-cap-line bg-cap-cream-2">
        <div className="grid grid-cols-5 gap-4">
          <EmotionItem label="信任度" value={emotion.trust} color="bg-cap-mint" />
          <EmotionItem label="购买意愿" value={emotion.intent} color="bg-cap-peach" />
          <EmotionItem label="好感度" value={emotion.rapport} color="bg-cap-sky" />
          <EmotionItem label="抵触" value={emotion.resistance} color="bg-cap-rose" />
          <EmotionItem label="焦虑" value={emotion.anxiety} color="bg-cap-butter" />
        </div>
        {session.special_state && (
          <div className={`mt-2 text-xs px-3 py-1.5 rounded-md inline-block font-semibold ${
            session.special_state === 'customer_leaving' ? 'bg-cap-rose-soft text-cap-rose-deep border border-cap-rose/20' :
            session.special_state === 'decision_phase' ? 'bg-cap-mint-soft text-cap-mint-deep border border-cap-mint/20' :
            'bg-cap-butter-soft text-cap-butter-deep border border-cap-butter/20'
          }`}>
            {session.special_state === 'customer_leaving' && '⚠️ 客户准备离店'}
            {session.special_state === 'decision_phase' && '✅ 进入决策阶段'}
            {session.special_state === 'confrontation' && '⚠️ 进入对抗模式'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {session.messages.length === 0 && (
          <div className="text-center text-cap-ink-2 py-8 animate-fadein">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cap-cream-2 flex items-center justify-center text-3xl">
              👋
            </div>
            <p className="text-lg font-bold mb-1 text-cap-ink">对话开始</p>
            <p className="text-sm font-medium mb-6">向客户打个招呼，开始你的{session.mode === 'training' ? '销售对练' : '调研访谈'}</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {(session.mode === 'training' ? TRAINING_HINTS : RESEARCH_HINTS).map((hint) => (
                <button
                  key={hint}
                  onClick={() => {
                    setInput(hint);
                    const ta = document.querySelector('textarea');
                    if (ta) ta.focus();
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-cap-line text-cap-ink-2 hover:bg-cap-cream-2 hover:border-cap-ink-soft transition-all"
                >
                  💡 {hint}
                </button>
              ))}
            </div>
          </div>
        )}
        {session.messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-cap-ink-2 text-sm font-medium ml-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-cap-ink-soft animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-cap-ink-soft animate-bounce [animation-delay:0.15s]" />
              <div className="w-2 h-2 rounded-full bg-cap-ink-soft animate-bounce [animation-delay:0.3s]" />
            </div>
            <span className="ml-1">客户思考中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-cap-line bg-white">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session.mode === 'training' ? '输入你的销售话术...' : '输入你的调研问题...'}
            className="flex-1 px-4 py-3 rounded-xl bg-cap-cream border border-cap-line resize-none focus:outline-none focus:border-cap-peach focus:ring-2 focus:ring-cap-peach/10 text-sm min-h-[48px] max-h-[120px] font-medium text-cap-ink"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="btn-plush btn-plush-peach px-6 py-3"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

const TRAINING_HINTS = [
  '您好，请问今天是来看车的吗？',
  '您之前了解过我们品牌吗？',
  '方便问一下您的用车需求吗？',
  '您目前开的是什么车？感觉怎么样？',
];

const RESEARCH_HINTS = [
  '您好，能先简单介绍一下您的用车情况吗？',
  '您目前开的是什么车？体验如何？',
  '如果换车，您最看重哪些方面？',
  '您一般会在什么场景下用车？',
];

function EmotionItem({ label, value, color }: { label: string; value: number; color: string }) {
  const [prevValue, setPrevValue] = useState(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (value !== prevValue) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 800);
      setPrevValue(value);
      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  const delta = value - prevValue;
  const deltaColor = delta > 0 ? 'text-cap-mint-deep' : delta < 0 ? 'text-cap-rose-deep' : 'text-cap-ink';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-cap-ink-2 font-medium">{label}</span>
        <span className={`font-bold transition-all duration-300 ${flash ? 'scale-110' : ''} ${deltaColor}`}
          style={{ display: 'inline-block', transform: flash ? 'scale(1.2)' : 'scale(1)' }}
        >
          {value}
        </span>
      </div>
      <div className="h-1.5 bg-cap-line-light rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500 ${flash ? 'animate-pulse' : ''}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isUser ? 'order-2' : ''}`}>
        <div
          className={`px-4 py-3 text-sm leading-relaxed font-medium ${
            isUser
              ? 'bg-cap-peach text-white rounded-2xl rounded-br-md shadow-sm'
              : 'bg-white text-cap-ink rounded-2xl rounded-bl-md border border-cap-line shadow-sm'
          }`}
        >
          {message.content}
        </div>
        {/* Tags */}
        {!isUser && message.triggered_tags && message.triggered_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.triggered_tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cap-butter-soft text-cap-butter-deep border border-cap-butter/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {!isUser && message.hidden_revealed && message.hidden_revealed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {message.hidden_revealed.map((h) => (
              <span
                key={h}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cap-mint-soft text-cap-mint-deep border border-cap-mint/20"
              >
                🔓 {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
