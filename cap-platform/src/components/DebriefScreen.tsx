import { store, useSession } from '../store/Store';
import type { RoundScore } from '../types';

export function DebriefScreen() {
  const session = useSession();

  if (!session) {
    store.setScreen('home');
    return null;
  }

  const evaluation = session.evaluation;
  const isTraining = session.mode === 'training';

  // 计算平均分
  const avgScores: RoundScore | null = evaluation?.round_scores?.length
    ? evaluation.round_scores.reduce((acc, s) => ({
        insight: acc.insight + s.insight,
        adaptation: acc.adaptation + s.adaptation,
        matching: acc.matching + s.matching,
        objection: acc.objection + s.objection,
        trust_building: acc.trust_building + s.trust_building,
      }), { insight: 0, adaptation: 0, matching: 0, objection: 0, trust_building: 0 })
    : null;

  if (avgScores && evaluation) {
    const count = evaluation.round_scores.length;
    avgScores.insight = Math.round(avgScores.insight / count);
    avgScores.adaptation = Math.round(avgScores.adaptation / count);
    avgScores.matching = Math.round(avgScores.matching / count);
    avgScores.objection = Math.round(avgScores.objection / count);
    avgScores.trust_building = Math.round(avgScores.trust_building / count);
  }

  const overallScore = avgScores
    ? Math.round((avgScores.insight + avgScores.adaptation + avgScores.matching + avgScores.objection + avgScores.trust_building) / 5)
    : 0;

  const grade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : 'D';
  const gradeColor = grade === 'A' ? 'bg-cap-mint' : grade === 'B' ? 'bg-cap-sky' : grade === 'C' ? 'bg-cap-butter' : 'bg-cap-rose';

  // 提取对话摘要：每轮的关键消息
  const roundMessages: { round: number; user: string; client: string }[] = [];
  const msgs = session.messages;
  for (let i = 0; i < msgs.length; i += 2) {
    const userMsg = msgs[i];
    const clientMsg = msgs[i + 1];
    if (userMsg && clientMsg) {
      roundMessages.push({
        round: Math.floor(i / 2) + 1,
        user: userMsg.content.slice(0, 40) + (userMsg.content.length > 40 ? '...' : ''),
        client: clientMsg.content.slice(0, 60) + (clientMsg.content.length > 60 ? '...' : ''),
      });
    }
  }

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => store.setScreen('home')}
          className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold mb-6 transition-colors"
        >
          ← 返回首页
        </button>

        <div className="mb-8">
          <div className={`chip chip-${isTraining ? 'peach' : 'mint'} mb-3`}>
            {isTraining ? '销售对练报告' : '调研访谈报告'}
          </div>
          <p className="text-cap-ink-2 font-semibold">
            {session.round} 轮对话 · {Math.round((Date.now() - session.created_at) / 60000)} 分钟
          </p>
        </div>

        {/* Overall Score + Grade */}
        <div className="plush-lg p-8 mb-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-24 h-24 rounded-full bg-cap-butter border-[4px] border-cap-line flex items-center justify-center shadow-[0_5px_0_#2B1E16]">
              <span className="text-4xl font-black text-cap-ink">{overallScore}</span>
            </div>
            <div className={`w-16 h-16 rounded-full ${gradeColor} border-[4px] border-cap-line flex items-center justify-center shadow-[0_4px_0_#2B1E16]`}>
              <span className="text-2xl font-black text-cap-ink">{grade}</span>
            </div>
          </div>
          <div className="text-cap-ink-2 text-sm font-bold mb-2">综合评分 · {gradeLabel(grade)}</div>
          {evaluation && (
            <div className="text-sm text-cap-ink-2 font-semibold">
              人设一致性: {(evaluation.persona_consistency * 100).toFixed(0)}%
            </div>
          )}
        </div>

        {/* Dimension Scores */}
        {avgScores && (
          <div className="plush-lg p-6 mb-6">
            <h3 className="font-black mb-4 text-cap-ink text-lg">维度评分</h3>
            <div className="space-y-4">
              <ScoreBar label="客户洞察" value={avgScores.insight} color="bg-cap-mint" />
              <ScoreBar label="需求适配" value={avgScores.adaptation} color="bg-cap-sky" />
              <ScoreBar label="方案匹配" value={avgScores.matching} color="bg-cap-peach" />
              <ScoreBar label="异议处理" value={avgScores.objection} color="bg-cap-butter" />
              <ScoreBar label="信任建立" value={avgScores.trust_building} color="bg-cap-rose" />
            </div>
          </div>
        )}

        {/* Round-by-round scores */}
        {evaluation?.round_scores && evaluation.round_scores.length > 0 && (
          <div className="plush-lg p-6 mb-6">
            <h3 className="font-black mb-4 text-cap-ink text-lg">逐轮评分</h3>
            <div className="space-y-3">
              {evaluation.round_scores.map((s, i) => (
                <div key={i} className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
                  <div className="flex justify-between items-center mb-2">
                    <span className="chip chip-butter text-xs">第{i + 1}轮</span>
                    <span className="font-black text-cap-ink">{Math.round((s.insight + s.adaptation + s.matching + s.objection + s.trust_building) / 5)}分</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <MiniBar label="洞察" value={s.insight} />
                    <MiniBar label="适配" value={s.adaptation} />
                    <MiniBar label="匹配" value={s.matching} />
                    <MiniBar label="异议" value={s.objection} />
                    <MiniBar label="信任" value={s.trust_building} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversation Summary */}
        {roundMessages.length > 0 && (
          <div className="plush-lg p-6 mb-6">
            <h3 className="font-black mb-4 text-cap-ink text-lg">对话摘要</h3>
            <div className="space-y-3">
              {roundMessages.map((rm) => (
                <div key={rm.round} className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
                  <span className="chip chip-butter text-xs mb-2 inline-block">第{rm.round}轮</span>
                  <p className="text-xs text-cap-ink-2 font-semibold mb-1">
                    <span className="text-cap-peach-deep font-black">你：</span>{rm.user}
                  </p>
                  <p className="text-xs text-cap-ink font-semibold">
                    <span className="text-cap-mint-deep font-black">客户：</span>{rm.client}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {evaluation?.highlights && evaluation.highlights.length > 0 && (
          <div className="plush-lg p-6 mb-6 bg-cap-mint-soft">
            <h3 className="font-black mb-4 text-cap-ink text-lg flex items-center gap-2">
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
          <div className="plush-lg p-6 mb-6 bg-cap-rose/20">
            <h3 className="font-black mb-4 text-cap-ink text-lg flex items-center gap-2">
              <span>💡</span> 改进点
            </h3>
            <div className="space-y-4">
              {evaluation.failures.map((f, i) => (
                <div key={i} className="text-sm">
                  <div className="flex gap-3 mb-1">
                    <span className="chip chip-rose shrink-0 text-xs">第{f.round}轮</span>
                    <span className="text-cap-ink font-bold">{f.text}</span>
                  </div>
                  <p className="text-cap-ink-2 ml-14 text-xs font-semibold">建议: {f.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!evaluation && (
          <div className="text-center py-12 text-cap-ink-2 font-bold plush-lg">
            <div className="text-4xl mb-3 animate-bounce">⏳</div>
            <p>评分正在生成中，请稍后再查看...</p>
          </div>
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

function ScoreBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const barColor = color || (value >= 80 ? 'bg-cap-mint' : value >= 60 ? 'bg-cap-sky' : value >= 40 ? 'bg-cap-butter' : 'bg-cap-rose');

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-bold text-cap-ink">{label}</span>
        <span className="font-black text-cap-ink">{value}</span>
      </div>
      <div className="h-3 bg-white rounded-full overflow-hidden border-[2px] border-cap-line shadow-[0_1px_0_#2B1E16]">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-cap-mint' : value >= 60 ? 'bg-cap-sky' : value >= 40 ? 'bg-cap-butter' : 'bg-cap-rose';
  return (
    <div className="text-center">
      <div className="h-2 bg-white rounded-full overflow-hidden border-[2px] border-cap-line mb-1">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-bold text-cap-ink-2">{label}</span>
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
