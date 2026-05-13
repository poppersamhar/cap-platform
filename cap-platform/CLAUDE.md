# CAP 客户分身平台

## 项目概述
汽车行业客户数字分身平台。AI 扮演购车客户，供销售演练和用户调研使用。

## 技术栈
- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Python FastAPI，端口 8787
- AI 模型：MiniMax M2.7 API（对话 + 评分）
- 状态管理：useSyncExternalStore（不用 Redux/Zustand）

## 目录结构
```
src/store/          — 全局状态管理（Store 类）
src/types/          — TypeScript 类型定义
src/personas/       — 分身 JSON 数据
src/agents/         — Agent API 客户端（调后端 API）
src/components/     — React 组件
backend/agents/     — 三个 Agent（avatar/supervisor/analyst）
backend/engine/     — 情绪状态机
backend/personas/   — Persona Pydantic Schema + 测试数据
```

## 关键约束
1. 所有 AI 调用都走后端代理，前端不直接调 MiniMax API
2. 分身 Agent 的 System Prompt 必须包含完整 Persona JSON
3. 情绪状态在后端 Python 维护，前端只做展示
4. 每个 Agent 是独立的 MiniMax API 调用，Prompt 不混用
5. 对话历史存在后端内存（POC 阶段不用数据库）
6. API 路由统一前缀 /api/
7. 组件用函数式 + hooks，不用 class
8. 类型定义集中在 src/types/ 目录

## 编码规范
- React 函数组件 + hooks
- Store 模式：class Store + useSyncExternalStore
- Tailwind CSS 全部样式，不用 CSS modules
- 后端每个 Agent 一个独立文件
- 异步函数统一用 async/await
