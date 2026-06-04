import { useRef, useState } from 'react';
import { store, useKnowledgeSources, useLoading, useError } from '../store/Store';

export function KnowledgeScreen() {
  const sources = useKnowledgeSources();
  const isLoading = useLoading();
  const error = useError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = (file: File) => {
    store.uploadKnowledge(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => store.setScreen('home')}
            className="text-cap-ink-2 hover:text-cap-ink font-semibold text-lg transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="font-bold text-cap-ink text-lg">培训知识库</h1>
            <p className="text-xs text-cap-ink-2 font-medium">上传销售培训文档，AI 客户会从中学习提问</p>
          </div>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`plush-lg p-8 mb-6 text-center cursor-pointer transition-all ${
            dragOver ? 'bg-cap-butter-soft border-cap-butter scale-[1.01]' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cap-butter-soft flex items-center justify-center text-3xl">
            📤
          </div>
          <p className="text-cap-ink font-bold mb-1">
            {isLoading ? '正在处理文档...' : '点击或拖拽上传文档'}
          </p>
          <p className="text-cap-ink-2 text-xs font-medium">
            支持 PDF、Word、PPT、TXT、Markdown
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-cap-rose-soft border border-cap-rose text-cap-rose-deep text-sm font-bold">
            {error}
          </div>
        )}

        {/* Sources List */}
        <div className="plush-lg p-6">
          <h3 className="font-bold text-cap-ink mb-4 flex items-center gap-2">
            <span>📚</span> 已入库文档
            <span className="ml-auto text-xs text-cap-ink-2 font-medium">{sources.length} 个</span>
          </h3>

          {sources.length === 0 ? (
            <div className="text-center py-8 text-cap-ink-2">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-sm font-medium">暂无文档</p>
              <p className="text-xs mt-1">上传培训手册后，AI 客户会自动从中学习提问</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source}
                  className="flex items-center justify-between p-3 rounded-xl bg-cap-cream-2 border border-cap-line"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{fileIcon(source)}</span>
                    <span className="text-sm font-bold text-cap-ink truncate">{source}</span>
                  </div>
                  <button
                    onClick={() => store.deleteKnowledgeSource(source)}
                    disabled={isLoading}
                    className="text-cap-ink-2 hover:text-cap-rose-deep text-xs font-bold px-2 py-1 rounded-lg hover:bg-cap-rose-soft transition-colors shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-6 p-5 rounded-xl bg-cap-mint/10 border border-cap-mint/20">
          <h4 className="font-bold text-cap-ink text-sm mb-2">💡 文档上传建议</h4>
          <ul className="text-xs text-cap-ink-2 font-medium space-y-1.5">
            <li>• 话术手册：客户常见异议及标准回应话术</li>
            <li>• 竞品资料：与比亚迪、零跑等竞品的对比分析</li>
            <li>• 培训案例：真实销售对话中的成功/失败案例</li>
            <li>• 产品卖点：FAB 话术、配置差异说明</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function fileIcon(filename: string): string {
  const f = filename.toLowerCase();
  if (f.endsWith('.pdf')) return '📕';
  if (f.endsWith('.docx') || f.endsWith('.doc')) return '📘';
  if (f.endsWith('.pptx') || f.endsWith('.ppt')) return '📙';
  if (f.endsWith('.txt') || f.endsWith('.md')) return '📄';
  return '📎';
}
