# CAP 客户分身平台 — 完整流程图

> 本文档用 Mermaid 语法编写，可在 GitHub、Notion、Typora、VS Code（Mermaid 插件）中直接渲染。

---

## 一、用户全流程（从前端到后端）

```mermaid
flowchart TB
    subgraph FE["🖥️ 前端 (React + Vite)"]
        A["📱 Splash 启动页<br/>品牌展示 2s"] --> B{"是否首次访问?"}
        B -->|是| C["🎯 Onboarding 引导页<br/>选择角色身份"]
        B -->|否| D["🏠 Home 首页<br/>展示功能入口"]
        C --> D
        D --> E1["🎓 开始销售对练"]
        D --> E2["🔬 开始用户调研"]
        E1 --> F["👤 Persona 选择页<br/>浏览客户分身卡片"]
        E2 --> F
        F --> G["💬 Chat 对话页<br/>实时对话交互"]
        G --> H{"是否结束?"}
        H -->|继续对话| G
        H -->|达到轮次上限<br/>或主动结束| I["📊 Debrief 报告页<br/>评分与反馈"]
        I --> J1["🏠 返回首页"]
        I --> J2["📋 查看历史记录"]
    end

    subgraph BE["⚙️ 后端 (FastAPI)"]
        K1[("内存会话存储<br/>_sessions")]
        K2["🎭 Avatar Agent<br/>分身对话引擎"]
        K3["📈 Supervisor Agent<br/>督导评估引擎"]
        K4["📄 Analyst Agent<br/>报告生成引擎"]
        K5["😊 Emotion State<br/>情绪状态机"]
        K6[("客户分身数据库<br/>ALL_PERSONAS")]
    end

    subgraph AI["🤖 AI 模型 (MiniMax M2.7)"]
        M1["文本生成 API"]
    end

    F -.->|POST /api/session/create| K1
    G -.->|POST /api/chat| K2
    K2 -->|调用| M1
    M1 -->|返回回复| K2
    K2 --> K5
    K5 --> K1
    K2 -.->|异步触发| K3
    K3 -.->|写入评分| K1
    I -.->|GET /api/session/{id}/evaluation| K1
    I -.->|POST /api/session/{id}/report| K4
    K4 -->|调用| M1
    K4 -.->|生成报告| K1
```

---

## 二、单次对话内部流程（Chat API）

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户（销售/研究员）
    participant FE as 前端 React
    participant API as FastAPI /api/chat
    participant SA as Session Store<br/>(内存)
    participant AA as Avatar Agent
    participant ES as Emotion State
    participant MA as MiniMax API
    participant SV as Supervisor Agent<br/>(异步)

    User->>FE: 输入消息并发送
    FE->>API: POST /api/chat<br/>{session_id, message}
    API->>SA: 读取会话状态
    SA-->>API: session + emotion_state
    API->>AA: chat(persona, emotion, history, message)
    AA->>AA: 构建 System Prompt<br/>(完整人设 + 情绪 + 模式规则)
    AA->>AA: 拼接历史消息
    AA->>MA: POST /chat/completions<br/>{model, messages, temperature}
    MA-->>AA: {choices: [{message: {content}}]}
    AA->>ES: update(emotion_delta)
    ES->>ES: check_triggers()
    AA-->>API: {reply, emotion_delta, tags, hidden_revealed}
    API->>SA: 保存消息 + 更新情绪
    API->>SV: 异步 evaluate(session)
    SV-->>SA: 写入 evaluation 结果
    API-->>FE: {reply, emotion_state, round}
    FE->>User: 渲染客户回复
```

---

## 三、情绪状态机流转

```mermaid
flowchart LR
    subgraph State["😊 情绪五维状态"]
        T["信任 trust<br/>0-100"]
        I["意愿 intent<br/>0-100"]
        R["好感 rapport<br/>0-100"]
        S["抵触 resistance<br/>0-100"]
        A["焦虑 anxiety<br/>0-100"]
    end

    subgraph Input["📝 对话输入"]
        Pos["积极信号<br/>解决/放心/专业/理解"]
        Neg1["push信号<br/>现在订/限时/马上"]
        Neg2["价格信号<br/>优惠/打折/送"]
        Neg3["顾虑信号<br/>续航/充电/安全"]
    end

    Pos -->|+3| T
    Pos -->|+2| R
    Neg1 -->|+4| S
    Neg1 -->|+2| A
    Neg2 -->|+2| I
    Neg3 -->|+1| A

    subgraph Output["⚡ 状态输出"]
        SP["special_state"]
        SP1["生气 angry"]
        SP2["信任 trust"]
        SP3["成交 ready"]
        SP4["离开 leaving"]
    end

    T -->|>80| SP2
    I -->|>75 & T>70| SP3
    S -->|>80| SP1
    A -->|>85| SP4
```

---

## 四、督导评估流程（异步）

```mermaid
flowchart TB
    A["对话结束<br/>或每轮对话后"] --> B{"是否有足够轮次?"}
    B -->|是| C["Supervisor Agent<br/>逐轮评分"]
    B -->|否| D["等待更多对话"]
    C --> E{"评分维度"}
    E --> E1["洞察 insight<br/>是否理解客户需求"]
    E --> E2["适配 adaptation<br/>方案是否匹配场景"]
    E --> E3["匹配 matching<br/>产品是否满足痛点"]
    E --> E4["异议 objection<br/>处理顾虑是否得当"]
    E --> E5["信任 trust_building<br/>是否建立信任关系"]
    E1 --> F["每轮 0-100 分"]
    E2 --> F
    E3 --> F
    E4 --> F
    E5 --> F
    F --> G["计算平均分"]
    G --> H["生成等级 A/B/C/D"]
    F --> I["提取亮点 highlights"]
    F --> J["提取改进点 failures"]
    H --> K[("存入 session.evaluation")]
    I --> K
    J --> K
    K --> L["前端 Debrief 展示"]
```

---

## 五、数据流全景图

```mermaid
flowchart TB
    subgraph Client["客户端"]
        Browser["浏览器"]
    end

    subgraph Vercel["Vercel (前端托管)"]
        Static["静态资源<br/>HTML/CSS/JS"]
    end

    subgraph Render["Render (后端托管)"]
        FastAPI["FastAPI 服务<br/>Port 8787"]
        Memory["内存会话<br/>_sessions dict"]
        Personas["分身数据<br/>ALL_PERSONAS"]
    end

    subgraph LLM["MiniMax / 火山方舟"]
        API["Chat Completions API"]
    end

    Browser -->|HTTPS| Static
    Static -->|AJAX /api/*| FastAPI
    FastAPI -->|读写| Memory
    FastAPI -->|读取| Personas
    FastAPI -->|HTTP POST| API
    API -->|JSON 流| FastAPI
```

---

## 六、两种模式差异对比

```mermaid
flowchart LR
    subgraph Train["🎓 销售对练模式"]
        T1["客户态度：警惕、防备"]
        T2["回复风格：简短、犹豫"]
        T3["隐藏信息：需触发才暴露"]
        T4["评分维度：5维销售能力"]
        T5["轮次上限：15轮"]
    end

    subgraph Research["🔬 用户调研模式"]
        R1["客户态度：开放、配合"]
        R2["回复风格：详细、深入"]
        R3["隐藏信息：更容易透露"]
        R4["评分维度：访谈质量"]
        R5["轮次上限：20轮"]
    end

    T1 ~~~ R1
    T2 ~~~ R2
    T3 ~~~ R3
    T4 ~~~ R4
    T5 ~~~ R5
```

---

*文档版本：v1.0 | 基于 CAP Platform MVP 代码生成*
