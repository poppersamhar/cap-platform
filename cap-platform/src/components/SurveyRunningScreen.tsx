import { useEffect, useRef, useState, useCallback } from 'react';
import { store, useStore } from '../store/Store';
import type { PersonaSurveyReport } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
const POLL_INTERVAL = 3000;

export function SurveyRunningScreen() {
  const survey = useStore((s) => s.currentSurvey);
  const [progress, setProgress] = useState(survey?.progress || []);
  const [status, setStatus] = useState(survey?.status || 'running');
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const savedToHistoryRef = useRef(false);

  // 使用 ref 保存 survey 的最新值，避免 finishAndSave 依赖变化导致 useEffect 反复重启轮询
  const surveyRef = useRef(survey);
  surveyRef.current = survey;

  const finishAndSave = useCallback((finalStatus: 'completed' | 'failed', finalReports: PersonaSurveyReport[]) => {
    if (savedToHistoryRef.current) return;
    savedToHistoryRef.current = true;

    const currentSurvey = surveyRef.current;
    if (currentSurvey) {
      const updatedSurvey = {
        ...currentSurvey,
        status: finalStatus,
        reports: finalReports,
        progress: currentSurvey.progress.map((p) => ({ ...p, status: 'completed' as const })),
      };
      store.setCurrentSurvey(updatedSurvey);
      store.addSurveyToHistory(updatedSurvey);

      if (finalStatus === 'completed') {
        store.showToast('问卷调研已完成，报告已保存到历史记录', 'success');
      }
    }
  }, []);

  useEffect(() => {
    if (!survey || startedRef.current) return;
    startedRef.current = true;

    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/survey/${survey.id}/progress`);
        if (!resp.ok) throw new Error('获取进度失败');
        const data = await resp.json();

        setProgress(data.progress || []);
        setStatus(data.status);

        if (data.status === 'completed') {
          const reportsResp = await fetch(`${API_BASE}/api/survey/${survey.id}/reports`);
          let loadedReports: PersonaSurveyReport[] = [];
          if (reportsResp.ok) {
            const reportsData = await reportsResp.json();
            loadedReports = reportsData.reports || [];
          }

          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }

          store.setCurrentSurvey({
            ...survey,
            status: 'completed',
            progress: data.progress || [],
            reports: loadedReports,
          });

          finishAndSave('completed', loadedReports);
        } else if (data.status === 'failed') {
          setError(data.error || '问卷执行失败');
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          finishAndSave('failed', []);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.id]);

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cap-cream">
        <div className="text-center">
          <p className="text-cap-ink-2 font-medium">没有正在进行的问卷任务</p>
          <button
            onClick={() => store.setScreen('home')}
            className="mt-4 px-4 py-2 rounded-xl bg-cap-mint text-white text-sm font-bold"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = survey.template.questions.length;
  const allCompleted = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <div className="min-h-screen px-8 py-12 bg-cap-cream">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="chip chip-mint mb-3">问卷调研</div>
            <h2 className="text-3xl font-bold mb-2 text-cap-ink">
              {allCompleted ? '问卷完成' : isFailed ? '执行失败' : '问卷执行中'}
            </h2>
            <p className="text-cap-ink-2 font-medium">
              {allCompleted
                ? '所有分身已完成问卷，报告已保存到历史记录'
                : isFailed
                ? '部分分身执行失败，请查看错误信息'
                : 'AI 分身正在基于自身画像和原始对话数据回答问题'}
            </p>
          </div>
          {!allCompleted && !isFailed && (
            <button
              onClick={() => store.setScreen('home')}
              className="px-4 py-2 rounded-xl bg-white border border-cap-line text-cap-ink-2 text-sm font-bold hover:bg-cap-cream-2 transition-colors shrink-0"
            >
              🏠 返回首页（后台执行）
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-cap-rose-soft border border-cap-rose/20 text-cap-rose-deep text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {progress.map((p) => {
            const completed = p.status === 'completed';
            const failed = p.status === 'failed';
            const running = p.status === 'running';
            const completedQuestions = p.completed_questions ?? 0;
            const pct = Math.round((completedQuestions / totalQuestions) * 100);

            return (
              <div key={p.persona_id} className="plush-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cap-butter-soft flex items-center justify-center text-xl">
                      {p.persona_gender === 'M' ? '👨' : '👩'}
                    </div>
                    <div>
                      <h4 className="font-bold text-cap-ink text-sm">{p.persona_name}</h4>
                      <p className="text-xs text-cap-ink-2 font-medium">
                        {completed
                          ? '已完成'
                          : failed
                          ? '失败'
                          : running
                          ? '回答中...'
                          : '等待中'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-cap-ink">
                    {completedQuestions}/{totalQuestions}
                  </span>
                </div>
                <div className="h-2 bg-cap-line-light rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completed
                        ? 'bg-cap-mint'
                        : failed
                        ? 'bg-cap-rose'
                        : 'bg-cap-sky'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {allCompleted && (
          <div className="flex gap-3 mt-8">
            <button
              onClick={() => store.setScreen('surveyResult')}
              className="flex-1 btn-plush btn-plush-mint py-4 text-lg"
            >
              查看调研结果
            </button>
            <button
              onClick={() => store.setScreen('home')}
              className="px-6 py-4 rounded-xl bg-white border border-cap-line text-cap-ink-2 font-bold text-sm hover:bg-cap-cream-2 transition-colors"
            >
              返回首页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
