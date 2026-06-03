import { useState, useRef, useCallback } from 'react';
import { store, useLoading, useError, usePreviewPersona } from '../store/Store';
import type { Persona } from '../types';

export function ImportPersonaScreen() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = useLoading();
  const error = useError();
  const preview = usePreviewPersona();

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      alert('请上传 .xlsx 或 .xls 格式的 Excel 文件');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    store.extractPersonaFromExcel(selectedFile);
  };

  if (preview) {
    return (
      <PreviewStep
        persona={preview}
        onBack={() => {
          store.setPreviewPersona(null);
          setSelectedFile(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => store.setScreen('personaList')}
          className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold mb-6 transition-colors"
        >
          ← 返回
        </button>

        <div className="mb-8">
          <h2 className="text-3xl font-black mb-2 text-cap-ink">导入客户分身</h2>
          <p className="text-cap-ink-2 font-semibold">
            上传包含客户基础信息和对话记录的 Excel 文件，AI 将自动提取客户画像
          </p>
        </div>

        {/* 拖拽上传区域 */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            plush-lg p-8 mb-5 text-center cursor-pointer transition-all
            border-[3px] border-dashed
            ${dragOver
              ? 'border-cap-sage bg-cap-sage/10 scale-[1.02]'
              : 'border-cap-line hover:border-cap-ink-2 hover:bg-cap-cream-2'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="text-5xl mb-4">📊</div>
          <h3 className="font-black text-cap-ink mb-2">
            {dragOver ? '松开即可上传' : '点击或拖拽上传 Excel'}
          </h3>
          <p className="text-xs text-cap-ink-2 font-semibold">
            支持 .xlsx / .xls 格式，文件大小建议不超过 5MB
          </p>
        </div>

        {/* 已选文件 */}
        {selectedFile && (
          <div className="plush-lg p-4 mb-5 bg-cap-sage/10 border-[2.5px] border-cap-sage">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="font-bold text-cap-ink text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-cap-ink-2 font-semibold">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="text-cap-rose-deep hover:text-cap-rose text-sm font-bold"
              >
                移除
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="plush-lg p-4 mb-5 border-[3px] border-cap-rose-deep bg-cap-rose/10">
            <p className="text-sm font-bold text-cap-rose-deep">❌ {error}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isLoading || !selectedFile}
          className="w-full btn-plush btn-plush-peach py-4 text-lg mb-8 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🔄</span> AI 正在分析数据...
            </span>
          ) : (
            '🔍 提取客户画像'
          )}
        </button>

        {/* Excel 格式说明 */}
        <div className="plush-lg p-5 bg-cap-cream-2">
          <h4 className="font-black text-cap-ink mb-3 text-sm">💡 Excel 格式说明</h4>
          <div className="text-xs text-cap-ink-2 font-semibold space-y-2 leading-relaxed">
            <p>Excel 文件中可以包含以下工作表（Sheet）：</p>
            <ul className="space-y-1.5 ml-4 list-disc">
              <li><span className="text-cap-ink font-bold">客户基础信息表</span>：姓名、年龄、性别、城市、职业、预算、车型偏好等</li>
              <li><span className="text-cap-ink font-bold">销售对话记录表</span>：销售话术、客户回复等（列名含"销售""客户"即可自动识别）</li>
            </ul>
            <p className="mt-2">系统会自动识别工作表类型并提取信息，生成完整的客户数字分身。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStep({
  persona,
  onBack,
}: {
  persona: Persona;
  onBack: () => void;
}) {
  const p = persona;

  const handleTest = () => {
    store.setMode('training');
    const tempId = `temp_${p.id}`;
    const tempPersona = { ...p, id: tempId };
    store.createSession(tempId, 'training', tempPersona as Persona);
  };

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold transition-colors"
          >
            ← 返回
          </button>
        </div>

        {/* Header */}
        <div className="plush-lg p-6 mb-5 text-center relative">
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

        {/* 隐藏信息 */}
        {p.hidden_info.length > 0 && (
          <div className="plush-lg p-5 mb-5 border-[3px] border-cap-rose-deep">
            <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
              <span className="text-lg">🔓</span> 隐藏信息（不会主动透露）
            </h3>
            <div className="space-y-3">
              {p.hidden_info.map((hi, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-cap-rose/15 border-[2.5px] border-cap-line">
                  <p className="text-sm font-bold text-cap-ink mb-1.5 leading-relaxed">{hi.content}</p>
                  <p className="text-xs text-cap-ink-2 font-semibold">
                    <span className="text-cap-rose-deep font-black">触发条件：</span>{hi.trigger_condition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 核心痛点 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">⚡</span> 核心痛点
          </h3>
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

        {/* 常见异议 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">🛡️</span> 常见异议
          </h3>
          <div className="space-y-3">
            {p.objections.map((obj, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-cap-butter/30 border-[2.5px] border-cap-line">
                <p className="text-sm font-bold text-cap-ink mb-1">「{obj.content}」</p>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-cap-ink-2 font-semibold">触发：{obj.trigger_topic}</p>
                  <ResistanceBadge value={obj.resistance} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 沟通风格 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">💬</span> 沟通风格
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
              <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-1">风格标签</span>
              <p className="text-cap-ink font-bold text-sm">{p.communication.style}</p>
              <p className="text-cap-ink-2 text-xs font-semibold mt-1">{p.communication.description}</p>
            </div>
            <div className="p-3 rounded-xl bg-cap-cream-2 border-[2.5px] border-cap-line">
              <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-2">口头禅</span>
              <div className="flex flex-wrap gap-2">
                {p.communication.speech_patterns.map((sp) => (
                  <span key={sp} className="px-2.5 py-1 rounded-full text-xs font-bold bg-cap-sky border-[2px] border-cap-line" style={{ boxShadow: '0 1px 0 #2B1E16' }}>
                    「{sp}」
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 行为倾向 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
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

        {/* 购车画像 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">🚗</span> 购车画像
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="意向车型" value={p.purchase.car_type} />
            <InfoRow label="购车阶段" value={p.purchase.stage} />
            <InfoRow label="对外预算" value={p.purchase.budget_stated} />
            <InfoRow label="心理真实预算" value={p.purchase.budget_real} highlight />
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

        {/* 竞品认知 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">🏁</span> 竞品认知
          </h3>
          <p className="text-sm text-cap-ink font-semibold leading-relaxed">{p.competitor_awareness}</p>
        </div>

        {/* 基本信息 */}
        <div className="plush-lg p-5 mb-5">
          <h3 className="font-black text-cap-ink mb-3 flex items-center gap-2">
            <span className="text-lg">👤</span> 基本信息
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="家庭情况" value={p.profile.family} />
            <InfoRow label="现有车辆" value={p.profile.current_car} />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={handleTest}
            className="flex-1 btn-plush btn-plush-peach py-4 text-lg"
          >
            🚀 开始测试对练
          </button>
          <button
            onClick={onBack}
            className="flex-1 btn-plush btn-plush-sage py-4 text-lg"
          >
            🔄 重新上传
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border-[2.5px] border-cap-line ${highlight ? 'bg-cap-peach/20' : 'bg-cap-cream-2'}`}>
      <span className="text-xs font-extrabold text-cap-ink-2 uppercase block mb-0.5">{label}</span>
      <span className="font-bold text-cap-ink">{value}</span>
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

function ResistanceBadge({ value }: { value: number }) {
  let color = 'bg-cap-mint text-cap-ink';
  let label = '低抵触';
  if (value >= 0.75) { color = 'bg-cap-rose text-cap-ink'; label = '高抵触'; }
  else if (value >= 0.5) { color = 'bg-cap-butter text-cap-ink'; label = '中抵触'; }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border-[2px] border-cap-line ${color}`} style={{ boxShadow: '0 1px 0 #2B1E16' }}>
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
          <span className="text-sm font-bold text-cap-ink">{label}</span>
          <span className="text-[10px] text-cap-ink-2 font-semibold ml-2">{desc}</span>
        </div>
        <span className="text-xs font-black text-cap-ink-2">{pct}%</span>
      </div>
      <div className="h-2.5 bg-white rounded-full overflow-hidden border-[2px] border-cap-line shadow-[0_1px_0_#2B1E16]">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
