import { useEffect, useState } from 'react';
import type { SourceDialoguesData, SourceDialogue, SourceSummary } from '../types';
import { store } from '../store/Store';

interface Props {
  personaId: string;
  personaName: string;
  onClose: () => void;
}

export function SourceDialogueModal({ personaId, personaName, onClose }: Props) {
  const [data, setData] = useState<SourceDialoguesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dialogues' | 'summaries'>('dialogues');
  const [activeDialogueIdx, setActiveDialogueIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await store.loadSourceDialogues(personaId);
      if (cancelled) return;
      if (result) {
        setData(result);
      } else {
        setError('暂无原始对话数据');
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [personaId]);

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cap-ink/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cap-line">
          <div>
            <h3 className="text-lg font-bold text-cap-ink">
              📋 原始对话溯源
            </h3>
            <p className="text-xs text-cap-ink-2 font-medium">
              {personaName} · 客户ID: {data?.source_customer_id?.slice(0, 16) || '...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-cap-cream-2 border border-cap-line flex items-center justify-center text-cap-ink-2 hover:text-cap-ink hover:bg-cap-butter transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-3xl mb-2 animate-bounce">🔄</div>
                <p className="text-cap-ink-2 font-medium">加载原始对话...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center text-cap-rose-deep">
                <div className="text-3xl mb-2">⚠️</div>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          {data && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-cap-line px-6">
                <button
                  onClick={() => setActiveTab('dialogues')}
                  className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'dialogues'
                      ? 'border-cap-sky text-cap-sky-deep'
                      : 'border-transparent text-cap-ink-2 hover:text-cap-ink'
                  }`}
                >
                  原始对话 ({data.dialogues.length})
                </button>
                <button
                  onClick={() => setActiveTab('summaries')}
                  className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'summaries'
                      ? 'border-cap-sky text-cap-sky-deep'
                      : 'border-transparent text-cap-ink-2 hover:text-cap-ink'
                  }`}
                >
                  小结/标签 ({data.summaries.length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'dialogues' && (
                  <div className="space-y-4">
                    {/* Dialogue selector */}
                    {data.dialogues.length > 1 && (
                      <div className="flex gap-2 mb-4">
                        {data.dialogues.map((dia, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveDialogueIdx(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              activeDialogueIdx === idx
                                ? 'bg-cap-sky text-white'
                                : 'bg-cap-cream-2 text-cap-ink-2 hover:bg-cap-butter'
                            }`}
                          >
                            {dia.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {data.dialogues.length > 0 && (
                      <DialogueViewer dialogue={data.dialogues[activeDialogueIdx]} />
                    )}
                  </div>
                )}

                {activeTab === 'summaries' && (
                  <div className="space-y-4">
                    {data.summaries.map((sum, idx) => (
                      <SummaryCard key={idx} summary={sum} />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div className="px-6 py-3 border-t border-cap-line bg-cap-cream-2 text-xs text-cap-ink-2 font-medium">
                基于 {data.record_count} 条原始记录生成 · 此对话文档仅供训练参考，AI 扮演时会参考客户的真实表达习惯
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DialogueViewer({ dialogue }: { dialogue: SourceDialogue }) {
  const [expanded, setExpanded] = useState(false);
  const lines = dialogue.transcript.split('\n').filter(l => l.trim());
  const showAll = expanded || lines.length <= 100;
  const displayLines = showAll ? lines : lines.slice(0, 100);

  return (
    <div className="border border-cap-line rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-cap-butter-soft border-b border-cap-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {dialogue.type === 'outbound_call' ? '📞' : '🚗'}
          </span>
          <span className="font-bold text-cap-ink text-sm">{dialogue.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-cap-ink-2 font-medium">
          {dialogue.turn_count && <span>{dialogue.turn_count} 轮对话</span>}
          {dialogue.record_count && <span>{dialogue.record_count} 条记录</span>}
          <span>{lines.length} 行</span>
        </div>
      </div>
      <div className="p-4 bg-white max-h-[50vh] overflow-y-auto">
        <div className="space-y-0.5 text-sm leading-relaxed font-mono">
          {displayLines.map((line, i) => {
            const isCustomer = line.includes('[客户]');
            const isAdvisor = line.includes('[顾问]');
            return (
              <div
                key={i}
                className={`py-0.5 ${
                  isCustomer
                    ? 'text-cap-ink font-medium'
                    : isAdvisor
                    ? 'text-cap-ink-2'
                    : 'text-cap-ink-2'
                }`}
              >
                {line}
              </div>
            );
          })}
        </div>
        {!showAll && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-3 w-full py-2 rounded-lg bg-cap-cream-2 text-cap-ink-2 text-xs font-bold hover:bg-cap-butter transition-colors"
          >
            展开全部 {lines.length} 行对话
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ summary }: { summary: SourceSummary }) {
  const typeIcon = {
    call_summary: '📝',
    drive_summary: '🚗',
    concern_tags: '🏷️',
  }[summary.type] || '📄';

  const typeLabel = {
    call_summary: '通话小结',
    drive_summary: '试驾小结',
    concern_tags: '关注点标签',
  }[summary.type] || summary.title;

  return (
    <div className="border border-cap-line rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span>{typeIcon}</span>
        <span className="text-xs font-bold text-cap-ink-2 uppercase">{typeLabel}</span>
      </div>
      <div className="text-sm text-cap-ink font-medium leading-relaxed whitespace-pre-wrap">
        {summary.content}
      </div>
    </div>
  );
}
