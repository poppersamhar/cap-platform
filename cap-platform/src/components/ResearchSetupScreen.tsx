import { useState } from 'react';
import { store } from '../store/Store';

const FOCUS_DIMENSIONS = [
  { id: 'needs', label: '需求挖掘', emoji: '🎯' },
  { id: 'pain', label: '痛点识别', emoji: '⚡' },
  { id: 'config', label: '配置接受度', emoji: '🔧' },
  { id: 'price', label: '定价敏感度', emoji: '💰' },
  { id: 'competitor', label: '竞品认知', emoji: '🏁' },
  { id: 'decision', label: '决策因素', emoji: '🤔' },
];

export function ResearchSetupScreen() {
  const [topic, setTopic] = useState('');
  const [goals, setGoals] = useState('');
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['needs', 'pain', 'config', 'price']);

  const toggleDimension = (id: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    // 将研究目标临时存储到 store 中，后续 createSession 时传入
    store.setMode('research');
    store.setScreen('personaList');
    // 使用 localStorage 临时存储研究设置，供后续 createSession 使用
    try {
      localStorage.setItem('cap:research_topic', topic);
      localStorage.setItem('cap:research_goals', goals);
    } catch {
      // ignore
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

      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <div className="chip chip-mint mb-3">用户调研</div>
          <h2 className="text-3xl font-bold mb-2 text-cap-ink">定义研究目标</h2>
          <p className="text-cap-ink-2 font-medium">
            先明确你要研究什么，系统会据此推荐合适的客群分身
          </p>
        </div>

        {/* 研究主题 */}
        <div className="plush-lg p-6 mb-5">
          <label className="block font-bold text-cap-ink mb-2 text-sm">
            📝 研究主题
          </label>
          <p className="text-xs text-cap-ink-2 font-medium mb-3">
            一句话概括本次调研要回答的核心问题
          </p>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：新能源小型 SUV 配置接受度调研"
            className="w-full px-4 py-3 rounded-xl bg-cap-cream border border-cap-line text-sm font-medium text-cap-ink focus:outline-none focus:border-cap-mint focus:ring-2 focus:ring-cap-mint/10"
          />
        </div>

        {/* 研究目标 */}
        <div className="plush-lg p-6 mb-5">
          <label className="block font-bold text-cap-ink mb-2 text-sm">
            🎯 研究目标
          </label>
          <p className="text-xs text-cap-ink-2 font-medium mb-3">
            具体描述你要验证的问题、关注的维度、预期的决策支持
          </p>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="例如：了解目标用户对智能座舱配置的接受度，验证360全景影像是否为刚需，探索家庭用户对后排空间的敏感度..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-cap-cream border border-cap-line text-sm font-medium text-cap-ink focus:outline-none focus:border-cap-mint focus:ring-2 focus:ring-cap-mint/10 resize-none"
          />
        </div>

        {/* 关注维度 */}
        <div className="plush-lg p-6 mb-8">
          <label className="block font-bold text-cap-ink mb-3 text-sm">
            📊 关注维度（多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_DIMENSIONS.map((dim) => {
              const isSelected = selectedDimensions.includes(dim.id);
              return (
                <button
                  key={dim.id}
                  onClick={() => toggleDimension(dim.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-cap-mint text-white border-cap-mint'
                      : 'bg-cap-cream-2 text-cap-ink-2 border-cap-line hover:border-cap-mint/40'
                  }`}
                >
                  {dim.emoji} {dim.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 继续按钮 */}
        <button
          onClick={handleContinue}
          className="w-full btn-plush btn-plush-mint py-4 text-lg"
        >
          👥 下一步：选择目标客群
        </button>
      </div>
    </div>
  );
}
