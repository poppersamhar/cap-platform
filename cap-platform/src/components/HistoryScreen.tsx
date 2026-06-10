import { useState } from 'react';
import { store, useHistory, useSurveyHistory } from '../store/Store';

export function HistoryScreen() {
  const history = useHistory();
  const surveyHistory = useSurveyHistory();
  const [activeTab, setActiveTab] = useState<'sessions' | 'surveys'>('sessions');

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => store.setScreen('home')}
            className="text-cap-ink-2 hover:text-cap-ink text-sm font-semibold transition-colors"
          >
            ← 返回首页
          </button>
          {activeTab === 'sessions' && history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('确定清空所有历史记录？')) {
                  store.clearAllHistory();
                }
              }}
              className="text-cap-rose-deep hover:text-cap-ink text-sm font-semibold transition-colors"
            >
              清空记录
            </button>
          )}
          {activeTab === 'surveys' && surveyHistory.length > 0 && (
            <button
              onClick={() => {
                if (confirm('确定清空所有问卷记录？')) {
                  store.clearAllSurveyHistory();
                }
              }}
              className="text-cap-rose-deep hover:text-cap-ink text-sm font-semibold transition-colors"
            >
              清空记录
            </button>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-cap-ink">历史记录</h2>
          <p className="text-cap-ink-2 font-medium">
            共 {history.length} 条对话记录 · {surveyHistory.length} 条问卷记录
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'sessions'
                ? 'bg-cap-mint text-white'
                : 'bg-white border border-cap-line text-cap-ink-2 hover:border-cap-mint/40'
            }`}
          >
            对话记录 ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('surveys')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'surveys'
                ? 'bg-cap-sky text-white'
                : 'bg-white border border-cap-line text-cap-ink-2 hover:border-cap-sky/40'
            }`}
          >
            问卷记录 ({surveyHistory.length})
          </button>
        </div>

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <>
            {history.length === 0 && (
              <div className="plush-lg p-12 text-center">
                <div className="text-5xl mb-4 animate-bounce">💬</div>
                <p className="text-cap-ink-2 font-semibold mb-2">暂无对话记录</p>
                <p className="text-cap-ink-soft text-sm font-medium">
                  完成一次对练或调研后，记录会保存在这里
                </p>
              </div>
            )}

            <div className="space-y-4">
              {history.map((session) => {
                const scores = session.evaluation?.round_scores;
                const overallScore = scores
                  ? Math.round(
                      Object.values(scores).reduce((a, b) => a + b, 0) /
                        Object.keys(scores).length
                    )
                  : 0;
                return (
                  <div
                    key={session.id}
                    className="w-full p-5 plush-lg hover:-translate-y-0.5 transition-transform duration-200 group"
                  >
                    <button
                      onClick={() => store.viewHistory(session.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg ${
                            session.mode === 'training'
                              ? 'bg-cap-peach-soft border-cap-peach/30'
                              : 'bg-cap-mint-soft border-cap-mint/30'
                          }`}>
                            {session.mode === 'training' ? '💬' : '🔍'}
                          </div>
                          <div>
                            <h3 className="font-bold text-cap-ink text-sm">
                              {session.persona?.profile.name || session.persona_id}
                            </h3>
                            <p className="text-xs text-cap-ink-2 font-medium flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                session.mode === 'training'
                                  ? 'bg-cap-peach-soft text-cap-peach-deep'
                                  : 'bg-cap-mint-soft text-cap-mint-deep'
                              }`}>
                                {session.mode === 'training' ? '销售对练' : '用户调研'}
                              </span>
                              <span>· {session.round}轮</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.evaluation && (
                            <div
                              className={`w-12 h-12 rounded-xl border border-cap-line flex items-center justify-center ${
                                overallScore >= 75
                                  ? 'bg-cap-mint-soft'
                                  : overallScore >= 60
                                  ? 'bg-cap-butter-soft'
                                  : 'bg-cap-rose-soft'
                              }`}
                            >
                              <span className="font-bold text-cap-ink text-sm">{overallScore}</span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('确定删除这条记录？')) {
                                store.deleteHistoryItem(session.id);
                              }
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-cap-ink-2 hover:text-cap-rose-deep hover:bg-cap-rose-soft transition-colors"
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-cap-ink-2 font-medium">
                        {new Date(session.created_at).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Surveys Tab */}
        {activeTab === 'surveys' && (
          <>
            {surveyHistory.length === 0 && (
              <div className="plush-lg p-12 text-center">
                <div className="text-5xl mb-4 animate-bounce">📝</div>
                <p className="text-cap-ink-2 font-semibold mb-2">暂无问卷记录</p>
                <p className="text-cap-ink-soft text-sm font-medium">
                  完成一次问卷调研后，报告会保存在这里
                </p>
              </div>
            )}

            <div className="space-y-4">
              {surveyHistory.map((item) => (
                <div
                  key={item.id}
                  className="w-full p-5 plush-lg hover:-translate-y-0.5 transition-transform duration-200 group"
                >
                  <button
                    onClick={() => store.viewSurveyResult(item.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center text-lg bg-cap-sky-soft border-cap-sky/30">
                          📝
                        </div>
                        <div>
                          <h3 className="font-bold text-cap-ink text-sm">
                            {item.template_name}
                          </h3>
                          <p className="text-xs text-cap-ink-2 font-medium flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cap-sky-soft text-cap-sky-deep">
                              问卷调研
                            </span>
                            <span>· {item.persona_count} 个分身</span>
                            <span>· {item.reports.length} 份报告</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Download all reports
                            downloadAllSurveyReports(item);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cap-sky text-white hover:bg-cap-sky/90 transition-colors"
                        >
                          ⬇️ 下载
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定删除这条问卷记录？')) {
                              store.deleteSurveyHistoryItem(item.id);
                            }
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-cap-ink-2 hover:text-cap-rose-deep hover:bg-cap-rose-soft transition-colors"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-cap-ink-2 font-medium">
                      {new Date(item.completed_at).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function downloadAllSurveyReports(item: { template_name: string; reports: { persona_name: string; answers: { category: string; question: string; answer: string }[] }[] }) {
  const lines: string[] = [];
  lines.push(`# ${item.template_name} 综合报告`);
  lines.push('');
  lines.push(`分身数量: ${item.reports.length}`);
  lines.push(`导出时间: ${new Date().toLocaleString()}`);
  lines.push('');

  for (const report of item.reports) {
    lines.push(`## ${report.persona_name}`);
    lines.push('');
    for (const ans of report.answers) {
      lines.push(`### ${ans.category}`);
      lines.push(`**Q:** ${ans.question}`);
      lines.push(`**A:** ${ans.answer}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `问卷调研报告_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
