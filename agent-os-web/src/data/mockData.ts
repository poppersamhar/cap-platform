export interface Chat {
  id: string;
  name: string;
  projectId: string;
  messages: ChatMessage[];
}

export interface WorkLine {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  memberCount: number;
  unread: boolean;
  status: 'active' | 'idle' | 'completed';
  icon?: string;
  chats: Chat[];
}

// 兼容旧名
export type Project = WorkLine;

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  // PRD: 知识工程 / 数据治理 / 智能分析
  domain: 'knowledge' | 'governance' | 'analysis' | 'code';
  description: string;
  status: 'online' | 'busy' | 'offline';
  calls: number;
  // PRD: 已挂载 Skill 列表
  mountedSkills: string[];
  // PRD: 所属项目
  workLine: string;
  // 当前任务
  currentTask?: string;
  // 历史产出
  recentOutputs: Array<{
    title: string;
    completedAt: string;
    quality: number; // 0-100
  }>;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  // PRD: 知识工程 / 数据治理 / 分析 / 通用工具
  category: 'knowledge' | 'governance' | 'analysis' | 'tool';
  description: string;
  enabled: boolean;
  configFields: string[];
  // PRD: 来源
  source: string;
  // PRD: 适用范围（项目/实例数）
  scopeCount: number;
  // PRD: 创建时间、作者
  createdAt: string;
  author: string;
  // 版本
  version: string;
  // 执行步骤
  steps?: Array<{
    order: number;
    name: string;
    description: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'host' | 'agent' | 'skill' | 'human';
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  mentions?: string[];
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    plan?: string[];
    result?: string;
    toolCall?: { name: string; input: string };
    // PRD: 委派草案卡片
    delegation?: {
      target: string;
      goal: string;
      constraints: string[];
      requiredSkills: string[];
      skillCoverage: 'sufficient' | 'insufficient';
    };
  };
}

// 待处理事项（首页用）
export interface PendingItem {
  id: string;
  type: 'review' | 'skill-gap' | 'blocked';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  workLine?: string;
}

// 执行跟踪任务（首页用）
export interface TrackedTask {
  id: string;
  name: string;
  agentName: string;
  stage: string;
  blocked: boolean;
  eta: string;
  progress: number;
}

export const workLines: WorkLine[] = [
  {
    id: 'p1', name: '供应链金融风控平台', description: '基于大数据的供应商信用评估与应收账款风险监控体系', updatedAt: '刚刚', memberCount: 6, unread: true, status: 'active', icon: 'shield',
    chats: [
      { id: 'c1', name: '主对话', projectId: 'p1', messages: [] },
      { id: 'c2', name: '供应商信用评估模型', projectId: 'p1', messages: [] },
      { id: 'c3', name: '应收账款风险预警', projectId: 'p1', messages: [] },
      { id: 'c4', name: '贷后监控日报', projectId: 'p1', messages: [] },
      { id: 'c5', name: '风控规则引擎优化', projectId: 'p1', messages: [] },
    ],
  },
  {
    id: 'p2', name: '智能客服知识中台', description: '企业客服知识库语义检索升级与多轮对话能力改造', updatedAt: '10分钟前', memberCount: 5, unread: false, status: 'active', icon: 'lightbulb',
    chats: [
      { id: 'c6', name: '主对话', projectId: 'p2', messages: [] },
      { id: 'c7', name: 'FAQ语义检索优化', projectId: 'p2', messages: [] },
      { id: 'c8', name: '多轮对话流程梳理', projectId: 'p2', messages: [] },
      { id: 'c9', name: '客户意图分类标注', projectId: 'p2', messages: [] },
      { id: 'c10', name: '知识图谱补全与校验', projectId: 'p2', messages: [] },
    ],
  },
];

// 兼容旧名
export const projects = workLines;

export const agents: Agent[] = [
  {
    id: 'a1', name: '知识工程', avatar: '📚', domain: 'knowledge',
    description: '将企业制度、SOP、口径说明转化为结构化知识资产',
    status: 'online', calls: 1240, mountedSkills: ['s3', 's8'], workLine: '智能客服知识中台',
    currentTask: '提取 sales_q3.xlsx 关键指标',
    recentOutputs: [
      { title: 'Q3 营收结构知识包', completedAt: '昨天', quality: 92 },
      { title: '消费者业务口径定义', completedAt: '3天前', quality: 88 },
    ],
  },
  {
    id: 'a2', name: '数据治理', avatar: '🛡️', domain: 'governance',
    description: '数据质量规则校验、权属梳理、定义标准化',
    status: 'online', calls: 892, mountedSkills: ['s1', 's5'], workLine: '供应链金融风控平台',
    currentTask: '库存数据一致性校验',
    recentOutputs: [
      { title: '供应商主数据清洗报告', completedAt: '2小时前', quality: 95 },
    ],
  },
  {
    id: 'a3', name: '代码助手', avatar: '💻', domain: 'code',
    description: '辅助代码编写、审查、重构与自动化脚本生成',
    status: 'online', calls: 3456, mountedSkills: ['s2', 's6'], workLine: '供应链金融风控平台',
    currentTask: '生成 API 接口文档',
    recentOutputs: [
      { title: '用户认证模块重构', completedAt: '30分钟前', quality: 94 },
    ],
  },
];

export const skills: Skill[] = [
  {
    id: 's1', name: 'SQL执行器', icon: '🗄️', category: 'governance',
    description: '连接企业数据仓库执行SQL查询', enabled: true,
    configFields: ['数据源', '超时时间'], source: '来自任务#1240', scopeCount: 3,
    createdAt: '2026-03-15', author: 'BizAgent', version: 'v1.2',
    steps: [
      { order: 1, name: '接收查询', description: '接收并解析用户输入的 SQL 语句' },
      { order: 2, name: '语法验证', description: '校验 SQL 语法合法性及权限范围' },
      { order: 3, name: '连接数据源', description: '根据配置建立到目标数据库的连接' },
      { order: 4, name: '执行查询', description: '在超时限制内执行 SQL 并获取结果集' },
      { order: 5, name: '格式化返回', description: '将结果转换为 JSON/表格等结构化格式' },
    ],
  },
  {
    id: 's2', name: 'Python沙箱', icon: '🐍', category: 'analysis',
    description: '安全执行Python代码进行数据分析', enabled: true,
    configFields: ['内存限制', '包白名单'], source: '手动创建', scopeCount: 2,
    createdAt: '2026-02-01', author: 'samhar', version: 'v2.0',
    steps: [
      { order: 1, name: '代码接收', description: '接收 Python 代码片段及输入数据' },
      { order: 2, name: '安全检查', description: '扫描危险操作、验证包白名单、设置资源限制' },
      { order: 3, name: '隔离执行', description: '在 Docker 沙箱中运行代码，限制网络与文件访问' },
      { order: 4, name: '输出捕获', description: '捕获 stdout、stderr 及返回对象' },
      { order: 5, name: '结果返回', description: '返回执行结果、图表对象或错误信息' },
    ],
  },
  {
    id: 's3', name: '企业搜索', icon: '🔎', category: 'knowledge',
    description: '跨系统文档、邮件、聊天记录搜索', enabled: true,
    configFields: ['索引范围', '权限过滤'], source: '能力教学', scopeCount: 4,
    createdAt: '2026-03-20', author: 'BizAgent', version: 'v1.0',
    steps: [
      { order: 1, name: '意图识别', description: '解析搜索关键词，识别用户真实检索意图' },
      { order: 2, name: '权限过滤', description: '根据用户身份过滤可访问的数据源范围' },
      { order: 3, name: '多源检索', description: '并行检索文档库、邮件、聊天记录、知识库' },
      { order: 4, name: '相关性排序', description: '基于语义相似度与关键词匹配度综合排序' },
      { order: 5, name: '结果汇总', description: '去重、摘要生成，按来源分组返回结果' },
    ],
  },
  {
    id: 's4', name: '图表生成', icon: '📈', category: 'analysis',
    description: '基于数据自动生成多种类型图表', enabled: true,
    configFields: ['默认主题', '导出格式'], source: '来自任务#2103', scopeCount: 3,
    createdAt: '2026-01-10', author: 'BizAgent', version: 'v1.5',
    steps: [
      { order: 1, name: '数据解析', description: '识别输入数据的类型、维度与数值分布' },
      { order: 2, name: '图表推荐', description: '根据数据特征推荐最优图表类型（柱状/折线/饼图等）' },
      { order: 3, name: '配置生成', description: '生成 ECharts 配置，应用主题与配色方案' },
      { order: 4, name: '图表渲染', description: '渲染交互式图表，支持缩放与数据点查看' },
      { order: 5, name: '导出交付', description: '导出为 PNG/SVG/PDF 等指定格式' },
    ],
  },
  {
    id: 's5', name: '飞书通知', icon: '📢', category: 'tool',
    description: '向飞书群组或个人发送消息通知', enabled: true,
    configFields: ['Webhook', '签名密钥'], source: '手动创建', scopeCount: 2,
    createdAt: '2026-04-01', author: 'samhar', version: 'v1.0',
    steps: [
      { order: 1, name: '消息组装', description: '接收内容并组装为飞书消息体（文本/卡片/Markdown）' },
      { order: 2, name: '目标解析', description: '解析接收人 ID、群组 ID 或邮箱' },
      { order: 3, name: '签名计算', description: '使用签名密钥计算请求签名，确保安全性' },
      { order: 4, name: '调用Webhook', description: '向飞书机器人 Webhook 地址发送消息请求' },
      { order: 5, name: '状态反馈', description: '返回发送状态、消息 ID 或失败原因' },
    ],
  },
  {
    id: 's6', name: 'Jira操作', icon: '📋', category: 'tool',
    description: '创建、查询、更新Jira工单', enabled: false,
    configFields: ['Base URL', 'API Token'], source: '手动创建', scopeCount: 0,
    createdAt: '2026-02-15', author: 'samhar', version: 'v0.9',
    steps: [
      { order: 1, name: '指令解析', description: '识别操作类型（创建/查询/更新/评论）及目标工单' },
      { order: 2, name: '参数校验', description: '校验必填字段、项目 Key、用户权限' },
      { order: 3, name: 'API调用', description: '构造 Jira REST API 请求并携带认证信息' },
      { order: 4, name: '执行操作', description: '发送请求并在服务端执行对应的工单操作' },
      { order: 5, name: '结果返回', description: '返回工单详情、操作确认或错误提示' },
    ],
  },
  {
    id: 's7', name: '邮件发送', icon: '✉️', category: 'tool',
    description: '通过企业邮箱发送格式化邮件', enabled: true,
    configFields: ['SMTP服务器', '发件人'], source: '来自任务#892', scopeCount: 2,
    createdAt: '2026-03-01', author: 'BizAgent', version: 'v1.1',
    steps: [
      { order: 1, name: '内容组装', description: '组装收件人、主题、正文，支持 HTML 与附件' },
      { order: 2, name: '模板渲染', description: '如使用模板，注入变量并渲染最终邮件内容' },
      { order: 3, name: 'SMTP连接', description: '连接企业 SMTP 服务器并进行身份认证' },
      { order: 4, name: '邮件投递', description: '发送邮件并等待服务端确认' },
      { order: 5, name: '投递反馈', description: '返回发送成功状态或退信/失败原因' },
    ],
  },
  {
    id: 's8', name: 'PDF解析', icon: '📑', category: 'knowledge',
    description: '提取PDF中的表格、文本和结构化数据', enabled: true,
    configFields: ['OCR引擎', '语言'], source: '能力教学', scopeCount: 2,
    createdAt: '2026-03-25', author: 'BizAgent', version: 'v1.0',
    steps: [
      { order: 1, name: '文档加载', description: '加载 PDF 文件，识别页数、版式与加密状态' },
      { order: 2, name: '文本提取', description: '提取纯文本内容，对扫描件调用 OCR 识别' },
      { order: 3, name: '表格解析', description: '识别表格结构，提取为结构化数据（JSON/CSV）' },
      { order: 4, name: '元数据抽取', description: '提取标题、作者、日期、关键词等元信息' },
      { order: 5, name: '结果组装', description: '按章节组织内容，返回结构化文档对象' },
    ],
  },
];

const chatMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'system',
    senderId: 'system',
    senderName: '系统',
    content: '群主 BizAgent 已创建项目：Q3 财报分析',
    timestamp: '10:02',
  },
  {
    id: 'm2',
    role: 'human',
    senderId: 'u1',
    senderName: 'samhar',
    content: '请帮我分析本季度各业务线的营收对比，我已经上传了 sales_q3.xlsx',
    timestamp: '10:03',
  },
  {
    id: 'm3',
    role: 'host',
    senderId: 'host1',
    senderName: 'BizAgent',
    content: '收到。我来分解这个任务：\n1. 提取 sales_q3.xlsx 中的关键指标\n2. 按业务线汇总对比\n3. 生成可视化图表\n\n@知识工程-制度梳理 请先提取数据并计算各业务线营收',
    timestamp: '10:03',
    mentions: ['知识工程-制度梳理'],
    metadata: {
      plan: ['提取 sales_q3.xlsx 关键指标', '按业务线汇总对比', '生成可视化图表'],
    },
  },
  {
    id: 'm4',
    role: 'agent',
    senderId: 'a1',
    senderName: '知识工程-制度梳理',
    content: '正在执行数据提取...',
    timestamp: '10:04',
    status: 'sending',
    metadata: {
      toolCall: { name: 'SQL执行器', input: 'SELECT * FROM sales_q3' },
    },
  },
  {
    id: 'm5',
    role: 'agent',
    senderId: 'a1',
    senderName: '知识工程-制度梳理',
    content: '数据提取完成。Q3 各业务线营收（万元）：\n• 云服务：3,240（+18%）\n• 企业服务：2,890（+12%）\n• 消费者业务：1,560（-5%）\n• 海外市场：980（+34%）',
    timestamp: '10:05',
    status: 'sent',
  },
  {
    id: 'm6',
    role: 'host',
    senderId: 'host1',
    senderName: 'BizAgent',
    content: '@图表生成 请基于以上数据生成柱状图和趋势图',
    timestamp: '10:05',
    mentions: ['图表生成'],
  },
  {
    id: 'm7',
    role: 'skill',
    senderId: 's4',
    senderName: '图表生成',
    content: '[图表渲染结果]\n已生成柱状图：各业务线 Q3 营收对比\n已生成折线图：Q1-Q3 营收趋势',
    timestamp: '10:06',
    metadata: {
      result: 'chart-rendered',
    },
  },
  {
    id: 'm8',
    role: 'host',
    senderId: 'host1',
    senderName: 'BizAgent',
    content: '分析完成。@samhar 请查看右侧的数据面板，我已为你整理好关键结论：\n\n1. 云服务和企业服务是增长双引擎\n2. 消费者业务下滑 5%，需要关注\n3. 海外市场增速最高（34%），但基数较小\n\n如需下钻分析某个业务线，请告诉我。',
    timestamp: '10:06',
    mentions: ['samhar'],
  },
];

// 将消息分配给第一个项目的第一个对话
workLines[0].chats[0].messages = chatMessages;

export const taskFlow = [
  { step: 1, name: '计划', agent: 'BizAgent', status: 'completed' as const, time: '10:03' },
  { step: 2, name: '数据提取', agent: '知识工程-制度梳理', status: 'completed' as const, time: '10:05' },
  { step: 3, name: '图表生成', agent: '图表生成', status: 'completed' as const, time: '10:06' },
  { step: 4, name: '审查确认', agent: 'BizAgent', status: 'in-progress' as const, time: '10:06' },
  { step: 5, name: '任务完成', agent: '-', status: 'pending' as const, time: '-' },
];

export const activeAgents = [
  { id: 'host1', name: 'BizAgent', role: 'host' as const, status: 'running' as const, currentTask: '审查确认' },
  { id: 'a1', name: '知识工程-制度梳理', role: 'agent' as const, status: 'idle' as const, currentTask: '等待调度' },
  { id: 's4', name: '图表生成', role: 'skill' as const, status: 'idle' as const, currentTask: '等待调度' },
];

export const auditLogs = [
  { time: '10:06:23', event: 'BizAgent @提及 samhar', type: 'mention' as const },
  { time: '10:06:01', event: '图表生成 Skill 返回结果', type: 'skill' as const },
  { time: '10:05:58', event: 'BizAgent 调用 图表生成', type: 'tool_call' as const },
  { time: '10:05:12', event: '知识工程-制度梳理 完成数据提取', type: 'agent' as const },
  { time: '10:04:05', event: 'BizAgent 调用 知识工程-制度梳理', type: 'tool_call' as const },
  { time: '10:03:45', event: 'BizAgent 创建执行计划（3步）', type: 'plan' as const },
  { time: '10:03:12', event: 'samhar 上传文件 sales_q3.xlsx', type: 'file' as const },
];

// 首页管理操作面板数据
export const pendingItems: PendingItem[] = [
  {
    id: 'pi1', type: 'review', title: 'Q3 财报分析结果待审核',
    description: 'BizAgent已完成分析，等待你确认是否沉淀为 Skill',
    priority: 'high', workLine: 'Q3 财报分析',
  },
  {
    id: 'pi2', type: 'skill-gap', title: '供应链优化 Skill 覆盖不足',
    description: '数据治理-供应链缺少库存预测 Skill，建议先教学再委派',
    priority: 'high', workLine: '供应链优化',
  },
  {
    id: 'pi3', type: 'blocked', title: '舆情监控Agent 离线 3 小时',
    description: '可能影响品牌风险感知，建议检查运行状态',
    priority: 'medium',
  },
];

export const trackedTasks: TrackedTask[] = [
  {
    id: 't1', name: 'Q3 营收对比分析', agentName: '知识工程-制度梳理',
    stage: '图表生成', blocked: false, eta: '10:10', progress: 75,
  },
  {
    id: 't2', name: '供应商主数据清洗', agentName: '数据治理-质量检查',
    stage: '规则校验', blocked: false, eta: '11:00', progress: 45,
  },
  {
    id: 't3', name: '高价值客户流失预警', agentName: '智能分析-预测模型',
    stage: '模型训练', blocked: true, eta: '暂停', progress: 30,
  },
];
