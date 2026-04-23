import {
  Zap, Bot, Layers, CheckCircle2, Activity,
} from 'lucide-react';
import { agents, workLines } from '../data/mockData';

// 模拟 Token 数据
const tokenData = agents.map(a => ({
  ...a,
  totalTokens: Math.floor(a.calls * (200 + Math.random() * 200)),
  todayTokens: Math.floor(Math.random() * 25000 + 8000),
}));

const maxTokens = Math.max(...tokenData.map(a => a.totalTokens));

const workLineTokenData = workLines.map(w => ({
  ...w,
  tokens: agents
    .filter(a => a.workLine === w.name)
    .reduce((sum, a) => sum + a.calls * 220, 0) + Math.floor(Math.random() * 80000),
}));

const weeklyTrend = [42, 58, 48, 72, 65, 85, 78];
const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const totalTokens = tokenData.reduce((s, a) => s + a.totalTokens, 0);
const onlineCount = agents.filter(a => a.status === 'online').length;
const activeWorkLines = workLines.filter(w => w.status === 'active').length;

function formatToken(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return Math.floor(n / 1000) + 'K';
  return String(n);
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' ? 'bg-success' :
    status === 'busy' ? 'bg-warning' : 'bg-text-muted';
  return <span className={`w-2 h-2 rounded-full ${color}`} />;
}

function TokenBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-border-light rounded-full h-[5px]">
        <div className="h-[5px] rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-text-muted w-12 text-right tabular-nums">{formatToken(value)}</span>
    </div>
  );
}

function WorkLineBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-border-light rounded-full h-[6px]">
        <div className="h-[6px] rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-text-muted w-12 text-right tabular-nums">{formatToken(value)}</span>
    </div>
  );
}

export default function Dashboard() {
  const maxWorkLineTokens = Math.max(...workLineTokenData.map(w => w.tokens));

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">

        {/* ── KPI 指标行 ── */}
        <div className="flex items-center gap-10 mb-10">
          {[
            { icon: Zap, value: formatToken(totalTokens), label: 'Token 总消耗' },
            { icon: Bot, value: `${onlineCount}/${agents.length}`, label: '在线员工' },
            { icon: Layers, value: String(activeWorkLines), label: '活跃项目' },
            { icon: CheckCircle2, value: '98%', label: '任务成功率' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-bg transition-colors cursor-default">
              <div className="w-9 h-9 rounded-lg bg-primary/[0.08] flex items-center justify-center">
                <item.icon className="w-[18px] h-[18px] text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-xl font-bold text-text tracking-tight tabular-nums">{item.value}</div>
                <div className="text-[11px] text-text-muted">{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 主体：左表格 + 右排行 ── */}
        <div className="flex gap-10 mb-10">

          {/* Agent Token 消耗表格 */}
          <div className="flex-[3]">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-primary" strokeWidth={1.8} />
              <h2 className="text-sm font-semibold text-text tracking-tight">Agent Token 消耗</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-[11px] font-medium text-text-muted uppercase tracking-wider">Agent</th>
                  <th className="pb-2 text-[11px] font-medium text-text-muted uppercase tracking-wider w-12">状态</th>
                  <th className="pb-2 text-[11px] font-medium text-text-muted uppercase tracking-wider w-32">项目</th>
                  <th className="pb-2 text-[11px] font-medium text-text-muted uppercase tracking-wider">Token 消耗</th>
                </tr>
              </thead>
              <tbody>
                {tokenData.map((agent) => (
                  <tr key={agent.id} className="border-b border-border-light hover:bg-bg transition-colors rounded-lg">
                    <td className="py-3 px-2 rounded-l-lg">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{agent.avatar}</span>
                        <span className="font-medium text-text">{agent.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <StatusDot status={agent.status} />
                    </td>
                    <td className="py-3 px-2 text-text-secondary text-xs">{agent.workLine}</td>
                    <td className="py-3 px-2 rounded-r-lg">
                      <TokenBar value={agent.totalTokens} max={maxTokens} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 项目消耗排行 + 占比 */}
          <div className="flex-[2] space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Layers className="w-4 h-4 text-primary" strokeWidth={1.8} />
                <h2 className="text-sm font-semibold text-text tracking-tight">项目消耗排行</h2>
              </div>
              <div className="space-y-3">
                {workLineTokenData
                  .sort((a, b) => b.tokens - a.tokens)
                  .map((wl) => (
                    <div key={wl.id} className="px-2 py-1.5 rounded-xl hover:bg-bg transition-colors cursor-default">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-text">{wl.name}</span>
                        <span className="text-[11px] text-text-muted tabular-nums">{formatToken(wl.tokens)}</span>
                      </div>
                      <WorkLineBar value={wl.tokens} max={maxWorkLineTokens} />
                    </div>
                  ))}
              </div>
            </div>

            {/* 消耗占比环形图 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-primary" strokeWidth={1.8} />
                <h2 className="text-sm font-semibold text-text tracking-tight">消耗占比</h2>
              </div>
              <div className="flex items-center gap-6">
                <svg viewBox="0 0 36 36" className="w-20 h-20 shrink-0">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-primary"
                    strokeDasharray="67, 100"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-primary/[0.15]"
                    strokeDasharray="33, 100"
                    strokeDashoffset="-67"
                  />
                </svg>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-xs text-text">主实例 67%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/[0.2]" />
                    <span className="text-xs text-text">克隆实例 33%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 底部：7 日趋势 ── */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-primary" strokeWidth={1.8} />
            <h2 className="text-sm font-semibold text-text tracking-tight">近 7 日 Token 消耗走势</h2>
          </div>
          <div className="flex items-end gap-4">
            {/* Sparkline */}
            <svg className="flex-1 h-20" viewBox="0 0 140 40" preserveAspectRatio="none">
              <polyline
                points="0,32 20,18 40,24 60,8 80,14 100,4 120,6 140,2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              />
              <polyline
                points="0,32 20,18 40,24 60,8 80,14 100,4 120,6 140,2"
                fill="currentColor"
                className="text-primary/[0.06]"
                stroke="none"
              />
            </svg>
          </div>
          <div className="flex justify-between mt-2 px-1">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-1 bg-primary rounded-full"
                  style={{ height: `${weeklyTrend[i] * 0.4}px`, opacity: 0.5 }}
                />
                <span className="text-[10px] text-text-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
