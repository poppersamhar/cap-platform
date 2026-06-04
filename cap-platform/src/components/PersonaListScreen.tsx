import { useEffect, useMemo } from 'react';
import { store, useStore } from '../store/Store';
import type { Persona } from '../types';

function PersonaCard({ p, onSelect }: { p: Persona; onSelect: (p: Persona) => void }) {
  const isTypical = p.id.startsWith('typical_');
  return (
    <button
      key={p.id}
      onClick={() => onSelect(p)}
      className="group p-5 plush-lg text-left hover:-translate-y-0.5 transition-all duration-200 relative"
    >
      {/* 类型角标 */}
      {isTypical && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cap-peach text-white tracking-wider">
          典型
        </span>
      )}

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
  );
}

export function PersonaListScreen() {
  const personas = useStore((s) => s.personas);
  const isLoading = useStore((s) => s.isLoading);
  const mode = useStore((s) => s.mode);

  useEffect(() => {
    if (personas.length === 0) {
      store.loadPersonas();
    }
  }, []);

  const handleSelect = (persona: Persona) => {
    store.createSession(persona.id, mode!);
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
        <h2 className="text-3xl font-bold mb-2 text-cap-ink">选择客户分身</h2>
        <p className="text-cap-ink-2 font-medium">
          {mode === 'training' ? '选择一位客户进行销售对练' : '选择一位用户进行调研访谈'}
        </p>
      </div>

      {/* ── 导入入口 ── */}
      <div className="plush-lg p-5 mb-10 bg-cap-mint-soft border border-dashed border-cap-mint/30 text-center cursor-pointer hover:bg-cap-mint/10 transition-colors"
        onClick={() => store.setScreen('importPersona')}
      >
        <div className="text-3xl mb-2">📥</div>
        <h3 className="font-bold text-cap-ink mb-1">导入新的客户分身</h3>
        <p className="text-xs text-cap-ink-2 font-medium">上传 Excel 文件，AI 自动提取客户画像</p>
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
            <h3 className="text-lg font-bold text-cap-ink">典型用户</h3>
            <p className="text-xs text-cap-ink-2 font-medium">
              由同类客户数据聚类合成的代表性分身
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {typical.map((p) => (
              <PersonaCard key={p.id} p={p} onSelect={handleSelect} />
            ))}
          </div>
        </section>
      )}

      {/* ── 个体用户 ── */}
      {individual.length > 0 && (
        <section>
          <div className="mb-5">
            <h3 className="text-lg font-bold text-cap-ink">个体用户</h3>
            <p className="text-xs text-cap-ink-2 font-medium">
              由单个客户真实对话深度提取的一对一分身
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {individual.map((p) => (
              <PersonaCard key={p.id} p={p} onSelect={handleSelect} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
