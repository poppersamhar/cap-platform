import { store, useStore } from '../store/Store';

const steps = [
  {
    title: 'AI 客户分身',
    desc: '基于真实用户数据构建的数字分身，拥有完整的人设、购车需求、痛点和沟通风格。',
    icon: '🧸',
    chip: 'peach',
  },
  {
    title: '沉浸式对练',
    desc: '与 AI 客户进行真实的销售对话演练，覆盖到店接待、需求挖掘、异议处理、价格谈判全流程。',
    icon: '🎙️',
    chip: 'mint',
  },
  {
    title: '智能督导评分',
    desc: 'AI 督导实时评估你的销售表现，从客户洞察、需求适配、异议处理等维度给出专业反馈。',
    icon: '📋',
    chip: 'butter',
  },
];

export function OnboardingScreen() {
  const step = useStore((s) => s.onboardingStep);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-cap-cream">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex gap-3 mb-12">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-3 flex-1 rounded-full border-[2.5px] border-cap-line transition-colors duration-300 ${
                i <= step ? 'bg-cap-peach' : 'bg-white'
              }`}
              style={{ boxShadow: i <= step ? '0 2px 0 #2B1E16' : 'none' }}
            />
          ))}
        </div>

        {/* Content Card */}
        <div className="plush-lg p-8 mb-10 text-center animate-popin">
          <div className="text-6xl mb-4">{steps[step].icon}</div>
          <div className={`chip chip-${steps[step].chip} mx-auto mb-4`}>
            步骤 {step + 1} / {steps.length}
          </div>
          <h2 className="text-3xl font-black mb-4 text-cap-ink">{steps[step].title}</h2>
          <p className="text-cap-ink-2 text-lg leading-relaxed font-semibold">{steps[step].desc}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          {step > 0 && (
            <button
              onClick={() => store.setOnboardingStep(step - 1)}
              className="btn-plush btn-plush-ghost px-6 py-3 text-base"
            >
              ← 上一步
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => store.setOnboardingStep(step + 1)}
              className="btn-plush btn-plush-peach px-8 py-3 text-base ml-auto"
            >
              下一步 →
            </button>
          ) : (
            <button
              onClick={() => store.finishOnboarding()}
              className="btn-plush btn-plush-mint px-8 py-3 text-base ml-auto"
            >
              🚀 开始使用
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
