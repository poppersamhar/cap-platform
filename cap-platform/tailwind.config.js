/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── 上汽商务风格色板 ──
        // 背景使用 Ant Design 标准冷灰蓝，彻底避免暖色
        'cap-cream': '#F0F2F5',
        'cap-cream-2': '#F2F4F6',
        'cap-paper': '#FFFFFF',

        // 主色：上汽红系
        'cap-peach': '#C9232C',
        'cap-peach-deep': '#A81B23',
        'cap-peach-soft': '#FDF2F2',

        // 强调：MG橙系
        'cap-butter': '#FF6B00',
        'cap-butter-deep': '#E55A00',
        'cap-butter-soft': '#FFF5EB',

        // 成功/积极：科技青
        'cap-mint': '#00A896',
        'cap-mint-deep': '#008F7E',
        'cap-mint-soft': '#E6F7F5',

        // 信息：科技蓝
        'cap-sky': '#2563EB',
        'cap-sky-deep': '#1D4ED8',
        'cap-sky-soft': '#EFF6FF',

        // 危险/负面：玫瑰红（修正为真正偏冷的玫瑰色，而非琥珀）
        'cap-rose': '#D92B4B',
        'cap-rose-deep': '#B8203D',
        'cap-rose-soft': '#FEF2F2',

        // 文字层级
        'cap-ink': '#1A1A1A',
        'cap-ink-2': '#666666',
        'cap-ink-soft': '#999999',

        // 边框/分割线
        'cap-line': '#E5E5E5',
        'cap-line-light': '#F0F0F0',

        // Legacy aliases (保持兼容)
        'cap-bg': '#F8F9FA',
        'cap-surface': '#FFFFFF',
        'cap-surface-2': '#F5F5F7',
        'cap-border': '#E5E5E5',
        'cap-text': '#1A1A1A',
        'cap-text-muted': '#666666',
        'cap-primary': '#C9232C',
        'cap-primary-dim': '#FDF2F2',
        'cap-accent': '#00A896',
        'cap-accent-warm': '#FF6B00',
        'cap-accent-danger': '#D92B4B',
        'cap-accent-purple': '#2563EB',
      },
      borderRadius: {
        'plush': '16px',
        'plush-md': '12px',
        'plush-sm': '8px',
      },
      fontFamily: {
        'cozy': ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
        'elevated': '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
