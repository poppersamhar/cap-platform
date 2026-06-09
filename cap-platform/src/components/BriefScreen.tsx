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
  const isTypical = p.id.startsWith('typical_');

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => store.setScreen('personaList')}
          className="text-cap-ink-2 hover:text-cap-ink text-sm font-semibold mb-6 transition-colors"
        >
          ← 返回
        </button>

        {/* ── Header ── */}
        <div className="plush-lg p-6 mb-5 text-center relative">
          {isTypical && (
            <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cap-peach text-white tracking-wider">
              典型分身
            </span>
          )}
          <div className="w-20 h-20 mx-auto mb-3 rounded-xl bg-cap-butter-soft flex items-center justify-center text-4xl">
            {p.profile.gender === 'M' ? '👨' : '👩'}
          </div>
          <h2 className="text-2xl font-bold text-cap-ink">{p.profile.name}</h2>
          <p className="text-cap-ink-2 font-medium text-sm mt-1">
            {p.profile.age}岁 · {p.profile.city} · {p.profile.occupation}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {p.tags.map((tag) => (
              <span key={tag} className="chip chip-butter text-xs">{tag}</span>
            ))}
          </div>
        </div>

        {/* ── 目标提醒 ── */}
        <div className="plush-lg p-5 mb-5 bg-cap-mint-soft border border-cap-mint/20">
          <h3 className="font-bold text-cap-ink mb-2 flex items-center gap-2">
            <span className="text-lg">🎯</span> {isTraining ? '对练目标' : '访谈目标'}
          </h3>
          <p className="text-sm text-cap-ink font-medium leading-relaxed">
            {isTraining
              ? '通过对话了解客户需求，建立信任，处理异议，最终达成成交或获取明确的下一步行动。注意：不要过早报价，先挖需求。'
              : '通过深度访谈了解客户的真实需求、痛点、偏好和决策因素，输出结构化洞察。保持开放，不要引导。'}
          </p>
        </div>

        {/* ── 开始按钮 ── */}
        <button
          onClick={() => store.setScreen('encounter')}
          className="w-full btn-plush btn-plush-peach py-4 text-lg mb-8"
        >
          🚀 开始{isTraining ? '对练' : '访谈'}
        </button>

        {/* ── 隐藏信息（仅对练模式显示）── */}
        {isTraining && p.hidden_info.length > 0 && (
          <div className="plush-lg p-5 mb-5 border border-cap-rose/20">
            <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
              <span className="text-lg">🔓</span> 隐藏信息（不会主动透露）
            </h3>
            <div className="space-y-3">
              {p.hidden_info.map((hi, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-cap-rose-soft border border-cap-line">
                  <p className="text-sm font-medium text-cap-ink mb-1.5 leading-relaxed">
                    {hi.content}
                  </p>
                  <p className="text-xs text-cap-ink-2 font-medium">
                    <span className="text-cap-rose-deep font-semibold">触发条件：</span>
                    {hi.trigger_condition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 核心痛点 / 关注重点 ── */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">⚡</span> {isTraining ? '核心痛点' : '关注重点'}
          </h3>
          <div className="space-y-3">
            {p.pain_points.map((pp) => (
              <div key={pp.topic} className="p-3 rounded-xl bg-cap-rose-soft border border-cap-line">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-cap-ink text-sm">{pp.topic}</span>
                  <IntensityBadge value={pp.intensity} />
                </div>
                <p className="text-xs text-cap-ink-2 font-medium leading-relaxed">{pp.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 常见异议（仅对练模式显示）── */}
        {isTraining && (
          <div className="plush-lg p-5 mb-5">
            <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
              <span className="text-lg">🛡️</span> 常见异议
            </h3>
            <div className="space-y-3">
              {p.objections.map((obj, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-cap-butter-soft border border-cap-line">
                  <p className="text-sm font-medium text-cap-ink mb-1">「{obj.content}」</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-cap-ink-2 font-medium">
                      触发：{obj.trigger_topic}
                    </p>
                    <ResistanceBadge value={obj.resistance} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 沟通风格 ── */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">💬</span> 沟通风格
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-cap-cream-2 border border-cap-line">
              <span className="text-xs font-semibold text-cap-ink-2 uppercase block mb-1">风格标签</span>
              <p className="text-cap-ink font-medium text-sm">{p.communication.style}</p>
              <p className="text-cap-ink-2 text-xs font-medium mt-1">{p.communication.description}</p>
            </div>
          </div>
        </div>

        {/* ── 行为倾向（仅对练模式显示）── */}
        {isTraining && (
          <div className="plush-lg p-5 mb-5">
            <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
              <span className="text-lg">📊</span> 行为倾向
            </h3>
            <div className="space-y-3">
              <BehaviorBar label="反引导意识" value={p.behavior.anti_guide} desc="抗拒被销售话术引导的程度" />
              <BehaviorBar label="价格敏感度" value={p.behavior.price_sensitivity} desc="对价格和优惠的关注程度" />
              <BehaviorBar label="表达欲" value={p.behavior.expressiveness} desc="主动表达需求和想法的倾向" />
              <BehaviorBar label="决策果断度" value={p.behavior.decisiveness} desc="做购买决策的速度和果断程度" />
              <BehaviorBar label="技术理解力" value={p.behavior.tech_literacy} desc="对车辆技术参数的理解能力" />
            </div>
          </div>
        )}

        {/* ── 购车画像 ── */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">🚗</span> 购车画像
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="意向车型" value={p.purchase.car_type} />
            <InfoRow label="购车阶段" value={p.purchase.stage} />
            <InfoRow label="对外预算" value={p.purchase.budget_stated} />
            <InfoRow label="心理真实预算" value={p.purchase.budget_real} highlight />
            <InfoRow label="购车时间" value={p.purchase.timeline} />
          </div>
          <div className="mt-3 p-3 rounded-xl bg-cap-cream-2 border border-cap-line">
            <span className="text-xs font-semibold text-cap-ink-2 uppercase">用车场景</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {p.purchase.usage_scenarios.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium bg-cap-mint-soft border border-cap-mint/20 text-cap-mint-deep">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 竞品认知 ── */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">🏁</span> 竞品认知
          </h3>
          <p className="text-sm text-cap-ink font-medium leading-relaxed">
            {p.competitor_awareness}
          </p>
        </div>

        {/* ── 基本信息 ── */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-bold text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">👤</span> 基本信息
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="家庭情况" value={p.profile.family} />
            <InfoRow label="现有车辆" value={p.profile.current_car} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border border-cap-line ${highlight ? 'bg-cap-peach-soft' : 'bg-cap-cream-2'}`}>
      <span className="text-xs font-semibold text-cap-ink-2 uppercase block mb-0.5">{label}</span>
      <span className="font-medium text-cap-ink">{value}</span>
    </div>
  );
}

function IntensityBadge({ value }: { value: number }) {
  let color = 'bg-cap-mint-soft text-cap-mint-deep border-cap-mint/20';
  let label = '轻度';
  if (value >= 0.8) { color = 'bg-cap-rose-soft text-cap-rose-deep border-cap-rose/20'; label = '重度'; }
  else if (value >= 0.5) { color = 'bg-cap-butter-soft text-cap-butter-deep border-cap-butter/20'; label = '中度'; }
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${color}`}>
      {label} {Math.round(value * 100)}%
    </span>
  );
}

function ResistanceBadge({ value }: { value: number }) {
  let color = 'bg-cap-mint-soft text-cap-mint-deep border-cap-mint/20';
  let label = '低抵触';
  if (value >= 0.75) { color = 'bg-cap-rose-soft text-cap-rose-deep border-cap-rose/20'; label = '高抵触'; }
  else if (value >= 0.5) { color = 'bg-cap-butter-soft text-cap-butter-deep border-cap-butter/20'; label = '中抵触'; }
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${color}`}>
      {label}
    </span>
  );
}

function BehaviorBar({ label, value, desc }: { label: string; value: number; desc: string }) {
  const pct = Math.round(value * 100);
  let barColor = 'bg-cap-mint';
  if (value >= 0.7) barColor = 'bg-cap-rose';
  else if (value >= 0.4) barColor = 'bg-cap-butter';

  return (
    <div>
      <div className="flex justify-between items-end mb-1">
        <div>
          <span className="text-sm font-medium text-cap-ink">{label}</span>
          <span className="text-[10px] text-cap-ink-2 font-medium ml-2">{desc}</span>
        </div>
        <span className="text-xs font-bold text-cap-ink-2">{pct}%</span>
      </div>
      <div className="h-1.5 bg-cap-line-light rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
