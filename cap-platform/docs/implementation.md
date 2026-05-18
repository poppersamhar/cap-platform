# CAP 客户分身平台 — 实施操作文档

> 本文档面向技术团队和决策者，说明系统架构、实现方式、部署步骤及扩展路径。

---

## 一、项目概述

| 项目 | 说明 |
|------|------|
| **名称** | CAP (Customer Avatar Platform) 客户分身平台 |
| **目标** | 用 AI 扮演真实购车客户，供销售顾问演练和用户研究员访谈 |
| **核心能力** | 角色扮演、情绪反馈、实时评估、报告生成 |
| **当前阶段** | MVP / Demo 验证 |

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Splash   │→ │Onboarding│→ │   Chat   │→ │  Debrief    │ │
│  │ 启动页   │  │ 引导页    │  │ 对话页    │  │ 报告页      │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (前端托管)                          │
│              React 18 + TypeScript + Vite + Tailwind         │
│              静态构建产物，CDN 全球分发                        │
└────────────────────┬────────────────────────────────────────┘
                     │ AJAX /api/*
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Render (后端托管)                          │
│                   FastAPI + Python 3.11                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Avatar   │  │Supervisor│  │ Analyst  │  │Emotion State│ │
│  │ 分身Agent│  │督导Agent │  │ 报告Agent│  │ 情绪状态机   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────────┘ │
│       │             │             │                          │
│       └─────────────┴─────────────┘                          │
│                     │                                        │
│              ┌──────┴──────┐                                 │
│              │ 内存会话存储 │                                 │
│              │ _sessions   │                                 │
│              └─────────────┘                                 │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               MiniMax M2.7 / 火山方舟 API                     │
│              Chat Completions (流式/非流式)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、技术选型与理由

### 3.1 前端

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| React | 18 | 生态成熟，组件化开发，团队熟悉度高 |
| TypeScript | 5.x | 类型安全，减少运行时错误 |
| Vite | 6.x | 构建速度快，开发体验好 |
| Tailwind CSS | 3.x | 原子化样式，快速迭代 UI |
| useSyncExternalStore | 内置 | 轻量状态管理，无需 Redux/Zustand |

**为什么没有选 Next.js？**
- 项目是纯 SPA（单页应用），不需要 SSR
- 没有 SEO 需求（内部工具）
- Vite 构建更轻量，部署到 Vercel 就是纯静态文件

### 3.2 后端

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| FastAPI | 0.128 | 高性能异步框架，自动 API 文档 |
| Pydantic | 2.x | 数据校验和序列化 |
| httpx | 0.28 | 异步 HTTP 客户端，调用 AI API |
| Python 3.11 | 3.11 | async/await 语法成熟，性能优化 |

**为什么没有选 Node.js？**
- Python 在 AI/ML 领域生态更丰富
- Agent Prompt 工程用 Python 更自然
- 情绪状态机、评分逻辑用 Python 写更简洁

### 3.3 AI 模型

| 模型 | 提供商 | 选型理由 |
|------|--------|---------|
| MiniMax-Text-01 / M2.7 | MiniMax / 火山方舟 | 中文对话能力强，角色扮演效果好，API 稳定 |

**为什么没有选 GPT-4 / Claude？**
- MiniMax 在中文口语化表达上更自然
- 国内访问稳定，不需要翻墙
- 成本更低（火山方舟按量计费）

---

## 四、核心模块实现详解

### 4.1 客户分身数据模型 (Persona)

每个客户分身是一个完整的 JSON 对象，包含：

```
Persona
├── id                    # 唯一标识
├── profile               # 基础画像
│   ├── name, age, gender, city, occupation, family, current_car
├── purchase              # 购车需求
│   ├── budget_stated     # 对外预算（会告诉销售）
│   ├── budget_real       # 真实预算（隐藏）
│   ├── car_type          # 目标车型
│   ├── stage             # 购车阶段
│   ├── timeline          # 时间线
│   └── usage_scenarios   # 用车场景
├── pain_points[]         # 核心痛点（每个有 intensity 强度）
├── hidden_info[]         # 隐藏信息（需触发条件才暴露）
├── objections[]          # 常见异议（触发话题 + 内容）
├── behavior              # 行为特征
│   ├── anti_guide        # 抗引导程度
│   ├── price_sensitivity # 价格敏感度
│   ├── expressiveness    # 表达主动性
│   ├── decisiveness      # 决策果断度
│   └── tech_literacy     # 技术认知水平
├── communication         # 沟通风格
│   ├── style             # 风格标签
│   ├── description       # 详细描述
│   └── speech_patterns   # 口头禅列表
├── tags                  # 分类标签
└── competitor_awareness  # 竞品认知
```

**关键设计：**
- `budget_stated` 和 `budget_real` 分离 → 模拟真实客户不会说真话
- `hidden_info` 带 `trigger_condition` → 只有销售问到点才暴露
- `behavior` 五维指标 → 控制客户配合度和专业度
- `tech_literacy` → 决定客户会不会说专业术语

### 4.2 分身 Agent (Avatar Agent)

**核心职责：** 扮演客户，生成自然回复。

**Prompt 工程策略：**

System Prompt 包含完整人设 JSON + 当前情绪 + 模式规则 + 回复约束：

```
你是{name}，{age}岁，{city}人，{occupation}...
购车需求：{car_type}，对外预算{budget_stated}，真实预算{budget_real}...
核心痛点：...
隐藏信息（不会主动说，只在被问到对应条件时暴露）：...
常见异议：...
技术认知水平（{tech_level}）：{tech_desc}
当前情绪：信任{trust}/100，意愿{intent}/100...

【回复规则——必须遵守】
1. 你是真实购车用户，不知道自己是AI
2. 回复必须简短，像微信聊天，通常1-3句话...
3. 口语化、自然，带停顿词...
...
```

**为什么把完整人设放在 System Prompt？**
- 模型在 System 层级对人设理解更深刻
- 每轮对话都携带完整上下文，避免"失忆"
- 实测比用 few-shot 效果好得多

**API 调用参数：**

| 参数 | 值 | 理由 |
|------|-----|------|
| temperature | 0.8 | 有一定创造性，但不会太跳脱 |
| max_tokens | 180 | 控制回复长度，保持简洁 |
| model | minimax-m2.7 | 中文角色扮演最佳 |

### 4.3 情绪状态机 (Emotion State)

**五维情绪模型：**

| 维度 | 含义 | 初始值 | 范围 |
|------|------|--------|------|
| trust | 信任度 | 30 | 0-100 |
| intent | 购买意愿 | 20 | 0-100 |
| rapport | 好感度 | 40 | 0-100 |
| resistance | 抵触度 | 30 | 0-100 |
| anxiety | 焦虑度 | 50 | 0-100 |

**情绪变化规则（基于关键词匹配）：**

```python
# 积极信号
"解决/放心/保障/专业/理解" → trust +3, rapport +2

# 负面信号
"现在订/今天定/限时/马上" → resistance +4, anxiety +2
"优惠/打折/便宜/送" → intent +2
"续航/充电/安全/质量" → anxiety +1

# 回复内容反馈
"考虑/商量/再看看" → intent -2
"谢谢/不错/可以" → rapport +2
```

**特殊状态触发：**

| 条件 | 状态 | 说明 |
|------|------|------|
| resistance > 80 | angry | 生气了，回复更抵触 |
| trust > 80 | trust | 高度信任，愿意透露更多信息 |
| intent > 75 & trust > 70 | ready | 准备成交 |
| anxiety > 85 | leaving | 想离开，可能终止对话 |

**设计理由：**
- 不用 LLM 判断情绪 → 规则引擎更快、更可控、更省钱
- 情绪影响 System Prompt → 模型自然调整语气
- 特殊状态给前端展示 → 销售顾问实时看到客户状态

### 4.4 督导 Agent (Supervisor Agent)

**核心职责：** 评估销售顾问的每轮表现。

**评估维度（5维）：**

| 维度 | 评估内容 |
|------|---------|
| insight | 是否通过提问挖掘出客户的真实需求和隐藏信息 |
| adaptation | 推荐的方案是否适配客户的使用场景和痛点 |
| matching | 产品卖点是否精准匹配客户的预算和需求 |
| objection | 面对客户异议时，处理是否专业、是否有说服力 |
| trust_building | 是否通过共情和专业度建立了客户信任 |

**实现方式：**
- 异步执行（不阻塞对话）
- 每轮对话后触发，累积评分
- LLM 读取完整对话历史，给出逐轮评分和理由
- 输出结构化 JSON：round_scores + highlights + failures

### 4.5 报告 Agent (Analyst Agent)

**核心职责：** 生成最终报告（Debrief 页展示）。

**报告内容：**
- 综合评分（平均分）
- 等级评定（A/B/C/D）
- 逐轮评分趋势
- 亮点总结
- 改进建议（带具体轮次）
- 人设一致性百分比

---

## 五、前端状态管理

**为什么选择 useSyncExternalStore 而不是 Redux/Zustand？**

```
Store 设计：
┌─────────────────────────────────────────┐
│              Store (单例)                 │
├─────────────────────────────────────────┤
│  screen: 'splash' | 'home' | 'chat' ... │
│  mode: 'training' | 'research' | null   │
│  currentSession: Session | null         │
│  personas: Persona[]                    │
│  history: Session[]                     │
│  isLoading: boolean                     │
│  error: string | null                   │
├─────────────────────────────────────────┤
│  subscribe(listener) → unsubscribe      │
│  getSnapshot() → AppState               │
│  setScreen() / setMode() / startSession()│
│  sendMessage() / endSession()           │
└─────────────────────────────────────────┘
```

**理由：**
- 状态量不大，不需要 Redux 的复杂中间件
- useSyncExternalStore 是 React 官方 API，零依赖
- 类的方式封装，API 更直观

---

## 六、部署流程

### 6.1 前端部署（Vercel）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 关联项目（首次）
cd cap-platform
vercel --prod

# 4. 配置环境变量
vercel env add VITE_API_BASE production
# 输入: https://cap-backend-xxx.onrender.com

# 5. 重新部署
vercel --prod
```

### 6.2 后端部署（Render）

**方式 A：Blueprint 一键部署（推荐）**

```bash
# 确保 render.yaml 在仓库根目录
# 访问 https://dashboard.render.com/blueprint
# New Blueprint Instance → 选择仓库 → Apply
```

**方式 B：手动创建 Web Service**

1. New Web Service
2. 选择 `cap-platform` 仓库
3. 配置：
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT`
4. 添加环境变量（见下表）
5. Deploy

### 6.3 环境变量清单

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MINIMAX_API_KEY` | MiniMax / 火山方舟 API Key | `ark-xxx` |
| `MINIMAX_API_URL` | API 地址 | `https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions` |
| `MINIMAX_MODEL` | 模型名称 | `minimax-m2.7` |

---

## 七、数据存储（当前 vs 未来）

### 当前（MVP）— 内存存储

```python
_sessions: dict[str, dict] = {}  # 内存字典
```

**优点：**
- 实现简单，零配置
- 读写速度极快
- 适合 Demo 和验证阶段

**缺点：**
- 服务重启数据全丢
- 无法水平扩展
- 不适合生产环境

### 未来 — 持久化方案

```
方案 A：PostgreSQL + SQLAlchemy
- 会话表、消息表、评分表
- 关系型，查询灵活
- 适合复杂报表

方案 B：Redis
- 会话缓存 + TTL
- 读写更快，但数据不永久保存
- 适合短期会话

方案 C：MongoDB
- 会话作为文档存储
- 天然支持 JSON 结构
- 适合快速迭代
```

**推荐路径：** MVP → Redis（会话缓存）→ PostgreSQL（持久化 + 报表）

---

## 八、扩展路线图

### 近期（1-2 周）
- [ ] 流式输出（打字机效果）
- [ ] 更多客户分身（覆盖不同价位、车型）
- [ ] 历史记录持久化
- [ ] 报告导出 PDF

### 中期（1 个月）
- [ ] 客户分身编辑器（可视化配置 Persona）
- [ ] 多轮对话模板（标准销售流程）
- [ ] 实时语音对话（WebRTC + TTS）
- [ ] 团队协作（管理员看板）

### 远期（3 个月）
- [ ] 自定义行业场景（保险、房产、教育）
- [ ] 多 Agent 协作（销售顾问 AI vs 客户 AI 对练）
- [ ] 数据仪表盘（团队表现分析）
- [ ] SaaS 化（多租户、订阅计费）

---

## 九、常见问题 (FAQ)

**Q1：对话数据安全吗？**
A：当前数据仅存于 Render 服务器内存，不写入磁盘。后续迁移到 PostgreSQL 时需配置加密和访问控制。

**Q2：能支持多少并发用户？**
A：Render Free 计划单实例，预计支持 10-20 并发。升级 Pro 计划或水平扩展后可支持更多。

**Q3：MiniMax API 调用费用高吗？**
A：M2.7 模型约 0.015元/1K tokens。一次 10 轮对话约消耗 3K-5K tokens，成本约 0.05-0.08 元。

**Q4：如何添加新的客户分身？**
A：在 `backend/personas/test_personas.py` 中新增 Persona 对象，按模板填写完整字段，重启后端即可。

**Q5：能换成其他 AI 模型吗？**
A：可以。只需修改 `avatar_agent.py` 中的 API 调用逻辑和响应解析，Prompt 工程策略保持不变。

---

*文档版本：v1.0 | 基于 CAP Platform MVP 代码生成*
