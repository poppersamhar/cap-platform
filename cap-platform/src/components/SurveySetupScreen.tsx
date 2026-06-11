import { useEffect, useState } from 'react';
import { store, useStore } from '../store/Store';
import type { Persona, SurveyTemplate } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

function PersonaSelectCard({
  p,
  selected,
  onToggle,
}: {
  p: Persona;
  selected: boolean;
  onToggle: () => void;
}) {
  const isTypical = p.id.startsWith('typical_');
  return (
    <button
      onClick={onToggle}
      className={`group p-4 text-left rounded-xl border transition-all duration-200 relative w-full ${
        selected
          ? 'border-cap-mint bg-cap-mint-soft ring-1 ring-cap-mint'
          : 'border-cap-line bg-white hover:border-cap-mint/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            selected ? 'border-cap-mint bg-cap-mint' : 'border-cap-line bg-white'
          }`}
        >
          {selected && <span className="text-white text-xs font-bold">✓</span>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-cap-butter-soft flex items-center justify-center text-xl">
          {p.profile.gender === 'M' ? '👨' : '👩'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-cap-ink text-sm">{p.profile.name}</h4>
            {isTypical && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cap-peach text-white">
                典型
              </span>
            )}
            {p._source === '4x' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cap-mint text-white">
                4X
              </span>
            )}
            {p._source === '4x_individual' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cap-mint text-white">
                4X
              </span>
            )}
          </div>
          <p className="text-xs text-cap-ink-2 font-medium truncate">
            {p.profile.age}岁 · {p.profile.city} · {p.profile.occupation}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2 ml-8">
        {p.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cap-cream-2 border border-cap-line text-cap-ink-2"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

export function SurveySetupScreen() {
  const personas = useStore((s) => s.personas);
  const isLoading = useStore((s) => s.isLoading);

  const [template, setTemplate] = useState<SurveyTemplate | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (personas.length === 0) {
      store.loadPersonas();
    }
    loadTemplate();
  }, []);

  async function loadTemplate() {
    try {
      const resp = await fetch(`${API_BASE}/api/survey/templates`);
      if (!resp.ok) throw new Error('加载模板失败');
      const data = await resp.json();
      const templates: SurveyTemplate[] = data.templates || [];
      if (templates.length > 0) {
        setTemplate(templates[0]);
      }
    } catch (e) {
      console.error('Failed to load survey template:', e);
    } finally {
      setLoadingTemplate(false);
    }
  }

  const togglePersona = (id: string) => {
    setSelectedPersonas((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pid) => pid !== id);
      }
      if (prev.length >= 1) {
        store.showToast('每次只能选择 1 个分身', 'info');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleStart = async () => {
    if (!template || selectedPersonas.length === 0) return;
    if (selectedPersonas.length < 1) {
      store.showToast('请至少选择 1 个分身', 'info');
      return;
    }

    store.setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/survey/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          persona_ids: selectedPersonas,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || '启动问卷失败');
      }
      const data = await resp.json();
      store.setCurrentSurvey({
        id: data.survey_id,
        template,
        persona_ids: selectedPersonas,
        status: 'running',
        progress: data.progress || [],
        reports: [],
        created_at: Date.now(),
      });
      store.setScreen('surveyRunning');
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : '启动失败', 'error');
    } finally {
      store.setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-8 py-12 bg-cap-cream">
      <button
        onClick={() => store.setScreen('home')}
        className="text-cap-ink-2 hover:text-cap-ink text-sm font-semibold mb-8 transition-colors"
      >
        ← 返回
      </button>

      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="chip chip-mint mb-3">问卷调研</div>
          <h2 className="text-3xl font-bold mb-2 text-cap-ink">配置问卷任务</h2>
          <p className="text-cap-ink-2 font-medium">
            选择问卷模板和目标分身，AI 将模拟真实用户填写问卷
          </p>
        </div>

        {/* 问卷模板 */}
        <div className="plush-lg p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="block font-bold text-cap-ink text-sm">
                📝 问卷模板
              </label>
              <p className="text-xs text-cap-ink-2 font-medium mt-1">
                {loadingTemplate
                  ? '加载中...'
                  : template
                  ? `${template.name} · ${template.questions.length} 个问题`
                  : '暂无可用模板'}
              </p>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cap-cream-2 border border-cap-line text-cap-ink-2 hover:bg-cap-cream transition-colors"
            >
              {showPreview ? '收起' : '预览问题'}
            </button>
          </div>

          {showPreview && template && (
            <div className="space-y-2 mt-3 border-t border-cap-line pt-3">
              {template.questions.map((q, idx) => (
                <div key={q.id} className="flex gap-3 text-sm">
                  <span className="text-cap-ink-2 font-bold shrink-0 w-6">
                    {idx + 1}.
                  </span>
                  <div>
                    <p className="font-medium text-cap-ink">{q.question}</p>
                    <span className="text-[11px] text-cap-ink-2 font-medium px-1.5 py-0.5 rounded bg-cap-cream-2 inline-block mt-0.5">
                      {q.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 选择分身 */}
        <div className="plush-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="block font-bold text-cap-ink text-sm">
                👥 选择个体分身
              </label>
              <p className="text-xs text-cap-ink-2 font-medium mt-1">
                已选择 {selectedPersonas.length}/1 个个体分身（仅显示有个体用户）
              </p>
            </div>
            {selectedPersonas.length > 0 && (
              <button
                onClick={() => setSelectedPersonas([])}
                className="text-xs font-bold text-cap-ink-2 hover:text-cap-ink transition-colors"
              >
                清空选择
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-cap-ink-2 font-medium text-sm">
              加载分身中...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {personas
                .filter((p) => p.id.startsWith('indiv_'))
                .map((p) => (
                  <PersonaSelectCard
                    key={p.id}
                    p={p}
                    selected={selectedPersonas.includes(p.id)}
                    onToggle={() => togglePersona(p.id)}
                  />
                ))}
            </div>
          )}
        </div>

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          disabled={!template || selectedPersonas.length === 0 || isLoading}
          className="w-full btn-plush btn-plush-mint py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '启动中...' : `🚀 开始问卷调研（${selectedPersonas.length} 个分身）`}
        </button>
      </div>
    </div>
  );
}
