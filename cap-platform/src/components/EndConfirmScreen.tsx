import { store, useSession } from '../store/Store';

export function EndConfirmScreen() {
  const session = useSession();

  if (!session) {
    store.setScreen('home');
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-cap-cream"
    >
      <div className="max-w-md w-full plush-lg p-8 text-center animate-popin"
      >
        <div className="text-5xl mb-4 animate-wobble"
        >🤔</div>
        <h2 className="text-2xl font-black mb-2 text-cap-ink"
        >确认结束对话？</h2>
        <p className="text-cap-ink-2 text-sm font-semibold mb-8"
        >
          结束后将生成{session.mode === 'training' ? '销售能力评分报告' : '调研洞察报告'}
        </p>

        <div className="space-y-3"
        >
          <button
            onClick={() => store.endSession()}
            className="w-full btn-plush btn-plush-peach py-3 text-base"
          >
            📋 结束并查看报告
          </button>
          <button
            onClick={() => store.setScreen('encounter')}
            className="w-full btn-plush btn-plush-ghost py-3 text-base"
          >
            💬 继续对话
          </button>
        </div>
      </div>
    </div>
  );
}
