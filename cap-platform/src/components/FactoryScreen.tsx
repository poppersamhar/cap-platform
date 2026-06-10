import { useState, useRef, useEffect, useCallback } from 'react';
import { store } from '../store/Store';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

type GenPersona = {
  id: string;
  profile: {
    name: string;
    age: number;
    gender: 'M' | 'F';
    city: string;
    occupation: string;
    family: string;
    current_car: string;
  };
  purchase: {
    budget_stated: string;
    budget_real: string;
    car_type: string;
    stage: string;
    timeline: string;
    usage_scenarios: string[];
  };
  pain_points: { topic: string; intensity: number; detail: string }[];
  hidden_info: { content: string; trigger_condition: string }[];
  objections: { content: string; trigger_topic: string; resistance: number }[];
  competitor_awareness: string;
  behavior: {
    anti_guide: number;
    price_sensitivity: number;
    expressiveness: number;
    decisiveness: number;
    tech_literacy: number;
  };
  communication: {
    style: string;
    description: string;
    speech_patterns: string[];
  };
  tags: string[];
  _cluster_title?: string;
  _cluster_stats?: {
    unique_customers: number;
    age_range: [number | null, number | null];
    top_concerns: [string, number][];
  };
  _source?: string;
};

type PipelinePhase = 'idle' | 'upload' | 'extract' | 'cluster' | 'synthesize' | 'preview';

const PHASES: { key: PipelinePhase; label: string; desc: string }[] = [
  { key: 'upload', label: '上传数据', desc: '解析 Excel 文件' },
  { key: 'extract', label: '特征抽取', desc: 'LLM 逐条提取客户特征' },
  { key: 'cluster', label: '智能聚类', desc: 'K-Means + Silhouette Score 选最优 K' },
  { key: 'synthesize', label: '合成典型', desc: 'LLM 生成典型客户分身' },
  { key: 'preview', label: '预览编辑', desc: '查看并编辑生成的分身' },
];

export function FactoryScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<PipelinePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<GenPersona[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GenPersona | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 模拟步骤推进（因为后端是单次长调用，前端通过定时器展示进度感）
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (phase === 'idle' || phase === 'upload' || phase === 'preview') {
      return;
    }
    const idx = PHASES.findIndex((p) => p.key === phase);
    setActiveStepIndex(Math.max(0, idx));
  }, [phase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
      setPersonas(null);
      setPhase('idle');
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setPhase('extract');
    setError(null);
    setPersonas(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch(`${API_BASE}/api/factory/generate`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setPersonas(data.personas || []);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
      setPhase('idle');
    }
  };

  const handleDownload = () => {
    if (!personas) return;
    const blob = new Blob([JSON.stringify(personas, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `typical_personas_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    if (!personas) return;
    setSaveStatus('saving');
    try {
      const resp = await fetch(`${API_BASE}/api/factory/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personas }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      setSaveStatus('saved');
      // eslint-disable-next-line no-console
      console.log(`已保存到系统`);
    } catch (e) {
      setSaveStatus('error');
      // eslint-disable-next-line no-console
      console.error('保存失败:', e);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPersonas(null);
    setError(null);
    setExpandedId(null);
    setEditingId(null);
    setEditDraft(null);
    setSaveStatus('idle');
    setPhase('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (p: GenPersona) => {
    setEditingId(p.id);
    setEditDraft(JSON.parse(JSON.stringify(p)));
    setExpandedId(p.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editDraft || !editingId) return;
    // 本地更新
    setPersonas((prev) =>
      prev ? prev.map((p) => (p.id === editingId ? editDraft : p)) : prev
    );
    setEditingId(null);
    setEditDraft(null);

    // 如果已保存到系统，同步更新后端
    if (saveStatus === 'saved') {
      try {
        await store.updateFactoryPersona(editingId, editDraft as any);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('同步更新后端失败:', e);
      }
    }
  };

  const updateDraft = useCallback((path: string, value: any) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let target: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const isBusy = phase === 'extract' || phase === 'cluster' || phase === 'synthesize';

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => store.setScreen('home')}
            className="text-cap-ink-2 hover:text-cap-ink text-sm font-semibold transition-colors"
          >
            ← 返回首页
          </button>
          <h2 className="text-xl font-bold text-cap-ink">分身工厂</h2>
          <div className="w-16" />
        </div>

        {/* Description */}
        <div className="plush-lg p-5 mb-6 bg-cap-sky-soft border border-cap-sky/20">
          <h3 className="font-bold text-cap-ink mb-2 flex items-center gap-2">
            <span className="text-lg">🏭</span> 从数据到典型客群
          </h3>
          <p className="text-sm text-cap-ink font-medium leading-relaxed">
            上传包含真实用户数据的 Excel 文件，AI 将自动完成：① LLM 特征抽取 → ② K-Means 聚类 → ③ 典型分身合成。
            支持加密 Excel 自动解密。生成后可在线编辑并保存到系统。
          </p>
        </div>

        {/* Stepper */}
        {isBusy && (
          <div className="plush-lg p-5 mb-6 bg-white border border-cap-line">
            <div className="flex items-center justify-between mb-4">
              {PHASES.map((step, idx) => (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                      idx < activeStepIndex
                        ? 'bg-cap-mint text-white'
                        : idx === activeStepIndex
                        ? 'bg-cap-sky text-white animate-pulse'
                        : 'bg-cap-line-light text-cap-ink-2'
                    }`}
                  >
                    {idx < activeStepIndex ? '✓' : idx + 1}
                  </div>
                  <span className="text-[10px] font-bold mt-1.5 text-cap-ink">{step.label}</span>
                  {idx < PHASES.length - 1 && (
                    <div
                      className={`h-0.5 w-full mt-2 transition-all duration-500 ${
                        idx < activeStepIndex ? 'bg-cap-mint' : 'bg-cap-line-light'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-cap-ink-2 font-medium">
              {PHASES[activeStepIndex]?.desc || '处理中...'} — 请耐心等待，数据量越大耗时越长
            </p>
          </div>
        )}

        {/* Upload Area */}
        {!personas && !isBusy && (
          <div className="plush-lg p-6 mb-6">
            <label className="block text-sm font-bold text-cap-ink mb-3">
              上传用户数据 Excel
            </label>
            <div
              className="border-2 border-dashed border-cap-line rounded-xl p-8 text-center cursor-pointer hover:border-cap-sky hover:bg-cap-sky-soft/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-4xl mb-3">📊</div>
              {file ? (
                <div>
                  <p className="font-bold text-cap-ink">{file.name}</p>
                  <p className="text-xs text-cap-ink-2 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-cap-ink">点击选择 Excel 文件</p>
                  <p className="text-xs text-cap-ink-2 mt-1">支持 .xlsx / .xls 格式（含加密文件）</p>
                </div>
              )}
            </div>

            {file && (
              <button
                onClick={handleGenerate}
                disabled={isBusy}
                className="w-full btn-plush btn-plush-peach py-3 mt-4"
              >
                {isBusy ? '生成中...' : '开始生成典型分身'}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="plush-lg p-5 mb-6 bg-cap-rose-soft border border-cap-rose/20">
            <p className="text-cap-rose-deep font-bold text-sm">❌ {error}</p>
          </div>
        )}

        {/* Results */}
        {personas && personas.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-cap-ink">
                成功生成 {personas.length} 个典型分身
              </p>
              <div className="flex gap-2 flex-wrap justify-end">
                {saveStatus !== 'saved' && (
                  <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-cap-mint text-white hover:bg-cap-mint/90 transition-colors disabled:opacity-50"
                  >
                    {saveStatus === 'saving' ? '保存中...' : '💾 保存到系统'}
                  </button>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <span className="px-4 py-2 rounded-lg text-xs font-bold bg-cap-mint-soft text-cap-mint-deep border border-cap-mint/20">
                      ✅ 已保存
                    </span>
                    <button
                      onClick={() => store.setScreen('personaList')}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-cap-sky text-white hover:bg-cap-sky/90 transition-colors"
                    >
                      👁️ 去查看
                    </button>
                  </>
                )}
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-cap-butter-soft text-cap-ink-2 border border-cap-line hover:bg-cap-butter transition-colors"
                >
                  ⬇️ 下载 JSON
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-cap-line text-cap-ink-2 hover:bg-cap-cream-2 transition-colors"
                >
                  重新上传
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {personas.map((p) => (
                <div key={p.id} className="plush-lg p-5">
                  {/* Card Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-cap-butter-soft flex items-center justify-center text-2xl">
                        {p.profile.gender === 'M' ? '👨' : '👩'}
                      </div>
                      <div>
                        <h4 className="font-bold text-cap-ink">
                          {p.profile.name}
                          {p._cluster_title && (
                            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-md bg-cap-sky-soft text-cap-sky-deep">
                              {p._cluster_title}
                            </span>
                          )}
                          {p._source === 'factory' && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cap-mint-soft text-cap-mint-deep border border-cap-mint/20">
                              工厂
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-cap-ink-2 font-medium">
                          {p.profile.age}岁 · {p.profile.city} · {p.profile.occupation}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p._cluster_stats && (
                        <span className="text-[10px] text-cap-ink-2 font-medium">
                          基于 {p._cluster_stats.unique_customers} 个真实用户
                        </span>
                      )}
                      <span
                        className="text-cap-ink-2 text-lg transition-transform"
                        style={{ transform: expandedId === p.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedId === p.id && (
                    <div className="mt-4 space-y-4 border-t border-cap-line pt-4">
                      {editingId === p.id && editDraft ? (
                        <EditForm draft={editDraft} onChange={updateDraft} />
                      ) : (
                        <ViewMode persona={p} />
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2 border-t border-cap-line">
                        {editingId === p.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="px-4 py-2 rounded-lg text-xs font-bold bg-cap-mint text-white hover:bg-cap-mint/90 transition-colors"
                            >
                              ✅ 保存修改
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-cap-line text-cap-ink-2 hover:bg-cap-cream-2 transition-colors"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="px-4 py-2 rounded-lg text-xs font-bold bg-cap-sky-soft text-cap-sky-deep border border-cap-sky/20 hover:bg-cap-sky/20 transition-colors"
                          >
                            ✏️ 编辑分身
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── View Mode (Read-only) ── */
function ViewMode({ persona: p }: { persona: GenPersona }) {
  return (
    <div className="space-y-4">
      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {p.tags.map((tag) => (
          <span key={tag} className="chip chip-butter text-xs">{tag}</span>
        ))}
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow label="性别" value={p.profile.gender === 'M' ? '男' : '女'} />
        <InfoRow label="年龄" value={`${p.profile.age}`} />
        <InfoRow label="城市" value={p.profile.city} />
        <InfoRow label="职业" value={p.profile.occupation} />
        <InfoRow label="家庭情况" value={p.profile.family} />
        <InfoRow label="现有车辆" value={p.profile.current_car} />
      </div>

      {/* Purchase */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow label="意向车型" value={p.purchase.car_type} />
        <InfoRow label="购车阶段" value={p.purchase.stage} />
        <InfoRow label="对外预算" value={p.purchase.budget_stated} />
        <InfoRow label="真实预算" value={p.purchase.budget_real} highlight />
        <InfoRow label="购车时间" value={p.purchase.timeline} />
      </div>

      {/* Usage Scenarios */}
      <div>
        <h5 className="text-xs font-bold text-cap-ink-2 uppercase mb-2">用车场景</h5>
        <div className="flex flex-wrap gap-2">
          {p.purchase.usage_scenarios.map((s, i) => (
            <span key={i} className="chip chip-sky text-xs">{s}</span>
          ))}
        </div>
      </div>

      {/* Pain Points */}
      <div>
        <h5 className="text-xs font-bold text-cap-ink-2 uppercase mb-2">核心痛点</h5>
        <div className="space-y-2">
          {p.pain_points.map((pp, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-cap-rose-soft border border-cap-line">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-cap-ink">{pp.topic}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-cap-rose-deep">
                  {Math.round(pp.intensity * 100)}%
                </span>
              </div>
              <p className="text-xs text-cap-ink-2 font-medium">{pp.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden Info */}
      <div>
        <h5 className="text-xs font-bold text-cap-ink-2 uppercase mb-2">隐藏信息</h5>
        <div className="space-y-2">
          {p.hidden_info.map((hi, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-cap-sky-soft border border-cap-line">
              <p className="text-sm font-medium text-cap-ink">{hi.content}</p>
              <p className="text-xs text-cap-ink-2 font-medium mt-1">触发: {hi.trigger_condition}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Objections */}
      <div>
        <h5 className="text-xs font-bold text-cap-ink-2 uppercase mb-2">常见异议</h5>
        <div className="space-y-2">
          {p.objections.map((obj, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-cap-butter-soft border border-cap-line">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-cap-ink">{obj.content}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-cap-butter-deep">
                  抗性 {Math.round(obj.resistance * 100)}%
                </span>
              </div>
              <p className="text-xs text-cap-ink-2 font-medium">触发话题: {obj.trigger_topic}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor */}
      <div className="p-3 rounded-lg bg-cap-cream-2 border border-cap-line">
        <span className="text-xs font-bold text-cap-ink-2 uppercase block mb-1">竞品认知</span>
        <p className="text-cap-ink font-medium text-sm">{p.competitor_awareness}</p>
      </div>

      {/* Communication */}
      <div className="p-3 rounded-lg bg-cap-cream-2 border border-cap-line">
        <span className="text-xs font-bold text-cap-ink-2 uppercase block mb-1">沟通风格</span>
        <p className="text-cap-ink font-medium text-sm">{p.communication.style}</p>
        <p className="text-cap-ink-2 text-xs font-medium mt-1">{p.communication.description}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {p.communication.speech_patterns.map((sp, i) => (
            <span key={i} className="chip chip-butter text-xs">「{sp}」</span>
          ))}
        </div>
      </div>

      {/* Behavior */}
      <div>
        <h5 className="text-xs font-bold text-cap-ink-2 uppercase mb-2">行为倾向</h5>
        <div className="space-y-2">
          <BehaviorBar label="反引导意识" value={p.behavior.anti_guide} />
          <BehaviorBar label="价格敏感度" value={p.behavior.price_sensitivity} />
          <BehaviorBar label="表达欲" value={p.behavior.expressiveness} />
          <BehaviorBar label="决策果断度" value={p.behavior.decisiveness} />
          <BehaviorBar label="技术理解力" value={p.behavior.tech_literacy} />
        </div>
      </div>
    </div>
  );
}

/* ── Edit Mode ── */
function EditForm({
  draft,
  onChange,
}: {
  draft: GenPersona;
  onChange: (path: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-cap-sky-soft border border-cap-sky/20 mb-2">
        <p className="text-xs font-bold text-cap-sky-deep">✏️ 编辑模式 — 直接修改下方字段</p>
      </div>

      {/* Basic Profile */}
      <Section title="基本信息">
        <div className="grid grid-cols-2 gap-2">
          <TextInput label="姓名" value={draft.profile.name} onChange={(v) => onChange('profile.name', v)} />
          <NumberInput label="年龄" value={draft.profile.age} onChange={(v) => onChange('profile.age', v)} />
          <SelectInput
            label="性别"
            value={draft.profile.gender}
            options={[
              { value: 'M', label: '男' },
              { value: 'F', label: '女' },
            ]}
            onChange={(v) => onChange('profile.gender', v)}
          />
          <TextInput label="城市" value={draft.profile.city} onChange={(v) => onChange('profile.city', v)} />
          <TextInput label="职业" value={draft.profile.occupation} onChange={(v) => onChange('profile.occupation', v)} />
          <TextInput label="家庭情况" value={draft.profile.family} onChange={(v) => onChange('profile.family', v)} />
          <TextInput label="现有车辆" value={draft.profile.current_car} onChange={(v) => onChange('profile.current_car', v)} />
        </div>
      </Section>

      {/* Purchase */}
      <Section title="购车画像">
        <div className="grid grid-cols-2 gap-2">
          <TextInput label="意向车型" value={draft.purchase.car_type} onChange={(v) => onChange('purchase.car_type', v)} />
          <TextInput label="购车阶段" value={draft.purchase.stage} onChange={(v) => onChange('purchase.stage', v)} />
          <TextInput label="对外预算" value={draft.purchase.budget_stated} onChange={(v) => onChange('purchase.budget_stated', v)} />
          <TextInput label="真实预算" value={draft.purchase.budget_real} onChange={(v) => onChange('purchase.budget_real', v)} />
          <TextInput label="购车时间" value={draft.purchase.timeline} onChange={(v) => onChange('purchase.timeline', v)} />
        </div>
        <TextArea
          label="用车场景（每行一个）"
          value={draft.purchase.usage_scenarios.join('\n')}
          onChange={(v) => onChange('purchase.usage_scenarios', v.split('\n').filter((s) => s.trim()))}
          rows={3}
        />
      </Section>

      {/* Pain Points */}
      <Section title="核心痛点">
        {draft.pain_points.map((pp, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-cap-rose-soft/50 border border-cap-line">
            <div className="col-span-3">
              <TextInput label="主题" value={pp.topic} onChange={(v) => {
                const next = [...draft.pain_points];
                next[i] = { ...pp, topic: v };
                onChange('pain_points', next);
              }} />
            </div>
            <div className="col-span-2">
              <NumberInput label="强度(0-1)" value={pp.intensity} step={0.05} onChange={(v) => {
                const next = [...draft.pain_points];
                next[i] = { ...pp, intensity: v };
                onChange('pain_points', next);
              }} />
            </div>
            <div className="col-span-6">
              <TextInput label="详情" value={pp.detail} onChange={(v) => {
                const next = [...draft.pain_points];
                next[i] = { ...pp, detail: v };
                onChange('pain_points', next);
              }} />
            </div>
            <div className="col-span-1">
              <button
                onClick={() => {
                  const next = draft.pain_points.filter((_, idx) => idx !== i);
                  onChange('pain_points', next);
                }}
                className="w-full py-2 rounded-lg text-xs font-bold bg-cap-rose-soft text-cap-rose-deep hover:bg-cap-rose/20 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            onChange('pain_points', [
              ...draft.pain_points,
              { topic: '新痛点', intensity: 0.5, detail: '' },
            ]);
          }}
          className="w-full py-2 rounded-lg text-xs font-bold bg-cap-sky-soft text-cap-sky-deep border border-cap-sky/20 hover:bg-cap-sky/20 transition-colors"
        >
          + 添加痛点
        </button>
      </Section>

      {/* Tags */}
      <Section title="标签">
        <TextArea
          label="标签（逗号分隔）"
          value={draft.tags.join('，')}
          onChange={(v) => onChange('tags', v.split(/[,，]/).map((s) => s.trim()).filter(Boolean))}
          rows={2}
        />
      </Section>

      {/* Communication */}
      <Section title="沟通风格">
        <TextInput label="风格" value={draft.communication.style} onChange={(v) => onChange('communication.style', v)} />
        <TextArea label="描述" value={draft.communication.description} onChange={(v) => onChange('communication.description', v)} rows={2} />
        <TextArea
          label="口头禅（每行一个）"
          value={draft.communication.speech_patterns.join('\n')}
          onChange={(v) => onChange('communication.speech_patterns', v.split('\n').map((s) => s.trim()).filter(Boolean))}
          rows={2}
        />
      </Section>

      {/* Behavior */}
      <Section title="行为倾向 (0-1)">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="反引导意识" value={draft.behavior.anti_guide} step={0.05} onChange={(v) => onChange('behavior.anti_guide', v)} />
          <NumberInput label="价格敏感度" value={draft.behavior.price_sensitivity} step={0.05} onChange={(v) => onChange('behavior.price_sensitivity', v)} />
          <NumberInput label="表达欲" value={draft.behavior.expressiveness} step={0.05} onChange={(v) => onChange('behavior.expressiveness', v)} />
          <NumberInput label="决策果断度" value={draft.behavior.decisiveness} step={0.05} onChange={(v) => onChange('behavior.decisiveness', v)} />
          <NumberInput label="技术理解力" value={draft.behavior.tech_literacy} step={0.05} onChange={(v) => onChange('behavior.tech_literacy', v)} />
        </div>
      </Section>
    </div>
  );
}

/* ── Reusable Form Components ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="text-xs font-bold text-cap-ink-2 uppercase mb-2">{title}</h5>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-cap-ink-2 uppercase mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-cap-line bg-white text-sm text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-sky/40"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-cap-ink-2 uppercase mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-cap-line bg-white text-sm text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-sky/40"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-cap-ink-2 uppercase mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-cap-line bg-white text-sm text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-sky/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-cap-ink-2 uppercase mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-2.5 py-1.5 rounded-lg border border-cap-line bg-white text-sm text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-sky/40 resize-none"
      />
    </div>
  );
}

/* ── Read-only helpers ── */
function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2.5 rounded-lg border border-cap-line ${highlight ? 'bg-cap-peach-soft' : 'bg-cap-cream-2'}`}>
      <span className="text-[10px] font-bold text-cap-ink-2 uppercase block mb-0.5">{label}</span>
      <span className="font-medium text-cap-ink text-sm">{value}</span>
    </div>
  );
}

function BehaviorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  let barColor = 'bg-cap-mint';
  if (value >= 0.7) barColor = 'bg-cap-rose';
  else if (value >= 0.4) barColor = 'bg-cap-butter';

  return (
    <div>
      <div className="flex justify-between items-end mb-1">
        <span className="text-sm font-medium text-cap-ink">{label}</span>
        <span className="text-xs font-bold text-cap-ink-2">{pct}%</span>
      </div>
      <div className="h-1.5 bg-cap-line-light rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
