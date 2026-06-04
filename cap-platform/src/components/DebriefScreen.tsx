import { useState, useRef, useEffect } from 'react';
import { store, useSession } from '../store/Store';
import type { AppMode, RoundScore, TrainingRoundScore, ResearchRoundScore, ChatMessage } from '../types';

export function DebriefScreen() {
  const session = useSession();
  const [showDialog, setShowDialog] = useState(false);

  if (!session) {
    store.setScreen('home');
    return null;
  }

  const evaluation = session.evaluation;
  const isTraining = session.mode === 'training';
  const isGenerating = session.status === 'ended' && !evaluation;

  // 综合评分
  const overallScore = evaluation
    ? Math.round(Object.values(evaluation.round_scores).reduce((a, b) => a + b, 0) / 5)
    : 0;

  const grade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : 'D';
  const gradeColor = grade === 'A' ? 'bg-cap-mint' : grade === 'B' ? 'bg-cap-sky' : grade === 'C' ? 'bg-cap-butter' : 'bg-cap-rose';

  // 维度评分条目
  const scoreBars = evaluation ? getScoreBars(session.mode, evaluation.round_scores) : [];

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => store.setScreen('home')}
          className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold mb-6 transition-colors"
        >
          ← 返回
        </button>

        <div className="mb-8">
          <div className={`chip chip-${isTraining ? 'peach' : 'mint'} mb-3`}>
            {isTraining ? '销售对练报告' : '调研访谈报告'}
          </div>
          <p className="text-cap-ink-2 font-semibold">
            {session.round} 轮对话 · {Math.round((Date.now() - session.created_at) / 60000)} 分钟
          </p>
        </div>

        {/* 报告生成中占位 */}
        {isGenerating && (
          <div className="plush-lg p-8 mb-6 text-center bg-cap-butter-soft border border-cap-butter">
            <div className="text-4xl mb-3">⏳</div>
            <h3 className="font-bold text-cap-ink mb-2">报告生成中</h3>
            <p className="text-cap-ink-2 text-sm font-medium mb-4">
              AI 督导正在分析对话内容，大约需要 20-30 秒
            </p>
            <div className="w-48 h-2 bg-white rounded-full overflow-hidden mx-auto border border-cap-line">
              <div className="h-full bg-cap-butter animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
            <p className="text-xs text-cap-ink-soft font-medium mt-4">
              您可以先查看对话记录，或返回首页/历史记录，报告生成后会自动更新
            </p>
          </div>
        )}

        {/* Coaching Summary */}
        {evaluation?.coaching_summary && (
          <div className="plush-lg p-5 mb-6 bg-cap-butter-soft border border-cap-butter">
            <h3 className="font-bold text-cap-ink mb-2 flex items-center gap-2 text-sm">
              <span>🎯</span> 督导点评
            </h3>
            <p className="text-cap-ink font-bold text-sm leading-relaxed">{evaluation.coaching_summary}</p>
          </div>
        )}

        {/* Overall Score + Grade */}
        {evaluation && (
          <div className="plush-lg p-8 mb-6 text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-24 h-24 rounded-full bg-cap-butter border border-cap-line flex items-center justify-center shadow-sm">
                <span className="text-4xl font-bold text-cap-ink">{overallScore}</span>
              </div>
              <div className={`w-16 h-16 rounded-full ${gradeColor} border border-cap-line flex items-center justify-center shadow-sm`}>
                <span className="text-2xl font-bold text-cap-ink">{grade}</span>
              </div>
            </div>
            <div className="text-cap-ink-2 text-sm font-bold mb-2">综合评分 · {gradeLabel(grade)}</div>
            {evaluation && (
              <div className="text-sm text-cap-ink-2 font-semibold">
                人设一致性: {(evaluation.persona_consistency * 100).toFixed(0)}%
              </div>
            )}
          </div>
        )}

        {/* Dimension Scores */}
        {scoreBars.length > 0 && (
          <div className="plush-lg p-6 mb-6">
            <h3 className="font-bold mb-4 text-cap-ink text-lg">维度评分</h3>
            <div className="space-y-4">
              {scoreBars.map((bar) => (
                <ScoreBar key={bar.label} label={bar.label} value={bar.value} color={bar.color} />
              ))}
            </div>
          </div>
        )}

        {/* Hidden Info Check */}
        {evaluation?.hidden_info_check && evaluation.hidden_info_check.length > 0 && (
          <div className="plush-lg p-6 mb-6">
            <h3 className="font-bold mb-4 text-cap-ink text-lg flex items-center gap-2">
              <span>🔓</span> 隐藏信息挖掘
            </h3>
            <div className="space-y-3">
              {evaluation.hidden_info_check.map((hi, i) => (
                <div key={i} className={`p-3 rounded-xl border border-cap-line ${hi.triggered ? 'bg-cap-mint-soft' : 'bg-cap-rose-soft'}`}>
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-lg">{hi.triggered ? '✅' : '❌'}</span>
                    <p className="text-sm font-bold text-cap-ink flex-1">{hi.content}</p>
                  </div>
                  {hi.triggered && hi.round && (
                    <p className="text-xs text-cap-ink-2 font-semibold ml-7">第 {hi.round} 轮触发 · {hi.note}</p>
                  )}
                  {!hi.triggered && (
                    <p className="text-xs text-cap-rose-deep font-semibold ml-7">未触发 · {hi.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pain Points Check */}
        {evaluation?.pain_points_check && evaluation.pain_points_check.length > 0 && (
          <div className="plush-lg p-6 mb-6">
            <h3 className="font-bold mb-4 text-cap-ink text-lg flex items-center gap-2">
              <span>⚡</span> 核心痛点识别
            </h3>
            <div className="space-y-3">
              {evaluation.pain_points_check.map((pp, i) => (
                <div key={i} className={`p-3 rounded-xl border border-cap-line ${pp.recognized ? 'bg-cap-mint-soft' : 'bg-cap-rose-soft'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{pp.recognized ? '✅' : '❌'}</span>
                      <span className="text-sm font-bold text-cap-ink">{pp.topic}</span>
                    </div>
                    {pp.recognized && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-cap-line bg-cap-butter">
                        {isTraining
                          ? (pp.response_quality === 'good' ? '回应优秀' : pp.response_quality === 'fair' ? '回应一般' : '回应不足')
                          : (pp.depth === 'deep' ? '挖掘深入' : '挖掘浅显')
                        }
                      </span>
                    )}
                  </div>
                  {pp.recognized && pp.round && (
                    <p className="text-xs text-cap-ink-2 font-semibold ml-7">第 {pp.round} 轮识别 · {pp.note}</p>
                  )}
                  {!pp.recognized && (
                    <p className="text-xs text-cap-rose-deep font-semibold ml-7">未识别 · {pp.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missed Opportunities */}
        {evaluation?.missed_opportunities && evaluation.missed_opportunities.length > 0 && (
          <div className="plush-lg p-6 mb-6 bg-cap-butter-soft border border-cap-butter">
            <h3 className="font-bold mb-4 text-cap-ink text-lg flex items-center gap-2">
              <span>💡</span> 遗漏机会
            </h3>
            <div className="space-y-3">
              {evaluation.missed_opportunities.map((mo, i) => (
                <div key={i} className="p-3 rounded-xl bg-cap-cream-2 border border-cap-line">
                  <p className="text-sm font-bold text-cap-ink mb-1.5">{mo.item}</p>
                  <p className="text-xs text-cap-ink-2 font-semibold">
                    <span className="text-cap-mint-deep font-bold">应问：</span>{mo.should_ask}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {evaluation?.highlights && evaluation.highlights.length > 0 && (
          <div className="plush-lg p-6 mb-6 bg-cap-mint/10">
            <h3 className="font-bold mb-4 text-cap-ink text-lg flex items-center gap-2">
              <span>✨</span> 亮点
            </h3>
            <div className="space-y-3">
              {evaluation.highlights.map((h, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="chip chip-mint shrink-0 text-xs">第{h.round}轮</span>
                  <span className="text-cap-ink-2 font-semibold">{h.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failures */}
        {evaluation?.failures && evaluation.failures.length > 0 && (
          <div className="plush-lg p-6 mb-6 bg-cap-rose-soft border border-cap-rose-deep">
            <h3 className="font-bold mb-4 text-cap-ink text-lg flex items-center gap-2">
              <span>🛠️</span> 改进点
            </h3>
            <div className="space-y-4">
              {evaluation.failures.map((f, i) => (
                <div key={i} className="text-sm">
                  <div className="flex gap-3 mb-1">
                    <span className="chip chip-rose shrink-0 text-xs">第{f.round}轮</span>
                    <span className="text-cap-ink font-bold">{f.text}</span>
                  </div>
                  <p className="text-cap-ink-2 ml-14 text-xs font-semibold mb-1">建议: {f.suggestion}</p>
                  {f.better_approach && (
                    <p className="text-cap-mint-deep ml-14 text-xs font-bold">
                      💬 {f.better_approach}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Conversation Button */}
        {session.messages.length > 0 && (
          <div className="plush-lg p-6 mb-6 text-center">
            <button
              onClick={() => setShowDialog(true)}
              className="px-8 py-3 rounded-xl bg-cap-butter-soft border border-cap-butter text-cap-ink font-bold text-base hover:bg-cap-butter transition-colors inline-flex items-center gap-2"
            >
              <span>💬</span> 查看对话
            </button>
          </div>
        )}

        {/* Conversation Dialog */}
        {showDialog && (
          <ConversationDialog
            messages={session.messages}
            onClose={() => setShowDialog(false)}
            mode={session.mode}
          />
        )}

        <div className="flex gap-4 mt-8 mb-8">
          <button
            onClick={() => store.setScreen('home')}
            className="flex-1 btn-plush btn-plush-peach py-3"
          >
            🏠 返回首页
          </button>
          <button
            onClick={() => store.setScreen('history')}
            className="flex-1 btn-plush btn-plush-ghost py-3"
          >
            📋 查看历史
          </button>
        </div>
      </div>
    </div>
  );
}

function getScoreBars(mode: AppMode, scores: RoundScore) {
  if (mode === 'training') {
    const s = scores as TrainingRoundScore;
    return [
      { label: '需求挖掘', value: s.needs_discovery, color: 'bg-cap-mint' },
      { label: '信任建立', value: s.trust_building, color: 'bg-cap-sky' },
      { label: '异议处理', value: s.objection_handling, color: 'bg-cap-peach' },
      { label: '方案匹配', value: s.solution_matching, color: 'bg-cap-butter' },
      { label: '成交意识', value: s.closing_awareness, color: 'bg-cap-rose' },
    ];
  }
  const s = scores as ResearchRoundScore;
  return [
    { label: '提问质量', value: s.question_quality, color: 'bg-cap-mint' },
    { label: '信息完整度', value: s.information_completeness, color: 'bg-cap-sky' },
    { label: '隐藏需求挖掘', value: s.hidden_needs_uncovered, color: 'bg-cap-peach' },
    { label: '情感洞察', value: s.emotional_insight, color: 'bg-cap-butter' },
    { label: '偏见规避', value: s.bias_avoidance, color: 'bg-cap-rose' },
  ];
}

function ScoreBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const barColor = color || (value >= 80 ? 'bg-cap-mint' : value >= 60 ? 'bg-cap-sky' : value >= 40 ? 'bg-cap-butter' : 'bg-cap-rose');

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-bold text-cap-ink">{label}</span>
        <span className="font-bold text-cap-ink">{value}</span>
      </div>
      <div className="h-3 bg-white rounded-full overflow-hidden border border-cap-line ">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function gradeLabel(grade: string): string {
  switch (grade) {
    case 'A': return '优秀';
    case 'B': return '良好';
    case 'C': return '及格';
    case 'D': return '待改进';
    default: return '';
  }
}

function ConversationDialog({
  messages,
  onClose,
  mode,
}: {
  messages: ChatMessage[];
  onClose: () => void;
  mode: AppMode;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg h-[80vh] mx-4 bg-cap-cream rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-cap-line">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cap-line bg-white shrink-0">
          <div>
            <h3 className="font-bold text-cap-ink text-sm">
              {mode === 'training' ? '销售对练对话' : '调研访谈对话'}
            </h3>
            <p className="text-xs text-cap-ink-2 font-medium">共 {messages.length} 条消息</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-cap-ink-2 hover:text-cap-rose-deep hover:bg-cap-rose-soft transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} mode={mode} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, mode }: { message: ChatMessage; mode: AppMode }) {
  const isUser = message.role === 'user';
  const isTraining = mode === 'training';

  const userBubbleClass = isTraining
    ? 'bg-cap-peach text-white rounded-2xl rounded-br-md shadow-sm'
    : 'bg-cap-mint text-white rounded-2xl rounded-br-md shadow-sm';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : ''}`}>
        <div
          className={`px-4 py-3 text-sm leading-relaxed font-medium ${
            isUser ? userBubbleClass : 'bg-white text-cap-ink rounded-2xl rounded-bl-md border border-cap-line shadow-sm'
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
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  isTraining
                    ? 'bg-cap-butter-soft text-cap-butter-deep border-cap-butter/20'
                    : 'bg-cap-sky-soft text-cap-sky-deep border-cap-sky/20'
                }`}
              >
                {isTraining ? '🏷️' : '📌'} {tag}
              </span>
            ))}
          </div>
        )}
        {/* 隐藏信息 — 仅训练模式 */}
        {!isUser && isTraining && message.hidden_revealed && message.hidden_revealed.length > 0 && (
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
