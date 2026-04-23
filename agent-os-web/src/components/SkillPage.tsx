import { useState, useRef, useEffect } from 'react';
import {
  Plus, ChevronDown, Sparkles, Upload, GitBranch,
  Database, Terminal, Search, BarChart3, MessageSquare,
  ClipboardList, Mail, FileText,
} from 'lucide-react';
import { skills } from '../data/mockData';

const skillIconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  's1': Database,
  's2': Terminal,
  's3': Search,
  's4': BarChart3,
  's5': MessageSquare,
  's6': ClipboardList,
  's7': Mail,
  's8': FileText,
};

interface SkillPageProps {
  selectedSkillId: string | null;
  onSelectSkill: (id: string | null) => void;
}

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  knowledge: { label: '知识工程', bg: 'bg-agent-host-subtle', text: 'text-agent-host' },
  governance: { label: '数据治理', bg: 'bg-success-subtle', text: 'text-success' },
  analysis: { label: '分析', bg: 'bg-warning-subtle', text: 'text-warning' },
  tool: { label: '通用工具', bg: 'bg-skill-subtle', text: 'text-skill' },
};

export default function SkillPage({ selectedSkillId, onSelectSkill }: SkillPageProps) {
  const [skillList] = useState(skills);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dropdownItems = [
    { icon: Sparkles, label: 'AI 构建' },
    { icon: Upload, label: '上传技能' },
    { icon: GitBranch, label: '从 GitHub 导入' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-text tracking-tight">Skills</h1>

          {/* Add Skill Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              添加技能
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg shadow-black/5 py-1.5 min-w-[180px] z-20 animate-fade-in">
                {dropdownItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setDropdownOpen(false);
                      alert(`${item.label} 功能开发中`);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-bg transition-colors text-left"
                  >
                    <item.icon className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Skill Grid */}
        <div className="grid grid-cols-3 gap-3">
          {skillList.map((skill) => {
            const cat = categoryConfig[skill.category];
            const isSelected = selectedSkillId === skill.id;
            const SkillIcon = skillIconMap[skill.id] || FileText;
            return (
              <div
                key={skill.id}
                onClick={() => onSelectSkill(skill.id)}
                className={`bg-surface border rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-primary/30 shadow-md shadow-primary/5 ring-1 ring-primary/10'
                    : 'border-border hover:border-primary/20 hover:shadow-sm'
                } ${!skill.enabled ? 'opacity-60' : ''}`}
              >
                {/* Top row: Icon + Name + Status + Tag */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-bg border border-border rounded-full flex items-center justify-center shrink-0">
                      <SkillIcon className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-text text-xs tracking-tight">{skill.name}</h3>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            skill.enabled ? 'bg-success' : 'bg-text-muted'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-[2px] rounded-full font-semibold ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                </div>

                {/* Properties list */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">来源</span>
                    <span className="text-text">{skill.source}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">作者</span>
                    <span className="text-text">{skill.author}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-text-muted leading-relaxed">{skill.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
