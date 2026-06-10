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
  const isNew4X = p._source === '4x';
  const is4XIndividual = p._source === '4x_individual';
  return (
    <div className={`group p-5 plush-lg hover:-translate-y-0.5 transition-all duration-200 relative text-left ${isNew4X || is4XIndividual ? 'ring-2 ring-cap-mint/30' : ''}`}>
      {/* 类型角标 + 编辑按钮 */}
      {isTypical && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {!isNew4X && (
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
          )}
          {isNew4X && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cap-mint text-white tracking-wider animate-pulse">
              新
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cap-peach text-white tracking-wider">
            典型
          </span>
        </div>
      )}
      {/* 4X 个体用户角标 */}
      {is4XIndividual && (
        <div className="absolute top-3 right-3">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cap-mint text-white tracking-wider">
            4X
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

/* ── 可编辑的分组标题 ── */
function EditableGroupTitle({
  source,
  badge,
  badgeClass,
  defaultTitle,
}: {
  source: string;
  badge: string;
  badgeClass: string;
  defaultTitle: string;
}) {
  const groupNames = useStore((s) => s.personaGroupNames);
  const isLoading = useStore((s) => s.isLoading);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayName = groupNames[source] || defaultTitle;

  const startEdit = () => {
    setDraft(displayName);
    setEditing(true);
  };

  const save = async () => {
    if (draft.trim() && draft.trim() !== displayName) {
      await store.updatePersonaGroupName(source, draft.trim());
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>{badge}</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={save}
          className="text-sm font-bold text-cap-ink px-2 py-1 rounded border border-cap-sky bg-white focus:outline-none focus:ring-2 focus:ring-cap-sky/40"
          disabled={isLoading}
        />
        <button
          onClick={save}
          className="px-2 py-1 rounded text-[10px] font-bold bg-cap-mint text-white hover:bg-cap-mint/90"
        >
          保存
        </button>
        <button
          onClick={cancel}
          className="px-2 py-1 rounded text-[10px] font-bold bg-white border border-cap-line text-cap-ink-2 hover:bg-cap-cream-2"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-4 group/title">
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>{badge}</span>
      <h4 className="text-sm font-bold text-cap-ink">{displayName}</h4>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover/title:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[10px] font-bold bg-cap-sky-soft text-cap-sky-deep border border-cap-sky/20 hover:bg-cap-sky/20"
        title="修改分组名称"
      >
        ✏️
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

  const { typical, typical4x, typicalFactory, typicalOriginal, individual } = useMemo(() => {
    const t: Persona[] = [];
    const t4x: Persona[] = [];
    const tFactory: Persona[] = [];
    const tOrig: Persona[] = [];
    const i: Persona[] = [];
    for (const p of personas) {
      if (p.id.startsWith('typical_')) {
        t.push(p);
        if (p._source === '4x') t4x.push(p);
        else if (p._source === 'factory') tFactory.push(p);
        else tOrig.push(p);
      } else if (p.id.startsWith('indiv_')) i.push(p);
      else i.push(p); // fallback
    }
    return { typical: t, typical4x: t4x, typicalFactory: tFactory, typicalOriginal: tOrig, individual: i };
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

          {/* MG 4X 新客群 */}
          {typical4x.length > 0 && (
            <div className="mb-8">
              <EditableGroupTitle
                source="4x"
                badge="新"
                badgeClass="bg-cap-mint text-white"
                defaultTitle="MG 4X 车型典型客群"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {typical4x.map((p) => (
                  <PersonaCard key={p.id} p={p} onSelect={handleSelect} onEdit={setEditingPersona} />
                ))}
              </div>
            </div>
          )}

          {/* 工厂生成客群 */}
          {typicalFactory.length > 0 && (
            <div className="mb-8">
              <EditableGroupTitle
                source="factory"
                badge="工厂"
                badgeClass="bg-cap-sky text-white tracking-wider"
                defaultTitle="数据工厂生成客群"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {typicalFactory.map((p) => (
                  <PersonaCard key={p.id} p={p} onSelect={handleSelect} onEdit={setEditingPersona} />
                ))}
              </div>
            </div>
          )}

          {/* MG4 原有典型客群 */}
          {typicalOriginal.length > 0 && (
            <div>
              <EditableGroupTitle
                source="mg4"
                badge="MG4"
                badgeClass="bg-cap-butter text-cap-ink tracking-wider"
                defaultTitle="MG4 车型典型客群"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {typicalOriginal.map((p) => (
                  <PersonaCard key={p.id} p={p} onSelect={handleSelect} onEdit={setEditingPersona} />
                ))}
              </div>
            </div>
          )}
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
