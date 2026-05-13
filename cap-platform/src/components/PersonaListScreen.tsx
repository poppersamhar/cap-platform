import { useEffect } from 'react';
import { store, useStore } from '../store/Store';
import type { Persona } from '../types';

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

  return (
    <div className="min-h-screen px-8 py-12 bg-cap-cream">
      <button
        onClick={() => store.setScreen('mode')}
        className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold mb-8 transition-colors"
      >
        ← 返回
      </button>

      <div className="mb-8">
        <h2 className="text-3xl font-black mb-2 text-cap-ink">选择客户分身</h2>
        <p className="text-cap-ink-2 font-semibold">
          {mode === 'training' ? '选择一位客户进行销售对练' : '选择一位用户进行调研访谈'}
        </p>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-cap-ink-2 font-bold">
          <div className="text-4xl mb-3 animate-bounce">🔄</div>
          加载中...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {personas.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p)}
            className="group p-5 plush-lg text-left hover:-translate-y-1 transition-transform duration-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-cap-butter border-[3px] border-cap-line flex items-center justify-center text-2xl shadow-[0_3px_0_#2B1E16]">
                {p.profile.gender === 'M' ? '👨' : '👩'}
              </div>
              <div>
                <h3 className="font-black text-cap-ink">{p.profile.name}</h3>
                <p className="text-xs text-cap-ink-2 font-bold">
                  {p.profile.age}岁 · {p.profile.city} · {p.profile.occupation}
                </p>
              </div>
            </div>
            <p className="text-sm text-cap-ink-2 font-semibold mb-3">
              {p.purchase.car_type} · {p.purchase.budget_stated}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {p.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-cap-cream-2 border-[2px] border-cap-line text-cap-ink"
                  style={{ boxShadow: '0 1px 0 #2B1E16' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
