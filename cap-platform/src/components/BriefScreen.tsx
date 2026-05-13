import { store, useSession } from '../store/Store';

export function BriefScreen() {
  const session = useSession();

  if (!session) {
    store.setScreen('personaList');
    return null;
  }

  const p = session.persona;
  if (!p) {
    store.setScreen('personaList');
    return null;
  }

  const isTraining = session.mode === 'training';

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => store.setScreen('personaList')}
          className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold mb-6 transition-colors"
        >
          ← 返回
        </button>

        {/* Header Card */}
        <div className="plush-lg p-6 mb-5 text-center">
          <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-cap-butter border-[4px] border-cap-line flex items-center justify-center text-4xl shadow-[0_4px_0_#2B1E16]">
            {p.profile.gender === 'M' ? '👨' : '👩'}
          </div>
          <h2 className="text-2xl font-black text-cap-ink">{p.profile.name}</h2>
          <p className="text-cap-ink-2 font-bold text-sm mt-1">
            {p.profile.age}岁 · {p.profile.city} · {p.profile.occupation}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {p.tags.map((tag) => (
              <span key={tag} className="chip chip-butter text-xs">{tag}</span>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">👤 基本信息</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="家庭情况" value={p.profile.family} />
            <InfoRow label="现有车辆" value={p.profile.current_car} />
          </div>
        </div>

        {/* Purchase */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">🚗 购车需求</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="意向车型" value={p.purchase.car_type} />
            <InfoRow label="购车阶段" value={p.purchase.stage} />
            <InfoRow label="对外预算" value={p.purchase.budget_stated} />
            <InfoRow label="购车时间" value={p.purchase.timeline} />
          </div>
          <div className="mt-3 p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
            <span className="text-xs font-extrabold text-cap-ink-2 uppercase">用车场景</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {p.purchase.usage_scenarios.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full text-xs font-bold bg-cap-mint border-[2px] border-cap-line" style={{ boxShadow: '0 1px 0 #2B1E16' }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Pain Points */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">⚡ 核心痛点</h3>
          <div className="space-y-3">
            {p.pain_points.map((pp) => (
              <div key={pp.topic} className="p-3 rounded-xl bg-cap-rose/20 border-[2.5px] border-cap-line">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-cap-ink text-sm">{pp.topic}</span>
                  <IntensityBadge value={pp.intensity} />
                </div>
                <p className="text-xs text-cap-ink-2 font-semibold leading-relaxed">{pp.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Objections */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">🛡️ 常见异议</h3>
          <div className="space-y-3">
            {p.objections.map((obj) => (
              <div key={obj.content} className="p-3 rounded-xl bg-cap-butter/30 border-[2.5px] border-cap-line">
                <p className="text-sm font-bold text-cap-ink mb-1">{obj.content}</p>
                <p className="text-xs text-cap-ink-2 font-semibold">触发话题：{obj.trigger_topic}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor & Communication */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">🧠 沟通策略</h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
              <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-1">竞品认知</span>
              <p className="text-cap-ink font-semibold">{p.competitor_awareness}</p>
            </div>
            <div className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
              <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-1">沟通风格</span>
              <p className="text-cap-ink font-semibold">{p.communication.style} · {p.communication.description}</p>
            </div>
            <div className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
              <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-1">口头禅</span>
              <div className="flex flex-wrap gap-2">
                {p.communication.speech_patterns.map((sp) => (
                  <span key={sp} className="px-2.5 py-1 rounded-full text-xs font-bold bg-cap-sky border-[2px] border-cap-line" style={{ boxShadow: '0 1px 0 #2B1E16' }}>"{sp}"</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Goal reminder */}
        <div className="plush-lg p-5 mb-6 bg-cap-mint-soft">
          <h3 className="font-black text-cap-ink mb-2 flex items-center gap-2">🎯 {isTraining ? '对练目标' : '访谈目标'}</h3>
          <p className="text-sm text-cap-ink font-semibold leading-relaxed">
            {isTraining
              ? '通过对话了解客户需求，建立信任，处理异议，最终达成成交或获取明确的下一步行动。注意：不要过早报价，先挖需求。'
              : '通过深度访谈了解客户的真实需求、痛点、偏好和决策因素，输出结构化洞察。保持开放，不要引导。'}
          </p>
        </div>

        <button
          onClick={() => store.setScreen('encounter')}
          className="w-full btn-plush btn-plush-peach py-4 text-lg mb-8"
        >
          🚀 开始{isTraining ? '对练' : '访谈'}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
      <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-0.5">{label}</span>
      <span className="text-cap-ink font-bold">{value}</span>
    </div>
  );
}

function IntensityBadge({ value }: { value: number }) {
  let color = 'bg-cap-mint';
  let label = '轻度';
  if (value >= 0.8) { color = 'bg-cap-rose'; label = '重度'; }
  else if (value >= 0.5) { color = 'bg-cap-butter'; label = '中度'; }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-black border-[2px] border-cap-line ${color}`} style={{ boxShadow: '0 1px 0 #2B1E16' }}>
      {label} {Math.round(value * 100)}%
    </span>
  );
}
