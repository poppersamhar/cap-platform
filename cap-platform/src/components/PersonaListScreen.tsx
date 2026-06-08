import { useEffect, useMemo, useState } from 'react';
import { store, useStore } from '../store/Store';
import type { Persona } from '../types';
import { PersonaEditorModal } from './PersonaEditorModal';

function PersonaCard({
  p,
  onSelect,
  onEdit,
}: {
  p: Persona;
  onSelect: (p: Persona) => void;
  onEdit?: (p: Persona) => void;
}) {
  const isTypical = p.id.startsWith('typical_');
  return (
    <div className="group p-5 plush-lg hover:-translate-y-0.5 transition-all duration-200 relative text-left">
      {/* 类型角标 + 编辑按钮 */}
      {isTypical && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(p);
            }}
            className="w-7 h-7 rounded-md bg-cap-butter-soft border border-cap-line flex items-center justify-center text-cap-ink-2 hover:text-cap-ink hover:bg-cap-butter transition-colors"
            title="编辑分身"
          >
            ⚙️
          </button>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cap-peach text-white tracking-wider">
            典型
          </span>
        </div>
      )}

      <button onClick={() => onSelect(p)} className="w-full text-left">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-cap-butter-soft flex items-center justify-center text-2xl">
            {p.profile.gender === 'M' ? '👨' : '👩'}
          </div>
          <div>
            <h3 className="font-bold text-cap-ink">{p.profile.name}</h3>
            <p className="text-xs text-cap-ink-2 font-medium">
              {p.profile.age}岁 · {p.profile.city} · {p.profile.occupation}
            </p>
          </div>
        </div>
        <p className="text-sm text-cap-ink-2 font-medium mb-3">
          {p.purchase.car_type} · {p.purchase.budget_stated}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {p.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cap-cream-2 border border-cap-line text-cap-ink-2"
            >
              {tag}
            </span>
          ))}
        </div>
      </button>
    </div>
  );
}

export function PersonaListScreen() {
  const personas = useStore((s) => s.personas);
  const isLoading = useStore((s) => s.isLoading);
  const mode = useStore((s) => s.mode);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  useEffect(() => {
    if (personas.length === 0) {
      store.loadPersonas();
    }
  }, []);

  const handleSelect = (persona: Persona) => {
    const isResearch = mode === 'research';
    let topic = '';
    let goals = '';
    if (isResearch) {
      try {
        topic = localStorage.getItem('cap:research_topic') || '';
        goals = localStorage.getItem('cap:research_goals') || '';
      } catch { /* ignore */ }
    }
    store.createSession(persona.id, mode!, {
      researchTopic: topic || undefined,
      researchGoals: goals || undefined,
    });
  };

  const { typical, individual } = useMemo(() => {
    const t: Persona[] = [];
    const i: Persona[] = [];
    for (const p of personas) {
      if (p.id.startsWith('typical_')) t.push(p);
      else if (p.id.startsWith('indiv_')) i.push(p);
      else i.push(p); // fallback
    }
    return { typical: t, individual: i };
  }, [personas]);

  return (
    <div className="min-h-screen px-8 py-12 bg-cap-cream">
      <button
        onClick={() => store.setScreen('home')}
        className="text-cap-ink-2 hover:text-cap-ink text-sm font-semibold mb-8 transition-colors"
      >
        ← 返回
      </button>

      <div className="mb-10">
        <h2 className="text-3xl font-bold mb-2 text-cap-ink">
          {mode === 'training' ? '选择客户分身' : '选择目标客群'}
        </h2>
        <p className="text-cap-ink-2 font-medium">
          {mode === 'training' ? '选择一位客户进行销售对练' : '选择一位代表性用户进行调研访谈'}
        </p>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-cap-ink-2 font-medium">
          <div className="text-4xl mb-3 animate-bounce">🔄</div>
          加载中...
        </div>
      )}

      {/* ── 典型用户 ── */}
      {typical.length > 0 && (
        <section className="mb-12">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-cap-ink">
              {mode === 'research' ? '推荐：典型客群' : '典型用户'}
            </h3>
            <p className="text-xs text-cap-ink-2 font-medium">
              {mode === 'research'
                ? '由同类客户数据聚类合成的代表性分身，适合作为调研样本'
                : '由同类客户数据聚类合成的代表性分身，可编辑配置和专属知识库'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {typical.map((p) => (
              <PersonaCard key={p.id} p={p} onSelect={handleSelect} onEdit={setEditingPersona} />
            ))}
          </div>
        </section>
      )}

      {/* ── 个体用户 ── */}
      {individual.length > 0 && mode === 'training' && (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-cap-ink">个体用户</h3>
              <p className="text-xs text-cap-ink-2 font-medium">
                由单个客户真实对话深度提取的一对一分身
              </p>
            </div>
            <button
              onClick={() => store.setScreen('importPersona')}
              className="px-4 py-2 rounded-xl bg-cap-mint text-white text-sm font-bold hover:bg-cap-mint/90 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>📥</span> 导入新用户
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {individual.map((p) => (
              <PersonaCard key={p.id} p={p} onSelect={handleSelect} />
            ))}
          </div>
        </section>
      )}

      {/* 编辑浮窗 */}
      {editingPersona && (
        <PersonaEditorModal
          persona={editingPersona}
          onClose={() => setEditingPersona(null)}
          onSave={async (updated) => {
            await store.updatePersona(updated.id, updated);
            setEditingPersona(null);
          }}
        />
      )}
    </div>
  );
}
