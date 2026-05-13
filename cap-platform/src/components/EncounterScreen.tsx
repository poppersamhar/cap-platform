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
      <div className="flex items-center justify-between px-6 py-3 border-b-[3px] border-cap-line bg-cap-paper shadow-[0_2px_0_#2B1E16]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => store.setScreen('endConfirm')}
            className="text-cap-ink-2 hover:text-cap-ink font-bold text-lg transition-colors"
          >
            ←
          </button>
          <div>
            <h3 className="font-black text-sm text-cap-ink">{session.mode === 'training' ? '销售对练' : '用户调研'}</h3>
            <p className="text-xs text-cap-ink-2 font-bold">第 {session.round} 轮</p>
          </div>
        </div>
        <button
          onClick={() => store.setScreen('endConfirm')}
          className="btn-plush btn-plush-rose px-4 py-1.5 text-sm"
        >
          结束对话
        </button>
      </div>

      {/* Emotion Bar */}
      <div className="px-6 py-3 border-b-[3px] border-cap-line bg-cap-cream-2">
        <div className="grid grid-cols-5 gap-3">
          <EmotionItem label="信任度" value={emotion.trust} color="bg-cap-mint" />
          <EmotionItem label="购买意愿" value={emotion.intent} color="bg-cap-peach" />
          <EmotionItem label="好感度" value={emotion.rapport} color="bg-cap-sky" />
          <EmotionItem label="抵触" value={emotion.resistance} color="bg-cap-rose-deep" />
          <EmotionItem label="焦虑" value={emotion.anxiety} color="bg-cap-butter-deep" />
        </div>
        {session.special_state && (
          <div className={`mt-2 text-xs px-3 py-1.5 rounded-full inline-block font-bold border-[2px] border-cap-line ${
            session.special_state === 'customer_leaving' ? 'bg-cap-rose text-cap-ink' :
            session.special_state === 'decision_phase' ? 'bg-cap-mint text-cap-ink' :
            'bg-cap-butter text-cap-ink'
          }`}
          style={{ boxShadow: '0 2px 0 #2B1E16' }}>
            {session.special_state === 'customer_leaving' && '⚠️ 客户准备离店'}
            {session.special_state === 'decision_phase' && '✅ 进入决策阶段'}
            {session.special_state === 'confrontation' && '⚠️ 进入对抗模式'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {session.messages.length === 0 && (
          <div className="text-center text-cap-ink-2 py-8 animate-popin">
            <p className="text-4xl mb-3">👋</p>
            <p className="text-lg font-bold mb-1">对话开始</p>
            <p className="text-sm font-semibold mb-6">向客户打个招呼，开始你的{session.mode === 'training' ? '销售对练' : '调研访谈'}</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {(session.mode === 'training' ? TRAINING_HINTS : RESEARCH_HINTS).map((hint) => (
                <button
                  key={hint}
                  onClick={() => {
                    setInput(hint);
                    const ta = document.querySelector('textarea');
                    if (ta) ta.focus();
                  }}
                  className="px-3 py-2 rounded-full text-xs font-bold bg-white border-[2px] border-cap-line text-cap-ink hover:bg-cap-cream-2 transition-colors"
                  style={{ boxShadow: '0 2px 0 #2B1E16' }}
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
          <div className="flex items-center gap-2 text-cap-ink-2 text-sm font-bold ml-2">
            <div className="w-3 h-3 rounded-full bg-cap-peach animate-bounce" />
            <div className="w-3 h-3 rounded-full bg-cap-butter animate-bounce [animation-delay:0.1s]" />
            <div className="w-3 h-3 rounded-full bg-cap-mint animate-bounce [animation-delay:0.2s]" />
            <span className="ml-1">客户思考中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t-[3px] border-cap-line bg-cap-paper shadow-[0_-2px_0_#2B1E16]">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session.mode === 'training' ? '输入你的销售话术...' : '输入你的调研问题...'}
            className="flex-1 px-4 py-3 rounded-2xl bg-white border-[3px] border-cap-line resize-none focus:outline-none focus:border-cap-peach text-sm min-h-[48px] max-h-[120px] font-semibold text-cap-ink shadow-[0_3px_0_#2B1E16]"
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
      <div className="flex justify-between text-xs mb-1">
        <span className="text-cap-ink-2 font-bold">{label}</span>
        <span className={`font-black transition-all duration-300 ${flash ? 'scale-125' : ''} ${deltaColor}`}
          style={{ display: 'inline-block', transform: flash ? 'scale(1.3)' : 'scale(1)' }}
        >
          {value}
        </span>
      </div>
      <div className="h-2.5 bg-white rounded-full overflow-hidden border-[2px] border-cap-line shadow-[0_1px_0_#2B1E16]">
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
          className={`px-4 py-3 text-sm leading-relaxed font-semibold border-[3px] border-cap-line ${
            isUser
              ? 'bg-cap-peach text-cap-ink rounded-2xl rounded-br-md shadow-[0_4px_0_#2B1E16]'
              : 'bg-white text-cap-ink rounded-2xl rounded-bl-md shadow-[0_4px_0_#2B1E16]'
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
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-cap-butter border-[2px] border-cap-line text-cap-ink"
                style={{ boxShadow: '0 1px 0 #2B1E16' }}
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
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-cap-mint border-[2px] border-cap-line text-cap-ink"
                style={{ boxShadow: '0 1px 0 #2B1E16' }}
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
