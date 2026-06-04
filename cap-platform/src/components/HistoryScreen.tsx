import { store, useHistory } from '../store/Store';

export function HistoryScreen() {
  const history = useHistory();

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
          {history.length > 0 && (
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
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-cap-ink">历史记录</h2>
          <p className="text-cap-ink-2 font-medium">共 {history.length} 条记录</p>
        </div>

        {history.length === 0 && (
          <div className="plush-lg p-12 text-center">
            <div className="text-5xl mb-4 animate-bounce">📋</div>
            <p className="text-cap-ink-2 font-semibold mb-2">暂无历史记录</p>
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
      </div>
    </div>
  );
}
