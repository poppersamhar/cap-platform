import { useState } from 'react';
import { store, useStore } from '../store/Store';
import type { PersonaSurveyReport } from '../types';

function downloadReport(report: PersonaSurveyReport, format: 'txt' | 'md') {
  const lines: string[] = [];
  if (format === 'md') {
    lines.push(`# ${report.persona_name} 的问卷调研报告`);
    lines.push('');
    lines.push(`生成时间: ${new Date(report.generated_at).toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    for (const ans of report.answers) {
      lines.push(`## ${ans.category}`);
      lines.push('');
      lines.push(`**问题:** ${ans.question}`);
      lines.push('');
      lines.push(`**回答:** ${ans.answer}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  } else {
    lines.push(`${report.persona_name} 的问卷调研报告`);
    lines.push(`生成时间: ${new Date(report.generated_at).toLocaleString()}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');
    for (const ans of report.answers) {
      lines.push(`【${ans.category}】`);
      lines.push(`Q: ${ans.question}`);
      lines.push(`A: ${ans.answer}`);
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    }
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.persona_name}_问卷报告.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAllReports(reports: PersonaSurveyReport[], format: 'txt' | 'md') {
  const lines: string[] = [];
  if (format === 'md') {
    lines.push('# 问卷调研综合报告');
    lines.push('');
    lines.push(`报告数量: ${reports.length} 份`);
    lines.push(`生成时间: ${new Date().toLocaleString()}`);
    lines.push('');
  } else {
    lines.push('问卷调研综合报告');
    lines.push(`报告数量: ${reports.length} 份`);
    lines.push(`生成时间: ${new Date().toLocaleString()}`);
    lines.push('');
  }

  for (const report of reports) {
    if (format === 'md') {
      lines.push(`# ${report.persona_name}`);
      lines.push('');
    } else {
      lines.push('='.repeat(50));
      lines.push(report.persona_name);
      lines.push('='.repeat(50));
      lines.push('');
    }
    for (const ans of report.answers) {
      if (format === 'md') {
        lines.push(`### ${ans.category}`);
        lines.push(`**Q:** ${ans.question}`);
        lines.push(`**A:** ${ans.answer}`);
        lines.push('');
      } else {
        lines.push(`【${ans.category}】`);
        lines.push(`Q: ${ans.question}`);
        lines.push(`A: ${ans.answer}`);
        lines.push('');
      }
    }
    lines.push('');
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `问卷调研综合报告.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SurveyResultScreen() {
  const survey = useStore((s) => s.currentSurvey);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'md'>('md');

  if (!survey || survey.reports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cap-cream">
        <div className="text-center">
          <p className="text-cap-ink-2 font-medium">暂无报告数据</p>
          <button
            onClick={() => store.setScreen('surveySetup')}
            className="mt-4 px-4 py-2 rounded-xl bg-cap-mint text-white text-sm font-bold"
          >
            返回配置
          </button>
        </div>
      </div>
    );
  }

  const reports = survey.reports;
  const activeReport = reports[activeTab];

  return (
    <div className="min-h-screen px-8 py-12 bg-cap-cream">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="chip chip-mint mb-3">问卷调研</div>
            <h2 className="text-3xl font-bold mb-2 text-cap-ink">调研结果</h2>
            <p className="text-cap-ink-2 font-medium text-sm">
              {survey.template.name} · 共 {reports.length} 份报告
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value as 'txt' | 'md')}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-cap-line text-cap-ink focus:outline-none"
            >
              <option value="md">Markdown</option>
              <option value="txt">纯文本</option>
            </select>
            <button
              onClick={() => downloadAllReports(reports, downloadFormat)}
              className="px-4 py-2 rounded-lg bg-cap-mint text-white text-xs font-bold hover:bg-cap-mint/90 transition-colors"
            >
              ⬇️ 下载全部
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {reports.map((report, idx) => (
            <button
              key={report.persona_id}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                idx === activeTab
                  ? 'bg-cap-mint text-white shadow-sm'
                  : 'bg-white border border-cap-line text-cap-ink-2 hover:border-cap-mint/40'
              }`}
            >
              <span className="mr-1">{idx + 1}.</span>
              {report.persona_name}
            </button>
          ))}
        </div>

        {/* Report Card */}
        <div className="plush-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-cap-line">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cap-butter-soft flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <h3 className="font-bold text-cap-ink text-lg">
                  {activeReport.persona_name}
                </h3>
                <p className="text-xs text-cap-ink-2 font-medium">
                  {activeReport.answers.length} 个问题已回答 ·
                  {new Date(activeReport.generated_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => downloadReport(activeReport, downloadFormat)}
              className="px-4 py-2 rounded-lg bg-cap-sky text-white text-xs font-bold hover:bg-cap-sky/90 transition-colors"
            >
              ⬇️ 下载本报告
            </button>
          </div>

          <div className="space-y-6">
            {activeReport.answers.map((ans, idx) => (
              <div key={ans.question_id} className="group">
                <div className="flex items-start gap-3 mb-2">
                  <span className="w-6 h-6 rounded-full bg-cap-mint-soft flex items-center justify-center text-[10px] font-bold text-cap-mint-deep shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-cap-ink-2 px-2 py-0.5 rounded bg-cap-cream-2">
                        {ans.category}
                      </span>
                    </div>
                    <p className="font-bold text-cap-ink text-sm mb-2">
                      {ans.question}
                    </p>
                    <div className="bg-cap-cream rounded-xl p-4 border border-cap-line">
                      <p className="text-sm text-cap-ink font-medium leading-relaxed whitespace-pre-wrap">
                        {ans.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => store.setScreen('surveySetup')}
            className="flex-1 px-6 py-3 rounded-xl bg-white border border-cap-line text-cap-ink-2 font-bold text-sm hover:bg-cap-cream-2 transition-colors"
          >
            📝 再跑一组
          </button>
          <button
            onClick={() => store.setScreen('home')}
            className="flex-1 px-6 py-3 rounded-xl bg-cap-mint text-white font-bold text-sm hover:bg-cap-mint/90 transition-colors"
          >
            🏠 返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
