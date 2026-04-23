import { useState } from 'react';
import {
  FileText,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Image,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';

interface ProjectFile {
  id: string;
  name: string;
  type: 'upload' | 'output';
  size: string;
  updatedAt: string;
}

const mockFiles: ProjectFile[] = [
  { id: 'f1', name: 'sales_q3.xlsx', type: 'upload', size: '2.3MB', updatedAt: '10:03' },
  { id: 'f2', name: 'region_data.csv', type: 'upload', size: '856KB', updatedAt: '昨天' },
  { id: 'f3', name: 'budget_notes.md', type: 'upload', size: '12KB', updatedAt: '3天前' },
  { id: 'o1', name: 'Q3营收对比图.png', type: 'output', size: '1.2MB', updatedAt: '10:06' },
  { id: 'o2', name: '分析报告.pdf', type: 'output', size: '3.5MB', updatedAt: '10:06' },
  { id: 'o3', name: '趋势数据.xlsx', type: 'output', size: '1.8MB', updatedAt: '10:05' },
];

function getFileIcon(name: string) {
  if (name.endsWith('.xlsx') || name.endsWith('.csv')) return FileSpreadsheet;
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return Image;
  if (name.endsWith('.md') || name.endsWith('.json')) return FileCode;
  return FileText;
}

export default function FilePanel({ projectId: _projectId }: { projectId: string }) {
  const [collapsed, setCollapsed] = useState(false);

  const uploads = mockFiles.filter((f) => f.type === 'upload');
  const outputs = mockFiles.filter((f) => f.type === 'output');

  return (
    <div
      className={`h-full flex flex-col bg-surface/80 backdrop-blur-md border-l border-border shrink-0 overflow-hidden ${
        collapsed ? 'w-8' : 'w-56'
      }`}
      style={{ transition: 'width 300ms ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0 h-[44px]">
        {!collapsed && (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <FolderOpen className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-text truncate">项目文件库</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1 hover:bg-bg rounded-md transition-colors shrink-0 ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed ? (
            <ChevronLeft className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* 上传文件 */}
          <div className="px-3 py-2.5 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-text-muted">上传文件</span>
              <button className="p-0.5 hover:bg-bg rounded transition-colors">
                <Upload className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-0.5">
              {uploads.map((f) => {
                const Icon = getFileIcon(f.name);
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg transition-colors cursor-pointer group"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-text truncate">{f.name}</div>
                      <div className="text-[10px] text-text-muted">{f.size}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border-light mx-3 shrink-0" />

          {/* 产物 */}
          <div className="px-3 py-2.5 flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-text-muted">产物</span>
              <button className="p-0.5 hover:bg-bg rounded transition-colors">
                <Download className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-0.5">
              {outputs.map((f) => {
                const Icon = getFileIcon(f.name);
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg transition-colors cursor-pointer group"
                  >
                    <Icon className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-text truncate">{f.name}</div>
                      <div className="text-[10px] text-text-muted">{f.size}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
