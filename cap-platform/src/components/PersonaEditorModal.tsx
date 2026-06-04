import { useEffect, useState, useRef } from 'react';
import { store } from '../store/Store';
import type { Persona, PersonaProfile, PurchaseProfile, PainPoint, HiddenInfo, Objection, BehaviorParams, CommunicationStyle } from '../types';

type TabKey =
  | 'basic'
  | 'purchase'
  | 'pain'
  | 'objection'
  | 'hidden'
  | 'communication'
  | 'behavior'
  | 'competitor'
  | 'knowledge';

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'purchase', label: '购车画像' },
  { key: 'pain', label: '核心痛点' },
  { key: 'objection', label: '常见异议' },
  { key: 'hidden', label: '隐藏信息' },
  { key: 'communication', label: '沟通风格' },
  { key: 'behavior', label: '行为参数' },
  { key: 'competitor', label: '竞品认知' },
  { key: 'knowledge', label: '专属文档' },
];

interface Props {
  persona: Persona;
  onClose: () => void;
  onSave: (updated: Persona) => void;
}

export function PersonaEditorModal({ persona, onClose, onSave }: Props) {
  const [tab, setTab] = useState<TabKey>('basic');
  const [form, setForm] = useState<Persona>(() => {
    const base = JSON.parse(JSON.stringify(persona));
    return {
      ...base,
      pain_points: base.pain_points || [],
      hidden_info: base.hidden_info || [],
      objections: base.objections || [],
      behavior: base.behavior || {
        anti_guide: 50,
        price_sensitivity: 50,
        expressiveness: 50,
        decisiveness: 50,
        tech_literacy: 50,
      },
      communication: base.communication || {
        style: '',
        description: '',
        speech_patterns: [],
      },
      competitor_awareness: base.competitor_awareness || '',
      tags: base.tags || [],
    };
  });
  const [saving, setSaving] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'knowledge') {
      loadKnowledge();
    }
  }, [tab]);

  const loadKnowledge = async () => {
    setLoadingKnowledge(true);
    const sources = await store.loadPersonaKnowledgeSources(persona.id);
    setKnowledgeSources(sources);
    setLoadingKnowledge(false);
  };

  const handleUpload = async (file: File) => {
    await store.uploadPersonaKnowledge(persona.id, file);
    await loadKnowledge();
  };

  const handleDeleteSource = async (source: string) => {
    if (!confirm(`确定删除文档 "${source}" 吗？`)) return;
    await store.deletePersonaKnowledgeSource(persona.id, source);
    await loadKnowledge();
  };

  const updateProfile = (patch: Partial<PersonaProfile>) => {
    setForm((f) => ({ ...f, profile: { ...f.profile, ...patch } }));
  };

  const updatePurchase = (patch: Partial<PurchaseProfile>) => {
    setForm((f) => ({ ...f, purchase: { ...f.purchase, ...patch } }));
  };

  const updateBehavior = (patch: Partial<BehaviorParams>) => {
    setForm((f) => ({ ...f, behavior: { ...f.behavior, ...patch } }));
  };

  const updateCommunication = (patch: Partial<CommunicationStyle>) => {
    setForm((f) => ({ ...f, communication: { ...f.communication, ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl mx-4 bg-cap-cream rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-cap-line max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cap-line bg-white shrink-0">
          <div>
            <h3 className="font-bold text-cap-ink text-base">
              编辑分身 · {persona.profile.name}
            </h3>
            <p className="text-xs text-cap-ink-2 font-medium">仅典型用户支持编辑</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-cap-ink-2 hover:text-cap-rose-deep hover:bg-cap-rose-soft transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-cap-line bg-white shrink-0 px-2">
          {TAB_LABELS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                tab === t.key
                  ? 'border-cap-peach text-cap-peach'
                  : 'border-transparent text-cap-ink-2 hover:text-cap-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="姓名" value={form.profile.name} onChange={(v) => updateProfile({ name: v })} />
                <Field label="年龄" type="number" value={String(form.profile.age)} onChange={(v) => updateProfile({ age: Number(v) || 0 })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="性别"
                  value={form.profile.gender}
                  options={[
                    { value: 'M', label: '男' },
                    { value: 'F', label: '女' },
                  ]}
                  onChange={(v) => updateProfile({ gender: v as 'M' | 'F' })}
                />
                <Field label="城市" value={form.profile.city} onChange={(v) => updateProfile({ city: v })} />
              </div>
              <Field label="职业" value={form.profile.occupation} onChange={(v) => updateProfile({ occupation: v })} />
              <Field label="家庭情况" value={form.profile.family} onChange={(v) => updateProfile({ family: v })} />
              <Field label="现有车辆" value={form.profile.current_car} onChange={(v) => updateProfile({ current_car: v })} />
            </div>
          )}

          {tab === 'purchase' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="对外预算" value={form.purchase.budget_stated} onChange={(v) => updatePurchase({ budget_stated: v })} />
                <Field label="真实预算" value={form.purchase.budget_real} onChange={(v) => updatePurchase({ budget_real: v })} />
              </div>
              <Field label="意向车型" value={form.purchase.car_type} onChange={(v) => updatePurchase({ car_type: v })} />
              <Field label="购车阶段" value={form.purchase.stage} onChange={(v) => updatePurchase({ stage: v })} />
              <Field label="时间线" value={form.purchase.timeline} onChange={(v) => updatePurchase({ timeline: v })} />
              <ArrayField
                label="用车场景"
                items={form.purchase.usage_scenarios}
                onChange={(items) => updatePurchase({ usage_scenarios: items })}
                placeholder="例如：日常通勤、周末出游"
              />
            </div>
          )}

          {tab === 'pain' && (
            <ObjectArrayField<PainPoint>
              label="核心痛点"
              items={form.pain_points}
              onChange={(items) => setForm((f) => ({ ...f, pain_points: items }))}
              createEmpty={() => ({ topic: '', intensity: 50, detail: '' })}
              renderFields={(item, idx, update) => (
                <div className="space-y-2">
                  <Field label="主题" value={item.topic} onChange={(v) => update(idx, { ...item, topic: v })} />
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-cap-ink-2 w-12">强度</span>
                    <input
                      type="range" min={0} max={100} value={item.intensity}
                      onChange={(e) => update(idx, { ...item, intensity: Number(e.target.value) })}
                      className="flex-1 accent-cap-peach"
                    />
                    <span className="text-xs font-bold text-cap-ink w-8">{item.intensity}</span>
                  </div>
                  <TextArea label="详细描述" value={item.detail} onChange={(v) => update(idx, { ...item, detail: v })} />
                </div>
              )}
            />
          )}

          {tab === 'objection' && (
            <ObjectArrayField<Objection>
              label="常见异议"
              items={form.objections}
              onChange={(items) => setForm((f) => ({ ...f, objections: items }))}
              createEmpty={() => ({ content: '', trigger_topic: '', resistance: 50 })}
              renderFields={(item, idx, update) => (
                <div className="space-y-2">
                  <Field label="异议内容" value={item.content} onChange={(v) => update(idx, { ...item, content: v })} />
                  <Field label="触发主题" value={item.trigger_topic} onChange={(v) => update(idx, { ...item, trigger_topic: v })} />
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-cap-ink-2 w-12">抵触度</span>
                    <input
                      type="range" min={0} max={100} value={item.resistance}
                      onChange={(e) => update(idx, { ...item, resistance: Number(e.target.value) })}
                      className="flex-1 accent-cap-peach"
                    />
                    <span className="text-xs font-bold text-cap-ink w-8">{item.resistance}</span>
                  </div>
                </div>
              )}
            />
          )}

          {tab === 'hidden' && (
            <ObjectArrayField<HiddenInfo>
              label="隐藏信息"
              items={form.hidden_info}
              onChange={(items) => setForm((f) => ({ ...f, hidden_info: items }))}
              createEmpty={() => ({ content: '', trigger_condition: '' })}
              renderFields={(item, idx, update) => (
                <div className="space-y-2">
                  <Field label="内容" value={item.content} onChange={(v) => update(idx, { ...item, content: v })} />
                  <Field label="触发条件" value={item.trigger_condition} onChange={(v) => update(idx, { ...item, trigger_condition: v })} />
                </div>
              )}
            />
          )}

          {tab === 'communication' && (
            <div className="space-y-4">
              <Field label="风格标签" value={form.communication.style} onChange={(v) => updateCommunication({ style: v })} />
              <TextArea label="风格描述" value={form.communication.description} onChange={(v) => updateCommunication({ description: v })} />
              <ArrayField
                label="口头禅"
                items={form.communication.speech_patterns}
                onChange={(items) => updateCommunication({ speech_patterns: items })}
                placeholder="例如：说句实在话、我再看看"
              />
            </div>
          )}

          {tab === 'behavior' && (
            <div className="space-y-5">
              <SliderField label="抗引导性" value={form.behavior.anti_guide} onChange={(v) => updateBehavior({ anti_guide: v })} />
              <SliderField label="价格敏感度" value={form.behavior.price_sensitivity} onChange={(v) => updateBehavior({ price_sensitivity: v })} />
              <SliderField label="表达欲" value={form.behavior.expressiveness} onChange={(v) => updateBehavior({ expressiveness: v })} />
              <SliderField label="决策果断度" value={form.behavior.decisiveness} onChange={(v) => updateBehavior({ decisiveness: v })} />
              <SliderField label="科技素养" value={form.behavior.tech_literacy} onChange={(v) => updateBehavior({ tech_literacy: v })} />
            </div>
          )}

          {tab === 'competitor' && (
            <div className="space-y-4">
              <TextArea
                label="竞品认知"
                value={form.competitor_awareness}
                onChange={(v) => setForm((f) => ({ ...f, competitor_awareness: v }))}
                placeholder="该客户对竞品品牌的了解程度、偏好和对比"
              />
              <ArrayField
                label="标签"
                items={form.tags}
                onChange={(items) => setForm((f) => ({ ...f, tags: items }))}
                placeholder="例如：价格敏感、家庭导向"
              />
            </div>
          )}

          {tab === 'knowledge' && (
            <div className="space-y-4">
              <div className="plush-lg p-4 bg-cap-mint-soft border border-dashed border-cap-mint/30 text-center cursor-pointer hover:bg-cap-mint/10 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-2xl mb-1">📄</div>
                <p className="text-sm font-bold text-cap-ink">上传专属文档</p>
                <p className="text-xs text-cap-ink-2 font-medium mt-1">PDF / DOCX / PPTX / TXT / MD</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
              />

              {loadingKnowledge ? (
                <p className="text-center text-cap-ink-2 text-sm font-medium py-4">加载中...</p>
              ) : knowledgeSources.length === 0 ? (
                <p className="text-center text-cap-ink-2 text-sm font-medium py-4">暂无专属文档</p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-cap-ink mb-2">已上传文档</h4>
                  {knowledgeSources.map((source) => (
                    <div key={source} className="flex items-center justify-between p-3 rounded-xl bg-white border border-cap-line">
                      <span className="text-sm font-medium text-cap-ink truncate flex-1 mr-2">{source}</span>
                      <button
                        onClick={() => handleDeleteSource(source)}
                        className="px-2 py-1 rounded-md text-xs font-bold text-cap-rose-deep hover:bg-cap-rose-soft transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-cap-line bg-white shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-cap-line text-cap-ink-2 font-bold text-sm hover:bg-cap-cream-2 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-cap-peach text-white font-bold text-sm hover:bg-cap-peach/90 transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Field Components ── */

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-cap-ink-2 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-cap-line bg-white text-sm font-medium text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-peach/30"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-cap-ink-2 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-cap-line bg-white text-sm font-medium text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-peach/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-cap-ink-2 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 rounded-xl border border-cap-line bg-white text-sm font-medium text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-peach/30 resize-none"
      />
    </div>
  );
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-bold text-cap-ink-2">{label}</span>
        <span className="text-xs font-bold text-cap-ink">{value}</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cap-peach"
      />
    </div>
  );
}

function ArrayField({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const update = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onChange(next);
  };
  const add = () => onChange([...items, '']);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="block text-xs font-bold text-cap-ink-2 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => update(idx, e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-cap-line bg-white text-sm font-medium text-cap-ink focus:outline-none focus:ring-2 focus:ring-cap-peach/30"
            />
            <button
              onClick={() => remove(idx)}
              className="px-2 py-2 rounded-xl text-cap-rose-deep hover:bg-cap-rose-soft font-bold text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="px-3 py-2 rounded-xl border border-dashed border-cap-line text-cap-ink-2 text-xs font-bold hover:bg-cap-cream-2 transition-colors"
        >
          + 添加
        </button>
      </div>
    </div>
  );
}

function ObjectArrayField<T>({
  label,
  items,
  onChange,
  createEmpty,
  renderFields,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  createEmpty: () => T;
  renderFields: (item: T, idx: number, update: (i: number, val: T) => void) => React.ReactNode;
}) {
  const update = (idx: number, val: T) => {
    const next = [...items];
    next[idx] = val;
    onChange(next);
  };
  const add = () => onChange([...items, createEmpty()]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-cap-ink-2">{label}</label>
      {items.map((item, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-white border border-cap-line relative">
          <button
            onClick={() => remove(idx)}
            className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-cap-rose-deep hover:bg-cap-rose-soft text-xs font-bold transition-colors"
          >
            ✕
          </button>
          <div className="pr-6">{renderFields(item, idx, update)}</div>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full px-3 py-2.5 rounded-xl border border-dashed border-cap-line text-cap-ink-2 text-xs font-bold hover:bg-cap-cream-2 transition-colors"
      >
        + 添加{label}
      </button>
    </div>
  );
}
