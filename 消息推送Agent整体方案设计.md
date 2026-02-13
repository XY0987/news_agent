# 智能热点信息 Agent 完整方案设计

## 一、项目概述

### 1.1 核心定位

**一句话**：根据用户身份自动采集、过滤、评分、总结多平台信息，并持续自我优化的智能助手。

**本质价值**：从"信息搬运工"升级为"个人信息管家"
- 不只是聚合内容，而是理解你需要什么
- 不只是推送信息，而是告诉你该怎么做
- 不只是静态工具，而是持续进化的助手

### 1.2 项目背景

在信息爆炸时代，用户需要从多个平台（微信公众号、GitHub、Twitter/X、YouTube、知识星球、资讯网站等）获取信息，但面临以下问题：
- 信息来源分散，需要频繁切换平台
- 信息量巨大，筛选成本高
- 难以获取与自身定位相关的高价值内容
- 无法形成持续的知识积累和个人成长建议
- "只给内容不够"，用户更需要结构化摘要与下一步行动建议

### 1.3 项目目标

构建一个可持续运行的个人/小团队信息管家，实现：
1. **多源信息聚合**：统一采集多平台内容
2. **智能过滤评分**：基于用户画像进行内容筛选和优先级排序
3. **深度内容总结**：生成结构化摘要和 actionable insights
4. **自适应学习**：通过用户反馈持续优化推荐策略
5. **主动建议**：基于内容为用户提供下一步行动建议
6. **记忆与成长**：积累用户知识图谱，追踪学习轨迹

> **MVP 聚焦个性化推荐**：MVP 阶段聚焦"基于用户画像的个性化内容推荐"，即根据用户的职业、兴趣标签、偏好设置来筛选和推荐内容，核心目标是**帮用户节省筛选时间**。"热点发现"能力（跨源话题聚合、趋势检测、突发事件识别）作为后续增强方向，在 Phase 2+ 引入（详见"十八、后续演进"）。

### 1.4 MVP 成功标准（可验收）

- **可用**：每天定时产出一份"Top N 精选"（默认 N=5），包含：标题、来源、分数拆解、摘要、行动建议、原文链接
- **省时**：在配置 20–50 个来源、每天抓取 100–300 条原始内容时，单次处理链路（采集+处理+生成日报）在本机/2C4G 机器上 **≤ 10 分钟**完成
- **靠谱**：重复内容占比 **< 5%**；明显无关/垃圾内容进入日报的比例 **< 10%**
- **可控**：用户可以随时调整关注标签/排除标签/来源、以及推送频率与渠道

---

## 二、功能模块概览

```
┌─────────────────────────────────────────────────────────────┐
│                    🤖 热点信息 Agent                         │
├─────────────────────────────────────────────────────────────┤
│  📥 采集        │  🔍 过滤评分      │  📝 摘要建议          │
│  - 微信公众号   │  - 相关性评分     │  - 智能摘要           │
│  - GitHub      │  - 质量评分       │  - 关键点提取         │
│  - Twitter/X   │  - 时效性评分     │  - 行动建议           │
│  - YouTube     │  - 去重过滤       │  - 学习路径           │
│  - 知识星球    │  - 规则过滤       │                       │
│  - RSS/网站    │                   │                       │
├─────────────────────────────────────────────────────────────┤
│  🧠 自适应学习                │  📤 推送                    │
│  - 来源质量分析(建议移除)     │  - 实时推送(高分内容)       │
│  - 偏好自动发现              │  - 每日精选                 │
│  - 过滤条件自动优化          │  - 每周周报                 │
│  - 用户画像动态更新          │  - 多渠道(邮件/TG/微信)     │
├─────────────────────────────────────────────────────────────┤
│  💾 记忆系统                                                │
│  - 用户画像 / 阅读历史 / 偏好演变 / 知识图谱                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 六大核心能力

| # | 能力 | 说明 | 示例 |
|---|------|------|------|
| 1 | **多源采集** | 统一采集 7+ 平台内容 | 公众号、GitHub Trending、Twitter 等 |
| 2 | **智能过滤** | 基于用户画像多维度评分 | "这篇 AI 文章与你 92% 相关" |
| 3 | **内容摘要** | LLM 生成个性化摘要 | 针对前端开发者的角度总结 |
| 4 | **行动建议** | 给出下一步具体建议 | "写一个 demo 尝试这个新技术" |
| 5 | **自我优化** | 主动发现问题并建议 | "公众号B 相关度仅 12%，建议移除" |
| 6 | **记忆学习** | 持续积累用户偏好 | 发现你最近对 Rust 兴趣增加 |

### 2.2 差异化价值

| 传统方案 | 本 Agent |
|----------|----------|
| 全量推送，自己筛选 | 智能过滤，只看精华 |
| 只给内容 | 给内容 + 行动建议 |
| 静态订阅 | 动态优化来源 |
| 无记忆 | 持续学习你的偏好 |
| 被动工具 | 主动助手 |

---

## 三、典型使用流程

```
1️⃣ 用户设置身份: "前端开发，关注 AI 应用开发"
          ↓
2️⃣ 用户添加来源: 订阅 N 个公众号 + GitHub + Twitter
          ↓
3️⃣ Agent 自动运行:
   - 每天自动采集新内容
   - 自动过滤无关内容 (节省 70% 阅读量)
   - 对相关内容评分排序
   - 生成摘要 + 行动建议
          ↓
4️⃣ 推送给用户:
   - 每日中午 13 点: 今日 Top N 精选
   - 高分内容: 实时推送
   - 每周日: 周报 + 来源健康度报告
          ↓
5️⃣ 持续优化:
   - "发现公众号A与你无关，是否移除？"
   - "检测到你对 Rust 感兴趣，是否添加关注？"
   - 自动调整评分权重
   - 这类消息你关注较多，是否增加相关权重
```

### 3.1 关键用户故事（User Stories）

- **US-1**：作为前端开发者，我配置"AI 应用开发/前端工程化"画像与 30 个来源后，每天中午 13 点收到 5 条最相关内容摘要与行动建议
- **US-2**：我看到一条不感兴趣内容，点"无用/忽略"，可能给出原因，系统后续减少类似内容出现
- **US-3**：我新增一个来源（RSS 或 GitHub Repo），系统在下一次任务周期自动纳入采集并参与评分
- **US-4**：根据之前给我的分析和建议，不断优化总结内容

---

## 四、系统架构

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层 (Frontend)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  React App  │  │  Telegram   │  │   微信Bot   │  │   邮件/RSS订阅      │ │
│  │  (SPA/SRR)  │  │     Bot     │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         后端服务层 (NestJS)                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           NestJS Application                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  REST API   │  │ Bull Queue  │  │ node-cron   │  │ Vercel AI   │  │  │
│  │  │  (接口层)   │  │ (异步任务)   │  │ (定时调度)   │  │  SDK (LLM)  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│    内容采集层          │ │    内容处理层          │ │    推送服务层          │
│  (Data Collection)    │ │  (Content Processing) │ │  (Notification)       │
│ ┌───────────────────┐ │ │ ┌───────────────────┐ │ │ ┌───────────────────┐ │
│ │ 微信公众号爬虫     │ │ │ │  内容清洗与标准化  │ │ │ │   邮件推送        │ │
│ │ GitHub API       │ │ │ │  LLM 摘要生成     │ │ │ │   Telegram推送    │ │
│ │ RSS/网站爬虫      │ │ │ │  相关性评分       │ │ │ │   微信推送        │ │
│ │ (后续扩展更多)    │ │ │ │  标签分类        │ │ │ │   Webhook        │ │
│ └───────────────────┘ │ │ └───────────────────┘ │ │ └───────────────────┘ │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据存储层 (Storage)                             │
│  ┌──────────────────────┐  ┌─────────────┐  ┌────────────────────────────┐ │
│  │ MySQL（MVP）          │  │   Redis     │  │  向量数据库（后续可选）      │ │
│  │ PostgreSQL（长期）    │  │  (缓存/队列) │  │  pgvector / Qdrant        │ │
│  └──────────────────────┘  └─────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 技术选型

| 层级 | 技术选择 | 选择理由 |
|------|----------|----------|
| **前端** | React + TailwindCSS + shadcn/ui | 前端友好、组件生态丰富、现代 UI，MVP 可选 Vite 构建 |
| **后端 API** | NestJS (TypeScript) | 企业级架构、模块化设计、与前端同语言栈 |
| **Agent / LLM** | Vercel AI SDK + @anthropic-ai/sdk | 轻量、TS 原生、tool calling 支持好，与 NestJS 统一技术栈 |
| **LLM** | Claude API / OpenAI GPT-4 | 高质量摘要和推理能力（通过统一 Adapter 切换） |
| **任务调度** | node-cron / Bull Queue + Redis | 定时任务 + 异步队列，Node.js 原生方案 |
| **主数据库** | MySQL（MVP）/ PostgreSQL（长期） | 结构化数据存储，MySQL MVP 足够，长期可迁移 |
| **向量数据库** | MVP 不使用，后续可选 pgvector 或 Qdrant | MVP 用 URL 去重 + simhash 即可，语义去重后续引入 |
| **缓存** | Redis | 高速缓存、任务队列 |
| **部署** | Docker + Docker Compose | 简化部署流程 |

> **技术栈统一原则**：全栈统一使用 TypeScript，避免引入 Python 维护两套技术栈。当前 JS/TS 的 Agent 生态已足够成熟（Vercel AI SDK、Mastra.js），完全支持 Agent Loop、Tool Calling、Memory 等核心 Agent 能力。本项目的目标是构建一个**真正的 Agent**（LLM 自主决策 + Tool Calling + 记忆），而非简单的 LLM 工作流。

#### 4.2.1 Agent 框架选型说明

> **核心理念**：本项目不是一个 LLM 工作流（采集→过滤→推送的固定管道），而是一个**真正的 Agent 项目**。工作流已经有了（当前实现），这个项目的核心目标是让 LLM 成为"大脑"，自主感知、决策、行动、反思，同时也是提升 Agent 开发能力的实战项目。

**工作流 vs Agent 的本质区别：**

| | 工作流（你已经有的） | Agent（本项目要做的） |
|---|---|---|
| **决策者** | 开发者（代码写死流程 A→B→C） | LLM（自主决定下一步做什么） |
| **执行模式** | 顺序管道，固定步骤 | Agent Loop：感知→思考→行动→观察→再思考 |
| **工具使用** | 代码直接调用函数 | LLM 通过 tool calling 自主选择调用哪个工具 |
| **应对意外** | if-else 写死分支 | LLM 根据工具返回结果动态调整策略 |
| **可扩展性** | 加功能 = 改代码 | 加功能 = 注册新 Tool，Agent 自动学会使用 |
| **学习能力** | 需要手动改代码/配置 | 通过记忆和反馈自动调整行为 |

**为什么不用 Python（LangGraph/LangChain）？**

| 考量 | Python 方案 | TypeScript 方案 |
|------|------------|----------------|
| 技术栈统一 | 需维护 Python + TS 两套代码 | 前后端 + Agent 统一 TS |
| 学习成本 | 需同时掌握两个生态 | 专注一个生态，提升更快 |
| 部署复杂度 | 需额外的 Python 服务/容器 | 单一 Node.js 服务即可 |
| Agent 能力 | 生态最丰富（LangGraph 功能多） | Vercel AI SDK / Mastra.js 已成熟，Agent Loop 支持完善 |

**TS Agent 框架对比：**

| 框架 | 定位 | Agent 能力 | 推荐度 |
|------|------|----------|--------|
| **Vercel AI SDK** | LLM 工具包 + Agent Loop | `generateText` + `maxSteps`/`stopWhen` 实现 Agent 循环；tool calling；流式输出 | ⭐⭐⭐⭐⭐（MVP 首选） |
| **Mastra.js** | 完整 Agent 框架 | Agent 类 + Memory + Tool + Workflow + Sub-Agent 编排 | ⭐⭐⭐⭐⭐（Phase 2 首选，功能更全） |
| **@anthropic-ai/sdk** | Anthropic 官方 SDK | 底层 LLM 调用，配合上层框架用 | ⭐⭐⭐⭐（底层 SDK） |
| **LangGraph.js** | LangGraph 的 JS 版本 | 状态机、多 Agent 协作 | ⭐⭐⭐（学习成本高，MVP 不必要） |

**推荐路径**：
- **MVP**：Vercel AI SDK（`generateText` + tool calling + `maxSteps` 实现 Agent Loop）
- **Phase 2**：引入 Mastra.js（完整的 Agent 类、Memory 管理、Sub-Agent 编排、Workflow as Tool）

#### 4.2.2 Agent 架构设计理念

**本项目是一个真正的 Agent，不是一条固定流水线。** 核心设计：

```
┌──────────────────────────────────────────────────────────────┐
│                     Agent 核心循环                             │
│                                                              │
│   ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────┐  │
│   │  感知    │───▶│   思考   │───▶│  行动   │───▶│  观察  │  │
│   │ Perceive│    │  Think   │    │   Act   │    │Observe │  │
│   └─────────┘    └──────────┘    └─────────┘    └────────┘  │
│        ▲                                            │        │
│        └────────────────────────────────────────────┘        │
│                     (循环直到任务完成)                          │
│                                                              │
│   Agent 拥有的 Tools（LLM 自主选择调用）：                      │
│   🔧 collect_rss        - 采集 RSS 源内容                     │
│   🔧 collect_github     - 采集 GitHub Trending/Releases      │
│   🔧 collect_wechat     - 采集公众号内容                       │
│   🔧 filter_content     - 过滤去重去垃圾                      │
│   🔧 score_content      - 对内容评分                          │
│   🔧 summarize_content  - 生成摘要和行动建议                   │
│   🔧 send_notification  - 推送消息（邮件/Telegram）            │
│   🔧 read_user_profile  - 读取用户画像                        │
│   🔧 update_user_profile- 更新用户画像                        │
│   🔧 read_feedback      - 读取用户反馈历史                     │
│   🔧 analyze_sources    - 分析来源质量                        │
│   🔧 query_memory       - 查询记忆（历史决策/偏好）            │
│   🔧 store_memory       - 存储新记忆                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Agent 而非工作流的关键体现：**

1. **自主决策**：Agent 根据当前状态自己决定调用哪个 Tool。比如发现采集数据太少，会自主决定扩大采集范围；发现重复内容多，会自主加强去重
2. **Tool Calling**：所有能力封装为 Tool，Agent 通过 LLM 的 tool calling 机制调用，而不是代码写死调用顺序
3. **Agent Loop**：通过 Vercel AI SDK 的 `maxSteps` / `stopWhen` 机制实现多步推理循环——Agent 调用工具、观察结果、决定下一步，直到任务完成
4. **反思与优化**：Agent 能审视自己的历史决策，总结经验，调整后续策略
5. **记忆系统**：Agent 拥有短期记忆（当前任务上下文）和长期记忆（用户偏好、历史反馈），影响每次决策

**组合方案（渐进式）：**

```
Level 0 (里程碑 1): 自建 Agent Loop
  底层 SDK: @anthropic-ai/sdk               → 直接调 LLM API
  Agent Loop: 手写循环                       → 自己实现 tool calling 协议解析、循环控制、错误处理
  Tool 实现: NestJS Services                → 每个 Service 封装为 Agent 的 Tool
  目的: 深入理解 Agent 底层原理，踩一遍 SDK 帮你避免的坑

Level 1 (里程碑 2+): 切换到 SDK
  Agent 框架: Vercel AI SDK                  → generateText + maxSteps 实现 Agent Loop
  目的: 对比自建 vs SDK，理解框架的抽象价值

Level 2 (Phase 2+): 完整框架
  Agent 框架: Mastra.js                      → Agent 类 + Memory + Sub-Agent 编排
  目的: 体验工业级 Agent 框架的设计理念
```

**与纯工作流的对比示例：**

```
工作流方式（你已经有的）：
  cron 触发 → collectAll() → filter() → score() → summarize() → send()
  // 每一步都是代码写死，LLM 只在 summarize 这一步被调用

Agent 方式（本项目要做的）：
  cron 触发 → Agent.run("执行今日信息采集和推送任务")
  // Agent 自己决定：先查用户画像 → 选择采集哪些源 → 采集 → 评估数量够不够
  // → 不够则扩大范围 → 过滤 → 评分 → 选 Top K → 生成摘要 → 审视质量
  // → 不满意则重新生成 → 推送 → 记录本次决策经验
```

#### 4.2.3 数据库选型说明

**MySQL vs PostgreSQL vs SQLite：**

| 数据库 | 适合阶段 | 优势 | 劣势 |
|--------|---------|------|------|
| **SQLite** | 本地开发/原型 | 零部署、单文件 | 并发差、不支持远程访问 |
| **MySQL** | MVP ~ 生产 | 熟悉度高、部署简单、生态成熟 | 不原生支持 JSONB、无 pgvector |
| **PostgreSQL** | 长期生产 | JSONB、pgvector（向量）、功能最全 | 略重 |

**推荐路径**：MVP 用 **MySQL**（你熟悉、够用），通过 TypeORM/Prisma 做 ORM 层，后续如需向量能力再迁移到 PostgreSQL + pgvector。

**结构化数据存储的目的**：
- 持久化采集的内容（标题、链接、来源、时间）
- 存储用户画像和偏好设置
- 记录评分结果和分数拆解（可解释性）
- 追踪用户反馈（有用/无用/忽略），用于优化推荐
- 日报/周报的生成记录和推送状态
- Agent 决策日志（调试和优化用）

#### 4.2.4 向量数据库使用场景与替代方案

**向量数据库解决什么问题？**

| 场景 | 说明 | 示例 |
|------|------|------|
| 语义去重 | 两篇不同标题文章讲的是同一件事 | "Claude发布Agent SDK" vs "Anthropic推出新开发工具" |
| 语义搜索 | 用自然语言搜索相关内容 | 搜"如何优化React性能"找到相关文章 |
| 相关性评分 | 计算内容与用户画像的语义相似度 | 用户画像向量 vs 文章向量的余弦相似度 |

**MVP 是否需要？不需要。** 替代方案：

| 需求 | 向量方案 | MVP 替代方案 |
|------|---------|-------------|
| 去重 | embedding 余弦相似度 | URL 唯一键 + 标题 simhash（纯算法，零成本） |
| 相关性 | 向量相似度 | 关键词/标签匹配 + LLM 判定（已够用） |
| 语义搜索 | 向量检索 | MySQL LIKE/全文索引（MVP 够用） |

**后续引入路径**：当内容量 > 1 万条 或 需要"语义级去重"时，可引入：
- **方案 A**：PostgreSQL + pgvector 扩展（不加新组件）
- **方案 B**：独立 Qdrant 实例（性能更好，但多一个服务）
- **方案 C**：调用 LLM embedding API + 存 MySQL（最简单但查询慢）

### 4.3 MVP 推荐架构（先可用，再进化）

MVP 推荐采用"NestJS 单体服务 + Bull Queue 后台任务"的最小可行形态：

```
┌─────────────────────────────────────────────────────┐
│                  NestJS 单体服务                      │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ REST API     │  │ Bull Queue   │  │ node-cron │  │
│  │ (配置/反馈/  │  │ (异步任务    │  │ (定时触发 │  │
│  │  内容查询)   │  │  处理流水线) │  │  采集/推送)│  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
│                         │                            │
│  ┌──────────────────────┼──────────────────────────┐ │
│  │          Vercel AI SDK + LLM 调用               │ │
│  │    (Top K 摘要生成 / 相关性判定 / 行动建议)       │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
   ┌──────────┐                   ┌──────────┐
   │  MySQL   │                   │  Redis   │
   │ (主存储) │                   │ (缓存/   │
   │          │                   │  队列)   │
   └──────────┘                   └──────────┘
```

- **API 服务（NestJS）**：提供配置、内容列表、反馈接口、推送记录等
- **任务执行器（node-cron + Bull Queue）**：定时拉取内容并执行处理流水线
- **LLM 调用（Vercel AI SDK）**：对 Top K 内容调用 Claude/GPT 生成摘要和建议
- **存储**：
  - MVP：MySQL（足够，部署简单）
  - 可选：后续迁移 PostgreSQL + pgvector（需要向量能力时）

> 选择原则：先确保"每天稳定产出日报"，再叠加复杂度（复杂 Agent 编排、向量库、周报、反思优化）。全栈 TypeScript，不引入额外语言。

---

## 五、核心功能模块详细设计

### 5.1 多源信息采集模块

#### 5.1.1 支持的数据源

| 数据源 | 采集方式 | 数据类型 | 更新频率 |
|--------|----------|----------|----------|
| 微信公众号 | 第三方服务(WeRSS/微小宝) / 自建爬虫 | 文章、图片 | 每小时 |
| GitHub | GitHub API + Webhooks | Trending、Releases、Issues | 每30分钟 |
| Twitter/X | Twitter API v2 | 推文、Thread | 实时/每15分钟 |
| YouTube | YouTube Data API | 视频标题、描述、字幕 | 每小时 |
| 知识星球 | 非官方API/爬虫 | 帖子、精华 | 每小时 |
| RSS/网站 | RSS解析 / Puppeteer爬虫 | 文章 | 可配置 |
| Hacker News | HN API | 帖子、评论 | 每30分钟 |
| Reddit | Reddit API | 帖子 | 每小时 |

**MVP 数据源（先少后多）**：
- RSS/网站（优先）
- GitHub（Trending、Releases、指定 Repo 的 Releases/Issues 可选）
- 公众号：先走第三方 RSS 化/聚合服务（可替换为自建采集器）

#### 5.1.2 采集器设计

```typescript
// 采集器抽象接口
abstract class BaseCollector {
  abstract collect(sources: Source[]): Promise<RawContent[]>;
  abstract validateSource(source: Source): Promise<SourceValidation>;
}

// 统一内容格式
interface RawContent {
  sourceType: string;          // 来源平台
  sourceId: string;            // 来源标识(公众号ID/用户名等)
  sourceName: string;          // 来源名称
  contentId: string;           // 内容唯一ID
  title: string;               // 标题
  content: string;             // 正文内容
  url: string;                 // 原文链接
  author: string;              // 作者
  publishedAt: Date;           // 发布时间
  collectedAt: Date;           // 采集时间
  mediaUrls: string[];         // 媒体资源链接
  rawMetadata: Record<string, any>; // 原始元数据
}
```

### 5.2 用户画像与偏好系统

#### 5.2.1 用户画像维度

```yaml
用户画像结构:
  基础信息:
    - 职业角色: "前端开发工程师"
    - 技术栈: ["React", "TypeScript", "Node.js", "Python"]
    - 经验年限: 5
    - 公司类型: "互联网大厂"
  
  兴趣标签:
    主要兴趣:
      - "AI/LLM应用开发"
      - "前端工程化"
      - "Web性能优化"
    次要兴趣:
      - "开源项目"
      - "技术管理"
    排除标签:
      - "区块链"
      - "量化交易"
  
  内容偏好:
    内容深度: "深度技术文章"  # 浅显科普/深度技术/学术论文
    内容形式: ["长文", "教程", "源码分析"]
    语言偏好: ["中文", "英文"]
    时效性: "1周内"
  
  行为数据:
    阅读历史: [...]
    点赞/收藏: [...]
    忽略/不感兴趣: [...]
    平均阅读时长: 300s
```

#### 5.2.2 动态画像更新

系统通过以下方式持续更新用户画像：

1. **显式反馈**：用户主动标记"有用/无用"、"相关/不相关"
2. **隐式反馈**：阅读时长、点击率、转发行为
3. **Agent 推断**：根据阅读内容自动提炼新的兴趣点
4. **定期确认**：Agent 定期询问用户确认画像更新

### 5.3 智能过滤与评分系统

#### 5.3.1 多维度评分模型

```typescript
class ContentScorer {
  async score(content: ProcessedContent, user: UserProfile): Promise<ContentScore> {
    const scores = {
      // 1. 相关性评分 (0-100)
      relevance: await this.scoreRelevance(content, user),
      
      // 2. 质量评分 (0-100)
      quality: await this.scoreQuality(content),
      
      // 3. 时效性评分 (0-100)
      timeliness: this.scoreTimeliness(content),
      
      // 4. 来源信誉评分 (0-100)
      sourceCredibility: await this.scoreSource(content.source),
      
      // 5. 新颖性评分 (0-100) - 避免重复内容
      novelty: await this.scoreNovelty(content, user),
      
      // 6. 可操作性评分 (0-100) - 是否有实践价值
      actionability: await this.scoreActionability(content, user),
    };
    
    // 加权综合评分
    const weights = user.scoreWeights || DEFAULT_WEIGHTS;
    const finalScore = Object.keys(scores).reduce(
      (sum, key) => sum + scores[key] * weights[key], 0
    );
    
    return {
      finalScore,
      breakdown: scores,
      shouldNotify: finalScore >= user.notifyThreshold,
      priority: this.getPriority(finalScore),
    };
  }
}
```

#### 5.3.2 MVP 评分模型（强调可解释）

MVP 采用"可解释的加权模型 + 少量 LLM 辅助"：

- **相关性（0–100）**：基于画像关键词/标签匹配 +（可选）LLM 相关性判定
- **质量（0–100）**：来源信誉（手动评分/历史点击率）、内容长度、结构（是否教程/是否有代码/是否有结论）
- **时效性（0–100）**：时间衰减（例如按天衰减）
- **新颖性（0–100）**：与最近 7 天已推送内容相似度反向得分
- **可操作性（0–100）**：是否包含步骤、可复现 demo、明确实践建议（可选 LLM 判定）

综合分：
- `final_score = Σ weight_i * score_i`
- MVP 默认权重：相关性 0.45、质量 0.20、时效性 0.20、新颖性 0.10、可操作性 0.05（后续可按反馈调参）

#### 5.3.3 Tool 内部实现策略：规则 vs LLM 的分层

> **核心原则**：Agent（LLM）负责**决策层**——决定调用哪个 Tool、以什么参数调用、如何根据结果规划下一步。Tool 内部的**实现层**则应该选择最合适的方式：能用规则高效解决的用规则，需要语义理解的才用 LLM。这不是"不够 Agent"，而是**好的 Tool 设计**——Agent 不关心 Tool 内部用什么实现，只关心 Tool 的输入输出。

**各评分维度的实现策略：**

| 维度 | 实现方式 | 理由 |
|------|---------|------|
| **时效性** | 纯规则（时间衰减函数） | 确定性计算，无需语义理解 |
| **新颖性** | 纯规则（URL 去重 + simhash） | 字符串匹配足够，零成本 |
| **质量** | 规则为主（长度/结构/来源分） | 大部分维度可量化 |
| **相关性** | 规则初筛 + LLM 精判 | 关键词匹配做初筛（快），语义相关性用 LLM（准） |
| **可操作性** | LLM 判定 | 需要理解内容语义才能判断 |

**这种分层的好处：**
- Agent 决策循环的 LLM 调用是必须的（这是 Agent 的核心）
- Tool 内部用规则的维度：**快、稳定、零成本**
- Tool 内部用 LLM 的维度：**准、有语义理解能力**
- 整体效果：Agent 仍然完全自主决策，但 Tool 执行效率更高

#### 5.3.3 过滤规则引擎

```typescript
class FilterEngine {
  /** 可配置的过滤规则引擎 */
  
  // 内置过滤规则
  private builtinRules = {
    duplicate: new DuplicateFilter(),      // 去重
    length: new MinLengthFilter(100),      // 最小长度
    language: new LanguageFilter(),        // 语言过滤
    spam: new SpamDetector(),              // 垃圾内容检测
    relevance: new RelevanceThreshold(),   // 相关性阈值
  };
  
  // 用户自定义规则示例
  // 规则1: 如果标题包含"广告"或"推广"，则过滤
  // 规则2: 如果作者在忽略列表中，则过滤
  // 规则3: 如果内容与最近7天推送内容相似度>80%，则过滤
  // 规则4: 如果发布时间超过30天，则降低优先级
}
```

### 5.4 内容摘要与分析系统

#### 5.4.1 摘要生成策略

```yaml
摘要类型:
  极简摘要:
    长度: 50字以内
    用途: 推送通知标题
    
  标准摘要:
    长度: 200-300字
    结构:
      - 核心观点 (1-2句)
      - 关键信息点 (3-5点)
      - 与用户的相关性说明
    
  深度分析:
    长度: 500-1000字
    结构:
      - 内容概述
      - 技术要点详解
      - 实践建议
      - 延伸阅读推荐
      - 用户行动建议
```

#### 5.4.2 LLM Prompt 模板

```typescript
const SUMMARY_PROMPT = `
你是一个专业的技术内容分析助手。请根据用户画像分析以下内容：

## 用户画像
{user_profile}

## 原文内容
{content}

## 任务
1. 生成适合该用户的内容摘要
2. 评估内容与用户的相关度(1-10分)，并说明理由
3. 提取关键技术点/知识点
4. 给出 2-3 个具体的行动建议（如：学习建议、实践项目、延伸阅读）
5. 判断内容类型（新技术/最佳实践/工具推荐/行业动态/教程等）

## 输出格式 (JSON)
{
  "summary": "...",
  "relevance_score": 8,
  "relevance_reason": "...",
  "key_points": ["...", "..."],
  "action_suggestions": [
    {"type": "learn", "suggestion": "..."},
    {"type": "practice", "suggestion": "写一个demo尝试..."},
    {"type": "read", "suggestion": "推荐阅读..."}
  ],
  "content_type": "new_technology",
  "tags": ["AI", "LLM", "Agent"]
}
`;
```

#### 5.4.3 LLM 使用策略（控成本、控延迟、控质量）

- **只对"候选 Top K"调用 LLM**：先用规则/轻量模型筛到 K（如 20），再做摘要与建议，避免对全量内容调用
- **缓存与幂等**：同一 `content_id` 的摘要/建议结果缓存；内容不变不重复生成
- **Prompt 输出 JSON**：强约束输出结构，便于后处理与质量检查
- **质量兜底**：LLM 失败/超时则降级为"规则摘要"（标题 + 摘要前 200 字 + 关键句提取）

### 5.5 自适应学习与优化系统 (核心创新点)

#### 5.5.1 来源质量追踪

```typescript
class SourceAnalyzer {
  /** 分析数据源质量，提供优化建议 */
  
  async analyzeSourceQuality(source: Source, user: UserProfile): Promise<SourceReport> {
    // 获取该来源最近的内容统计
    const stats = await this.getSourceStats(source, 30); // days=30
    
    return {
      source,
      totalArticles: stats.total,
      relevantArticles: stats.relevant,
      relevanceRate: stats.relevant / stats.total,
      averageScore: stats.avgScore,
      userEngagement: {
        readRate: stats.read / stats.total,
        saveRate: stats.saved / stats.total,
        ignoreRate: stats.ignored / stats.total,
      },
      recommendation: this.generateRecommendation(stats),
    };
  }
  
  private generateRecommendation(stats: SourceStats): SourceRecommendation {
    if (stats.relevanceRate < 0.1) {
      return {
        action: 'suggest_remove',
        reason: `过去30天${stats.total}篇文章中仅${stats.relevant}篇与您相关`,
        confidence: 0.9,
      };
    } else if (stats.relevanceRate < 0.3) {
      return {
        action: 'suggest_reduce_frequency',
        reason: '相关内容较少，建议降低采集频率以节省资源',
        confidence: 0.7,
      };
    } else {
      return {
        action: 'keep',
        reason: '内容质量良好',
        confidence: 0.8,
      };
    }
  }
}
```

#### 5.5.2 用户偏好自动发现

```typescript
class PreferenceDiscovery {
  /** 从用户行为中发现新的偏好和过滤条件 */
  
  async discoverPreferences(user: UserProfile): Promise<PreferenceInsights> {
    // 分析用户最近的阅读行为
    const behavior = await this.getUserBehavior(user, 14); // days=14
    
    // 使用 LLM 分析行为模式
    const insights = await this.llmAnalyze(behavior, user.currentProfile);
    
    return {
      // 发现的新兴趣点
      emergingInterests: [
        { topic: 'Rust', confidence: 0.75, evidence: '最近阅读了5篇Rust相关文章' },
      ],
      // 建议添加的过滤条件
      suggestedFilters: [
        { type: 'exclude_author', value: '某营销号', reason: '该作者内容您从未阅读' },
      ],
      // 建议调整的评分权重
      weightAdjustments: {
        actionability: { current: 0.1, suggested: 0.2, reason: '您更偏好实践性内容' },
      },
      // 画像更新建议
      profileUpdates: [
        { field: 'interests', action: 'add', value: 'Rust语言', confidence: 0.75 },
      ],
    };
  }
}
```

#### 5.5.3 反馈学习循环

```
┌────────────────────────────────────────────────────────────────┐
│                        反馈学习循环                             │
│                                                                │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│   │ 推送内容 │───▶│ 用户反馈 │───▶│ 行为分析 │───▶│ 模型更新 │   │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│        ▲                                            │          │
│        └────────────────────────────────────────────┘          │
│                                                                │
│   反馈类型:                                                     │
│   - 显式: 点赞/踩、标记相关/不相关、保存/忽略                     │
│   - 隐式: 阅读时长、点击深度、分享行为                            │
│   - 周期性: 每周偏好确认、来源清理建议                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.6 记忆与知识管理系统

#### 5.6.1 记忆类型

```typescript
class MemorySystem {
  /** 多层记忆系统 */
  
  // 1. 短期记忆 - 最近的交互上下文 (Redis)
  shortTerm: ShortTermMemory;  // 最近24小时的交互、待处理内容
  
  // 2. 长期记忆 - 用户画像与历史 (MySQL)
  longTerm: LongTermMemory;    // 用户画像、阅读历史、偏好演变
  
  // 3. 语义记忆 - 内容关联 (后续可选：向量数据库)
  // MVP 阶段：用标签匹配 + LLM 判定代替
  // 后续：可引入 pgvector 或 Qdrant 做语义检索
  
  // 4. 元记忆 - 系统行为记录 (MySQL)
  meta: MetaMemory;            // Agent决策记录、优化历史、效果追踪
}
```

#### 5.6.2 知识图谱构建

```yaml
知识图谱节点:
  用户节点:
    - 用户基本信息
    - 技能树
    - 学习路径
    
  内容节点:
    - 文章/视频元信息
    - 内容向量
    - 关键概念提取
    
  概念节点:
    - 技术概念 (如: React, LLM, Agent)
    - 概念层级关系
    - 概念关联强度
    
关系类型:
  - 用户-阅读-内容
  - 用户-关注-概念
  - 内容-涉及-概念
  - 概念-相关-概念
  - 内容-引用-内容
```

### 5.7 推送与通知系统

#### 5.7.1 推送策略

```yaml
推送策略:
  实时推送:
    触发条件: 内容评分 >= 90 且 用户在线
    渠道: 首选渠道 (Telegram/微信)
    
  摘要推送:
    频率: 每日/每周可配置
    时间: 用户自定义 (默认早8点)
    内容: 精选 Top N 文章摘要
    渠道: 邮件/应用内推送
    
  周报推送:
    频率: 每周日
    内容:
      - 本周精选内容回顾
      - 来源质量报告
      - 偏好变化提示
      - 下周关注建议
      
  智能打扰:
    规则: 根据用户活跃时间自动调整推送时机
    免打扰: 支持免打扰时段设置
```

**MVP 推送策略（简化）**：
- **日报**：每天固定时间（默认早 8 点），发送 Top 5
- **高分实时（可选）**：当 `final_score ≥ 90` 且未在免打扰时段时，立刻推送
- **免打扰**：用户可配置静默时段
- **MVP 渠道**：邮件（必选）+ Telegram（可选）

#### 5.7.2 推送内容模板

```markdown
# 每日精选 - 2025年1月18日

## 🔥 今日必读 (Top 3)

### 1. [Claude 发布全新 Agent 开发框架](链接)
**来源**: AI前线 | **相关度**: 95%
> 摘要内容...

**💡 行动建议**: 
- 尝试用 Vercel AI SDK 重构你现有的 AI 项目
- 阅读官方文档了解 Agent 工作流架构

---

## 📊 本周数据源健康度报告

| 来源 | 相关内容占比 | 建议 |
|------|-------------|------|
| 公众号A | 85% | ✅ 保持 |
| 公众号B | 12% | ⚠️ 建议移除 |

**是否移除低相关来源？** [确认移除] [保留观察]

---

## 🎯 为你发现的新兴趣

系统发现你最近对 **Rust** 相关内容兴趣增加，是否添加到关注列表？
[添加] [暂不]
```

---

## 六、Agent 核心设计

> 本章是项目的灵魂。本项目是一个**真正的 Agent 项目**，而非 LLM 工作流。LLM 工作流（固定管道）你已经实现了，这里要做的是让 LLM 成为决策中枢，自主调用工具完成任务。

### 6.1 Agent 模式 + 兜底安全网

本项目采用 **Agent 为主 + 兜底安全网** 的模式：99% 的情况由 Agent（LLM）自主决策完成，同时设置一个最小保底流程作为安全网，确保服务可用性。就像自动驾驶汽车仍然有紧急制动系统——这不是回到工作流，而是工程上的健壮性。

**设计决策与理由：**

1. **核心流程完全由 Agent 编排**：采集哪些源、过滤策略、选多少条、是否重新生成摘要——全部由 Agent 通过 Tool Calling 自主决定。不写死 A→B→C 的调用顺序。

2. **兜底安全网的设计**：
   - **触发条件**：Agent 执行完毕但**未产出有效推送**（如 Agent 达到 maxSteps 仍未完成、Agent 输出格式异常、Agent 决策为"今天不推送"但无合理理由等异常情况）
   - **兜底流程**（最小保底，不是完整工作流）：采集全部已配置源 → 规则过滤（关键词匹配 + 去重） → 按时效性排序 → 推送 Top 5 → 标记本次为"兜底执行"
   - **兜底 ≠ 放弃 Agent**：每次兜底触发都会记录完整日志，作为后续优化 Agent 的重要素材。兜底是安全网，不是常态
   - **兜底比例监控**：如果连续 3 天触发兜底，说明 Agent 有系统性问题，需要人工介入排查

3. **Agent 自身的健壮性保障**（日常运行的主要防线）：
   - **Tool 层容错**：每个 Tool 执行失败时返回错误信息给 Agent，Agent 自己决定重试、跳过还是换方案。这是 Agent 的核心能力——应对意外
   - **maxSteps 限制**：设置最大步数（如 15 步），避免 Agent 陷入无限循环
   - **Agent 决策日志**：完整记录每一步的思考和行动，问题发生后可以回溯分析，优化 System Prompt
   - **告警机制**：如果 Agent 连续 N 天触发兜底或未成功推送，通过邮件/Telegram 告警

4. **这也是 Agent 架构真正有价值的地方**：
   - 当 Agent 需要处理从未遇到的情况（新的来源类型、异常数据、API 限流等），它能**基于 LLM 的推理能力动态应对**，而不是命中一个 if-else 分支
   - 加新功能 = 注册新 Tool + 更新 System Prompt，Agent 自动学会使用，无需修改编排逻辑
   - 兜底安全网的存在让你可以**放心大胆地实验 Agent 的各种可能性**，不用担心实验失败导致完全没有推送

```
执行流程示意：

cron 触发
  ↓
Agent.run("执行今日信息采集和推送任务")
  ↓
Agent 自主决策（99% 的情况在这里完成）
  ↓
检查：Agent 是否产出了有效推送？
  ├── ✅ 是 → 正常结束，记录日志
  └── ❌ 否 → 触发兜底安全网
                ↓
              采集全部源 → 规则过滤 → 按分排序 → 推送 Top 5
                ↓
              标记"兜底执行"，记录 Agent 失败日志供后续分析
```

### 6.2 Agent vs 工作流：架构对比

```
工作流（你已经有的）：
  cron → collectAll() → filter() → score() → summarize() → send()
  // 代码写死每一步，LLM 只是 summarize 步骤的一个"函数"
  // 加功能 = 改代码、改管道

Agent（本项目要做的）：
  cron → Agent.run("执行今日信息采集和推送任务", { tools, memory })
  // Agent（LLM）自己决定：
  //   1. 先查用户画像 → 了解用户关注什么
  //   2. 选择采集哪些源 → 不是全量采集，而是基于画像决策
  //   3. 采集后评估数量 → 不够则扩大范围或调整策略
  //   4. 过滤 → 评分 → 选 Top K
  //   5. 生成摘要 → 审视质量 → 不满意则重新生成
  //   6. 推送 → 记录本次决策经验到记忆
```

### 6.2 Agent 核心循环（Agent Loop）

> **学习路径**：先自建 Agent Loop（理解原理），再切 SDK（体验抽象价值）。

#### 6.2.1 自建 Agent Loop（里程碑 1：深入理解原理）

直接调 `@anthropic-ai/sdk`，**手写 Agent 循环**。这是提升 Agent 开发能力的关键步骤——你需要亲手处理 SDK 帮你封装掉的所有细节：

```typescript
import Anthropic from '@anthropic-ai/sdk';

/**
 * 自建 Agent Loop —— 不依赖任何 Agent 框架
 * 
 * 通过手写循环，你会深入理解：
 * 1. Tool Calling 协议：LLM 返回的 tool_use block 长什么样、怎么解析
 * 2. 消息格式：assistant message 和 tool result 如何组装
 * 3. 循环控制：什么时候停？LLM 不调 Tool 了就停？还是达到 maxSteps？
 * 4. 错误处理：Tool 执行失败了怎么办？是告诉 LLM 让它决定，还是直接跳过？
 * 5. Token 管理：上下文越来越长，怎么处理？截断？摘要？滑动窗口？
 * 6. 并行 Tool Call：LLM 一次返回多个 tool_use，是串行执行还是并行？
 */
@Injectable()
class NewsAgentService {
  private anthropic = new Anthropic();

  constructor(
    private readonly toolRegistry: AgentToolRegistry,
  ) {}

  async runDailyDigest(userId: string): Promise<AgentResult> {
    const userProfile = await this.toolRegistry.getUserProfile(userId);
    const tools = this.toolRegistry.getAnthropicToolDefinitions(); // 转为 Anthropic API 格式
    
    // ======== Agent Loop 核心 ========
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `执行今日信息采集和推送任务。
          当前时间: ${new Date().toISOString()}
          用户: ${userProfile.name}
          你的目标是为用户产出一份高质量的每日精选推送。
          请自主决定执行步骤，合理使用可用工具。
          完成后输出最终的执行报告。`,
      },
    ];

    const maxSteps = 15;
    const steps: AgentStep[] = []; // 记录每一步，用于可观测性

    for (let step = 0; step < maxSteps; step++) {
      const stepStart = Date.now();

      // 1. 调用 LLM —— 让 Agent "思考"
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.buildAgentSystemPrompt(userProfile),
        messages,
        tools,
      });

      // 2. 解析 LLM 响应 —— 提取文本和 tool_use blocks
      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      // 3. 记录这一步（可观测性）
      steps.push({
        step,
        thinking: textBlocks.map(b => b.text).join('\n'),
        toolCalls: toolUseBlocks.map(b => ({ name: b.name, args: b.input })),
        durationMs: Date.now() - stepStart,
      });

      // 4. 如果 LLM 没有调用任何 Tool —— 任务完成，退出循环
      if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
        const finalText = textBlocks.map(b => b.text).join('\n');
        await this.logAgentExecution(userId, steps);
        return { report: finalText, stepsUsed: steps.length };
      }

      // 5. 把 LLM 的完整响应加入消息历史
      messages.push({ role: 'assistant', content: response.content });

      // 6. 执行 LLM 选择的所有 Tool（支持并行）
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          try {
            const result = await this.toolRegistry.executeTool(toolUse.name, toolUse.input);
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            };
          } catch (error) {
            // Tool 执行失败 —— 告诉 LLM，让它自己决定怎么处理
            // 这就是 Agent 和工作流的区别：工作流会 crash，Agent 会适应
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: `Tool 执行失败: ${error.message}`,
              is_error: true,
            };
          }
        }),
      );

      // 7. 把 Tool 执行结果加入消息历史，回到步骤 1
      messages.push({ role: 'user', content: toolResults });

      // 8. Token 管理（简单版：当消息过长时截断早期的 tool results）
      this.pruneMessagesIfNeeded(messages);
    }

    // 达到 maxSteps 上限，强制结束
    await this.logAgentExecution(userId, steps);
    return { report: '达到最大步数限制，任务未完全完成', stepsUsed: maxSteps };
  }

  /**
   * 将 Tool 定义转换为 Anthropic API 格式
   * 这是自建 Agent 时必须手动处理的——SDK 会帮你做这件事
   */
  // 见 AgentToolRegistry.getAnthropicToolDefinitions()

  /**
   * Token 管理：当消息列表过长时，裁剪早期的 tool result 内容
   * 这是自建 Agent 时才需要考虑的问题之一
   */
  private pruneMessagesIfNeeded(messages: Anthropic.MessageParam[]) {
    // 简单策略：保留最近 10 轮对话，早期的 tool result 用摘要替代
    // 更高级的策略：估算 token 数，动态裁剪
    const maxRounds = 20; // 每轮 = assistant + user(tool_result)
    if (messages.length > maxRounds * 2) {
      // 保留第一条（任务指令）和最近的对话
      const first = messages[0];
      const recent = messages.slice(-(maxRounds * 2));
      messages.length = 0;
      messages.push(first, ...recent);
    }
  }

  private buildAgentSystemPrompt(profile: UserProfile): string {
    return `你是一个智能信息管家 Agent。你的任务是为用户采集、筛选、总结高质量信息。

## 你的能力（Tools）
你拥有多个工具，可以自主决定调用顺序和次数：
- 采集工具：从不同平台获取内容
- 过滤工具：去重、去垃圾
- 评分工具：对内容进行多维度评分
- 摘要工具：生成个性化摘要和行动建议
- 推送工具：发送消息给用户
- 记忆工具：读取/存储用户偏好和历史经验

## 你的行为准则
1. **先了解用户**：每次任务开始时，先查询用户画像和最近的反馈，了解用户当前的关注重点
2. **智能采集**：根据用户画像决定优先采集哪些来源，而不是盲目全量采集
3. **质量优先**：宁可少推也不推垃圾。如果高质量内容不够 5 条，就推 3 条
4. **自我审视**：生成摘要后，审视质量。如果摘要不够好，重新生成
5. **记录经验**：每次任务完成后，总结本次的决策经验存入记忆
6. **主动建议**：如果发现来源质量下降或用户兴趣变化，主动提出建议

## 用户画像
${JSON.stringify(profile, null, 2)}

## 决策约束
- 最终推送内容数量: 3-7 条（质量优先，不凑数）
- 只推送与用户相关的内容（相关性评分 > 60）
- 如果某个来源连续 3 天无相关内容，在报告中建议移除`;
  }
}
```

**自建时你会踩的坑（也是最有价值的学习）：**

| 坑 | 具体表现 | 学到什么 |
|---|---|---|
| tool_use 解析 | LLM 返回的 content 是数组，里面混着 text 和 tool_use block | 理解 Anthropic 消息协议 |
| tool_result 格式 | 必须用 tool_use_id 关联，否则 API 报错 | 理解 tool calling 的请求-响应配对机制 |
| 并行 tool call | LLM 一次返回 3 个 tool_use，你需要全部执行并返回 | 理解 LLM 的并行调用能力 |
| 循环不停 | Agent 反复调同一个 Tool，陷入死循环 | 学会设计停止条件和 maxSteps |
| 上下文爆炸 | 每轮 tool result 都很长，10 步后 token 超限 | 学会 context window 管理 |
| 错误传播 | 一个 Tool 失败导致 Agent 整体崩溃 | 学会优雅降级（告诉 LLM 错误，让它重新规划） |

#### 6.2.2 切换到 Vercel AI SDK（里程碑 2：体验抽象价值）

当你自建 Agent Loop 跑通后，切换到 SDK 只需改几行代码。**但此时你会深刻理解每一行的价值**：

```typescript
import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

/**
 * 用 Vercel AI SDK 重写 —— 对比自建版本，体会 SDK 做了什么
 * 
 * SDK 帮你处理了：
 * ✅ tool_use/tool_result 消息协议的组装和解析
 * ✅ Agent Loop 循环控制（maxSteps / stopWhen）
 * ✅ 并行 tool call 的执行
 * ✅ 错误处理和 is_error 标记
 * ✅ 多模型适配（Anthropic/OpenAI/Google 统一接口）
 * 
 * 你仍然需要自己处理的：
 * ❌ System Prompt 设计（Agent 行为的核心）
 * ❌ Tool 的业务逻辑实现
 * ❌ 记忆系统设计
 * ❌ Token/上下文管理策略
 * ❌ 可观测性和日志
 */
@Injectable()
class NewsAgentService {
  async runDailyDigest(userId: string): Promise<AgentResult> {
    const userProfile = await this.toolRegistry.getUserProfile(userId);

    // 对比自建版本：原来 60 行的循环，现在 1 个函数调用
    const { text, steps } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: this.buildAgentSystemPrompt(userProfile),
      prompt: `执行今日信息采集和推送任务...`,
      tools: this.toolRegistry.getAllTools(), // Tool 定义格式也更简洁
      maxSteps: 15, // 这一行替代了你手写的 for 循环
    });

    await this.logAgentExecution(userId, steps);
    return { report: text, stepsUsed: steps.length };
  }
}
```

### 6.3 Agent Tool 定义（核心能力封装）

每个业务能力封装为 Agent 的 Tool，**Agent 通过 tool calling 自主选择调用**：

```typescript
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Agent Tool 注册表
 * 
 * 关键理念：NestJS Service 实现具体逻辑，但暴露为 Agent 的 Tool。
 * Agent（LLM）决定什么时候调用、以什么参数调用。
 */
@Injectable()
class AgentToolRegistry {
  constructor(
    private readonly collectorService: CollectorService,
    private readonly filterService: FilterService,
    private readonly scorerService: ScorerService,
    private readonly notificationService: NotificationService,
    private readonly memoryService: MemoryService,
    private readonly userService: UserService,
  ) {}

  getAllTools() {
    return {
      // ========== 感知类工具 ==========
      
      read_user_profile: tool({
        description: '读取用户画像，了解用户的职业、兴趣标签、偏好设置',
        parameters: z.object({ userId: z.string() }),
        execute: async ({ userId }) => this.userService.getProfile(userId),
      }),

      read_feedback_history: tool({
        description: '读取用户最近的反馈记录（有用/无用/忽略），了解用户近期偏好变化',
        parameters: z.object({
          userId: z.string(),
          days: z.number().default(7).describe('查看最近几天的反馈'),
        }),
        execute: async ({ userId, days }) => this.memoryService.getRecentFeedback(userId, days),
      }),

      query_memory: tool({
        description: '查询 Agent 的长期记忆，包括历史决策经验、用户偏好变化趋势',
        parameters: z.object({
          userId: z.string(),
          query: z.string().describe('要查询的记忆内容，如"用户最近的兴趣变化"'),
        }),
        execute: async ({ userId, query }) => this.memoryService.query(userId, query),
      }),

      // ========== 行动类工具 ==========

      collect_rss: tool({
        description: '从 RSS 源采集最新内容。返回采集到的文章列表',
        parameters: z.object({
          userId: z.string(),
          sourceIds: z.array(z.string()).optional().describe('指定采集哪些 RSS 源，不传则采集全部'),
          since: z.string().optional().describe('只采集该时间之后的内容，ISO 格式'),
        }),
        execute: async (params) => this.collectorService.collectRss(params),
      }),

      collect_github: tool({
        description: '从 GitHub 采集 Trending 项目和指定 Repo 的 Releases',
        parameters: z.object({
          userId: z.string(),
          type: z.enum(['trending', 'releases', 'both']).default('both'),
          language: z.string().optional().describe('Trending 的语言筛选，如 typescript'),
        }),
        execute: async (params) => this.collectorService.collectGithub(params),
      }),

      collect_wechat: tool({
        description: '从微信公众号采集最新文章（通过第三方服务）',
        parameters: z.object({
          userId: z.string(),
          sourceIds: z.array(z.string()).optional(),
        }),
        execute: async (params) => this.collectorService.collectWechat(params),
      }),

      filter_and_dedup: tool({
        description: '对采集到的内容进行去重和基础过滤（去垃圾、去广告、去过短内容）。返回过滤后的内容列表',
        parameters: z.object({
          contentIds: z.array(z.string()).describe('待过滤的内容 ID 列表'),
          userId: z.string(),
        }),
        execute: async (params) => this.filterService.filterAndDedup(params),
      }),

      score_contents: tool({
        description: '对内容进行多维度评分（相关性、质量、时效性、新颖性、可操作性）。返回带分数和分数拆解的内容列表',
        parameters: z.object({
          contentIds: z.array(z.string()).describe('待评分的内容 ID 列表'),
          userId: z.string(),
        }),
        execute: async (params) => this.scorerService.scoreAll(params),
      }),

      generate_summary: tool({
        description: '为单篇内容生成个性化摘要和行动建议。这是一个 LLM 调用，成本较高，只对 Top K 内容使用',
        parameters: z.object({
          contentId: z.string(),
          userId: z.string(),
        }),
        execute: async (params) => this.collectorService.generateSummary(params),
      }),

      batch_generate_summaries: tool({
        description: '批量为多篇内容生成摘要和行动建议。内部会控制并发',
        parameters: z.object({
          contentIds: z.array(z.string()).describe('需要生成摘要的内容 ID 列表（建议不超过 20 条）'),
          userId: z.string(),
        }),
        execute: async (params) => this.collectorService.batchGenerateSummaries(params),
      }),

      // ========== 推送类工具 ==========

      send_daily_digest: tool({
        description: '发送每日精选推送给用户。需要提供最终选定的内容列表和推送摘要',
        parameters: z.object({
          userId: z.string(),
          contentIds: z.array(z.string()).describe('最终推送的内容 ID 列表（3-7 条）'),
          agentNote: z.string().optional().describe('Agent 想附带的说明，如"今天 AI 领域有重大更新"'),
        }),
        execute: async (params) => this.notificationService.sendDigest(params),
      }),

      // ========== 记忆类工具 ==========

      store_memory: tool({
        description: '存储一条经验/观察到 Agent 的长期记忆。用于记录决策经验、用户偏好变化等',
        parameters: z.object({
          userId: z.string(),
          type: z.enum(['decision_experience', 'preference_change', 'source_quality', 'insight']),
          content: z.string().describe('要记住的内容'),
          confidence: z.number().min(0).max(1).default(0.8),
        }),
        execute: async (params) => this.memoryService.store(params),
      }),

      suggest_source_change: tool({
        description: '生成来源管理建议（添加/移除/调整频率）。建议会在推送中展示给用户确认',
        parameters: z.object({
          userId: z.string(),
          sourceId: z.string(),
          action: z.enum(['suggest_remove', 'suggest_reduce_frequency', 'suggest_add']),
          reason: z.string(),
        }),
        execute: async (params) => this.memoryService.storeSuggestion(params),
      }),

      analyze_source_quality: tool({
        description: '分析指定来源的质量统计（相关率、平均分、用户反馈分布）',
        parameters: z.object({
          userId: z.string(),
          sourceId: z.string().optional().describe('不传则分析所有来源'),
          days: z.number().default(30),
        }),
        execute: async (params) => this.memoryService.analyzeSourceQuality(params),
      }),
    };
  }
}
```

### 6.4 Agent 执行示例（实际运行过程）

以下是 Agent 实际运行时的决策过程示例（通过 Agent Log 记录）：

```
═══════════════════════════════════════════════════
Agent 执行日志 - 2026-02-13 12:00:00
用户: niroli (前端开发, 关注 AI 应用开发)
═══════════════════════════════════════════════════

Step 1: [思考] 开始执行每日推送任务。先了解用户最近的偏好变化。
  → 调用 Tool: read_feedback_history({ userId, days: 7 })
  → 结果: 最近 7 天用户对 3 篇 Rust 文章标记"有用"，对 2 篇区块链文章标记"无用"

Step 2: [思考] 用户最近对 Rust 兴趣增加，区块链不感兴趣。记住这个变化。
  → 调用 Tool: query_memory({ userId, query: "用户兴趣变化趋势" })
  → 结果: 上周也观察到用户对 Rust 的兴趣，连续 2 周了，置信度较高

Step 3: [思考] 确认用户对 Rust 兴趣持续增长。开始采集内容，优先采集 AI 和 Rust 相关源。
  → 调用 Tool: collect_rss({ userId, since: "2026-02-12T00:00:00Z" })
  → 结果: 采集到 87 篇文章

Step 4: [思考] RSS 采集到 87 篇，再采集 GitHub。
  → 调用 Tool: collect_github({ userId, type: "both", language: "typescript" })
  → 结果: 采集到 23 条 (15 trending + 8 releases)

Step 5: [思考] 总共 110 条，数量足够。进行过滤去重。
  → 调用 Tool: filter_and_dedup({ contentIds: [...110条], userId })
  → 结果: 过滤后剩 68 条（去重 22 条，去垃圾 20 条）

Step 6: [思考] 68 条进行评分。
  → 调用 Tool: score_contents({ contentIds: [...68条], userId })
  → 结果: 返回评分结果。Top 20 分数: 92, 88, 85, 83, 81, ...

Step 7: [思考] 评分完成。选 Top 10 生成摘要（多选几条以备质量不够）。
  → 调用 Tool: batch_generate_summaries({ contentIds: [...Top10], userId })
  → 结果: 10 篇摘要生成完毕

Step 8: [思考] 审视摘要质量。第 7 篇摘要质量一般（太短且无行动建议），
        最终选择 Top 5 推送。发现今天有一篇关于 Rust + WebAssembly 的高分文章，
        用户应该会感兴趣。
  → 调用 Tool: send_daily_digest({
      userId,
      contentIds: [top5],
      agentNote: "今天有一篇 Rust + WebAssembly 的高质量文章，与你最近的兴趣匹配"
    })
  → 结果: 推送成功（邮件 ✓, Telegram ✓）

Step 9: [思考] 推送完成。记录本次经验，并检查来源质量。
  → 调用 Tool: store_memory({
      type: "decision_experience",
      content: "用户对 Rust 的兴趣连续 3 周增长，已在推送中增加 Rust 内容权重"
    })
  → 调用 Tool: analyze_source_quality({ userId, days: 14 })
  → 结果: 公众号B 相关率仅 8%，建议移除

Step 10: [思考] 公众号B 质量很低，生成移除建议。
  → 调用 Tool: suggest_source_change({
      sourceId: "公众号B",
      action: "suggest_remove",
      reason: "过去 14 天 25 篇文章中仅 2 篇与你相关(8%)，建议移除以减少噪声"
    })

Step 11: [最终输出]
  今日推送报告：
  - 采集: 110 条 → 过滤: 68 条 → 评分 Top 10 → 推送 5 条
  - 推送渠道: 邮件 ✓, Telegram ✓
  - 发现: 用户对 Rust 兴趣持续增长，已调整内容权重
  - 建议: 公众号B 相关率仅 8%，建议移除
```

### 6.5 多 Agent 协作设计（Phase 2: Mastra.js）

MVP 用单个 Agent + 多 Tool 即可。Phase 2 可引入 Mastra.js 实现多 Agent 协作：

```typescript
import { Agent } from '@mastra/core/agent';

// 主 Agent：协调者
const orchestratorAgent = new Agent({
  id: 'orchestrator',
  name: '信息管家',
  instructions: '你是信息管家的总协调者。根据任务类型分配给合适的子 Agent。',
  model: 'anthropic/claude-sonnet-4-20250514',
  // 子 Agent 作为工具
  agents: {
    collector: collectorAgent,     // 采集专家 Agent
    analyst: analystAgent,         // 分析专家 Agent
    writer: writerAgent,           // 摘要写作 Agent
  },
  tools: { sendNotification, storeMemory },
  memory: {
    // Mastra 内置记忆管理
    provider: 'postgres', // 或自定义 MySQL provider
  },
});

// 采集专家 Agent
const collectorAgent = new Agent({
  id: 'collector',
  name: '采集专家',
  instructions: '你负责从各平台采集内容。根据用户画像决定优先采集哪些源。',
  tools: { collectRss, collectGithub, collectWechat },
});

// 分析专家 Agent
const analystAgent = new Agent({
  id: 'analyst',
  name: '分析专家',
  instructions: '你负责评估内容质量和相关性。严格把关，宁缺毋滥。',
  tools: { filterAndDedup, scoreContents, analyzeSourceQuality },
});
```

### 6.6 定时任务触发 Agent

```typescript
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
class SchedulerService {
  constructor(
    @InjectQueue('agent') private agentQueue: Queue,
    private readonly newsAgent: NewsAgentService,
  ) {}

  // 每天中午 12 点触发 Agent 执行每日推送
  @Cron('0 12 * * *')
  async triggerDailyAgent() {
    // 把任务放入队列，由 Agent 异步执行
    await this.agentQueue.add('daily-digest', {
      trigger: 'scheduled',
      timestamp: new Date().toISOString(),
    });
  }

  // 每周日触发 Agent 执行周报 + 反思
  @Cron('0 10 * * 0')
  async triggerWeeklyAgent() {
    await this.agentQueue.add('weekly-report', {
      trigger: 'scheduled',
      includeReflection: true, // Agent 会额外执行来源质量分析和偏好发现
    });
  }

  // 每 30 分钟检查是否有高分内容需要实时推送
  @Cron('*/30 * * * *')
  async triggerRealtimeCheck() {
    await this.agentQueue.add('realtime-check', {
      trigger: 'scheduled',
      threshold: 90, // 只推送 90 分以上的内容
    });
  }
}

// Bull Queue 处理器：实际运行 Agent
@Processor('agent')
class AgentProcessor {
  constructor(private readonly newsAgent: NewsAgentService) {}

  @Process('daily-digest')
  async handleDailyDigest(job: Job) {
    // 这里调用 Agent，Agent 自主决定后续步骤
    const result = await this.newsAgent.runDailyDigest(job.data.userId);
    return result;
  }
}
```

### 6.7 Agent 能力成长路径（同时也是你的 Agent 开发能力成长路径）

```
Level 0 (里程碑 1): 自建 Agent Loop —— 理解原理
  - 直接调 @anthropic-ai/sdk，手写 Agent 循环
  - 亲手处理 tool calling 协议、消息组装、循环控制、错误处理
  - 理解 token 管理和上下文窗口限制
  你学到: Agent 的底层运行机制，SDK 在帮你做什么

Level 1 (里程碑 2): 切换 Vercel AI SDK —— 体验抽象
  - 用 generateText + maxSteps 替换手写循环
  - 对比自建版本，理解框架的抽象价值
  - 专注于 Tool 设计和 System Prompt 优化
  你学到: 什么该自己做（Tool/Prompt），什么该交给框架（协议/循环）

Level 2: 记忆增强 + 反思能力
  - Agent 能回顾过去的决策经验
  - 基于用户反馈自动调整行为
  - 主动发现用户兴趣变化
  你学到: Agent 记忆系统设计（短期/长期/语义记忆）

Level 3 (Mastra.js): 多 Agent 协作
  - 采集 Agent、分析 Agent、写作 Agent 各司其职
  - 协调者 Agent 分配任务
  - Agent 之间可以互相调用
  你学到: 多 Agent 编排与协作模式

Level 4: 自主进化
  - Agent 能自主优化自己的 system prompt
  - Agent 能建议添加新的 Tool
  - 完全自主的信息管家
  你学到: Agent Meta-Learning 和自主进化
```

---

## 七、数据流与处理流水线

处理流水线（Agent 自主编排，以下为典型执行路径）：

1. **感知（Perceive）**：Agent 查询用户画像 + 最近反馈 + 历史记忆，了解当前任务上下文
2. **采集（Collect）**：Agent 决定优先采集哪些来源（基于画像和记忆，而非全量采集）
3. **标准化（Normalize）**：统一字段结构（标题、正文、链接、作者、时间、来源、元数据）
4. **清洗（Clean）**：HTML → Text、去广告段落、去代码块可选、语言检测
5. **去重（Dedup）**：
   - 强去重：`url`/`external_id` 唯一键
   - 弱去重：`title_simhash`/`content_simhash` 或 embedding 相似度
6. **基础过滤（Filter）**：黑名单作者/关键词、最小长度、发布时间窗口
7. **评分（Score）**：产出可解释的分数拆解
8. **决策（Decide）**：Agent 审视评分结果，决定选哪些进入 Top K
9. **摘要与建议（Summarize & Suggest）**：Agent 调用 LLM Tool 生成摘要，并审视质量
10. **推送（Notify）**：Agent 选择最终 Top N 推送，附带个性化说明
11. **反思（Reflect）**：Agent 分析来源质量、发现偏好变化、记录决策经验
12. **记忆更新（Remember）**：Agent 将经验和观察存入长期记忆

---

## 八、数据模型设计

### 8.1 核心数据表

> 以下 SQL 兼容 MySQL 8.0+。使用 `JSON` 类型代替 PostgreSQL 的 `JSONB`；使用 `CHAR(36)` 存储 UUID（也可用 NestJS 的 TypeORM/Prisma 自动管理）。

```sql
-- 用户表
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(100),
    profile JSON,              -- 用户画像（JSON 格式）
    preferences JSON,          -- 偏好设置
    notification_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 数据源表
CREATE TABLE sources (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    type VARCHAR(50),          -- wechat/github/rss/etc
    identifier VARCHAR(255),   -- 公众号ID/用户名/RSS URL等
    name VARCHAR(255),
    config JSON,               -- 采集配置
    status VARCHAR(20) DEFAULT 'active',  -- active/paused/removed
    quality_score FLOAT,       -- 质量评分
    last_collected_at TIMESTAMP NULL,
    stats JSON,                -- 统计数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 内容表
CREATE TABLE contents (
    id CHAR(36) PRIMARY KEY,
    source_id CHAR(36),
    external_id VARCHAR(255),  -- 外部唯一标识
    title TEXT,
    content MEDIUMTEXT,        -- 正文内容（可能较长）
    url TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP NULL,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    title_hash VARCHAR(64),    -- 标题 simhash，用于弱去重
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id),
    UNIQUE KEY uk_url (url(500)),           -- URL 强去重
    UNIQUE KEY uk_external (external_id)    -- 外部 ID 强去重
);

-- 内容评分表
CREATE TABLE content_scores (
    id CHAR(36) PRIMARY KEY,
    content_id CHAR(36),
    user_id CHAR(36),
    final_score FLOAT,
    score_breakdown JSON,      -- 分数拆解 {"relevance": 85, "quality": 70, ...}
    is_selected BOOLEAN DEFAULT FALSE,
    selection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES contents(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 用户内容交互表
CREATE TABLE user_content_interactions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    content_id CHAR(36),
    score FLOAT,               -- 系统评分
    user_rating TINYINT,       -- 用户评分
    is_read BOOLEAN DEFAULT FALSE,
    is_saved BOOLEAN DEFAULT FALSE,
    is_ignored BOOLEAN DEFAULT FALSE,
    read_duration INT,         -- 阅读时长(秒)
    summary TEXT,              -- 个性化摘要
    suggestions JSON,          -- 行动建议
    notified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

-- 日报/周报记录表
CREATE TABLE digests (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    type VARCHAR(20),          -- daily/weekly
    content_ids JSON,          -- Top N 列表
    rendered_content MEDIUMTEXT, -- 渲染内容
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 反馈表
CREATE TABLE feedbacks (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    content_id CHAR(36),
    feedback_type VARCHAR(20), -- useful/useless/save/ignore
    read_duration INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

-- 记忆表（用户偏好演变）
CREATE TABLE memories (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    type VARCHAR(50),          -- preference/behavior/insight
    `key` VARCHAR(255),
    value JSON,
    confidence FLOAT,
    source VARCHAR(50),        -- system/user/inferred
    valid_from TIMESTAMP NULL,
    valid_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Agent 决策日志
CREATE TABLE agent_logs (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    session_id CHAR(36),
    action VARCHAR(100),
    input JSON,
    output JSON,
    reasoning TEXT,
    duration_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 8.2 向量存储方案（MVP 可选，后续引入）

MVP 阶段**不使用**向量数据库。去重和相关性评估方案：

| 需求 | MVP 方案 | 后续方案 |
|------|---------|---------|
| 强去重 | `url` / `external_id` 唯一键 | 同左 |
| 弱去重 | `title_hash`（simhash 算法） | embedding 余弦相似度 |
| 相关性 | 关键词匹配 + LLM 判定 | 用户画像向量 vs 内容向量 |
| 搜索 | MySQL FULLTEXT / LIKE | 向量检索 |

**后续引入向量能力时的方案选择：**

```typescript
// 方案 A：PostgreSQL + pgvector（迁移数据库时一并引入）
// ALTER TABLE contents ADD COLUMN embedding vector(1536);
// SELECT * FROM contents ORDER BY embedding <=> $1 LIMIT 10;

// 方案 B：独立 Qdrant 实例
// const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
// await qdrant.search('contents', { vector: embedding, limit: 10 });

// 方案 C：调用 LLM embedding API + 存 MySQL JSON 字段（最简单但查询慢）
// 适合内容量 < 5000 条的场景
```

---

## 九、API 设计

### 9.1 RESTful API 端点

```yaml
用户相关:
  POST   /api/users/register          # 用户注册
  GET    /api/users/profile           # 获取用户画像
  PUT    /api/users/profile           # 更新用户画像
  PUT    /api/users/preferences       # 更新偏好设置

数据源管理:
  GET    /api/sources                 # 获取数据源列表
  POST   /api/sources                 # 添加数据源
  PUT    /api/sources/:id             # 更新数据源
  DELETE /api/sources/:id             # 删除数据源
  GET    /api/sources/:id/stats       # 获取数据源统计
  POST   /api/sources/validate        # 验证数据源

内容相关:
  GET    /api/contents                # 获取内容列表 (支持筛选/分页)
  GET    /api/contents/:id            # 获取内容详情
  POST   /api/contents/:id/feedback   # 提交内容反馈
  GET    /api/contents/digest         # 获取今日精选
  GET    /api/contents/search         # 语义搜索

推送相关:
  GET    /api/notifications           # 获取通知列表
  PUT    /api/notifications/settings  # 更新通知设置
  POST   /api/notifications/test      # 发送测试通知

Agent 交互:
  POST   /api/agent/chat              # 与 Agent 对话
  GET    /api/agent/suggestions       # 获取 Agent 建议
  POST   /api/agent/feedback          # 提交对 Agent 建议的反馈

系统管理:
  GET    /api/system/stats            # 系统统计
  GET    /api/system/health           # 健康检查
  POST   /api/system/sync             # 手动触发同步
```

### 9.2 WebSocket API

```typescript
// 实时通信接口
interface WebSocketMessage {
  type: 'notification' | 'digest' | 'suggestion' | 'system';
  payload: any;
  timestamp: string;
}

// 客户端订阅
ws.send(JSON.stringify({
  action: 'subscribe',
  channels: ['notifications', 'realtime_updates']
}));

// 服务端推送
{
  type: 'notification',
  payload: {
    content_id: 'xxx',
    title: '新文章推荐',
    summary: '...',
    score: 92,
    suggestions: [...]
  }
}
```

---

## 十、前端设计

### 10.1 页面结构

```
/                           # 首页 - 今日精选
/feed                       # 信息流 - 所有内容
/sources                    # 数据源管理
/sources/add                # 添加数据源
/profile                    # 用户画像设置
/preferences                # 偏好设置
/history                    # 阅读历史
/saved                      # 收藏内容
/insights                   # Agent 洞察与建议
/settings                   # 系统设置
```

### 10.2 核心组件

```typescript
// 组件结构
components/
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Layout.tsx
├── content/
│   ├── ContentCard.tsx        // 内容卡片
│   ├── ContentDetail.tsx      // 内容详情
│   ├── ContentFeed.tsx        // 内容信息流
│   ├── DigestView.tsx         // 精选摘要视图
│   └── FeedbackButtons.tsx    // 反馈按钮组
├── source/
│   ├── SourceList.tsx         // 数据源列表
│   ├── SourceCard.tsx         // 数据源卡片
│   ├── SourceForm.tsx         // 添加/编辑数据源
│   └── SourceStats.tsx        // 数据源统计
├── profile/
│   ├── ProfileEditor.tsx      // 画像编辑器
│   ├── InterestTags.tsx       // 兴趣标签管理
│   └── PreferenceForm.tsx     // 偏好设置表单
├── agent/
│   ├── AgentChat.tsx          // Agent 对话界面
│   ├── SuggestionCard.tsx     // 建议卡片
│   ├── InsightPanel.tsx       // 洞察面板
│   └── FeedbackConfirm.tsx    // 反馈确认对话框
└── common/
    ├── ScoreIndicator.tsx     // 评分指示器
    ├── TagSelector.tsx        // 标签选择器
    └── NotificationToast.tsx  // 通知提示
```

### 10.3 状态管理

```typescript
// 使用 Zustand 进行状态管理
import { create } from 'zustand';

interface NewsAgentStore {
  // 用户状态
  user: User | null;
  profile: UserProfile | null;
  
  // 内容状态
  contents: Content[];
  digest: DigestContent[];
  
  // 数据源状态
  sources: Source[];
  sourceStats: Map<string, SourceStats>;
  
  // Agent 状态
  suggestions: Suggestion[];
  pendingFeedback: FeedbackRequest[];
  
  // Actions
  fetchDigest: () => Promise<void>;
  submitFeedback: (contentId: string, feedback: Feedback) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  addSource: (source: NewSource) => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => Promise<void>;
}
```

---

## 十一、部署方案

### 11.1 Docker Compose 配置

```yaml
version: '3.8'

services:
  # 前端（React SPA）
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    depends_on:
      - api

  # 后端 API（NestJS，同时包含定时任务和队列消费者）
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_HOST=db
      - DATABASE_PORT=3306
      - DATABASE_USER=root
      - DATABASE_PASSWORD=password
      - DATABASE_NAME=newsagent
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - db
      - redis

  # MySQL
  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=newsagent
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  # Redis（缓存 + Bull Queue）
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

> **MVP 精简**：只有 4 个容器（前端、后端、MySQL、Redis），不需要 Qdrant、不需要单独的 Worker/Beat 容器（NestJS 内置 @nestjs/schedule + @nestjs/bull 即可）。

### 11.2 环境变量配置

```bash
# .env.example

# Database (MySQL)
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=password
DATABASE_NAME=newsagent

# Redis
REDIS_URL=redis://localhost:6379

# LLM APIs（至少配一个）
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# 微信公众号采集 (第三方服务)
WERSS_API_KEY=xxx

# GitHub
GITHUB_TOKEN=ghp_xxx

# Twitter
TWITTER_BEARER_TOKEN=xxx

# YouTube
YOUTUBE_API_KEY=xxx

# 推送服务
TELEGRAM_BOT_TOKEN=xxx
SMTP_HOST=smtp.example.com
SMTP_USER=xxx
SMTP_PASSWORD=xxx

# 安全
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx
```

### 11.3 部署形态（推荐路径）

- **本地开发**：`docker compose up` 启动 API + MySQL + Redis；前端 `npm run dev`
- **轻量云主机（2C4G）**：同样 compose 部署，4 个容器足够；日志落盘并定期轮转
- **MVP 极简**：可只部署后端 + MySQL + Redis，前端 MVP 阶段可省略（推送结果直接看邮件/Telegram）

---

## 十二、运维与可观测性

MVP 必做的可观测：
- **Agent 决策日志**：每次 Agent 执行的完整 step 记录（调用了哪些 Tool、参数、返回值、耗时）
- **结构化日志**：每个 Tool 执行的耗时、条数、错误原因
- **任务状态**：任务开始/结束时间、Agent 执行步数、成功/失败、失败重试次数
- **关键指标**：采集条数、去重比例、过滤比例、LLM 成功率、推送成功率
- **Agent 行为追踪**：Agent 的决策路径可回溯，便于调试和优化 system prompt

---

## 十三、安全与合规

- **密钥管理**：API Key/SMTP/Telegram Token 通过环境变量注入，避免写入仓库
- **最小采集**：只保存必要字段；可配置"仅保存摘要，不落全文"（降低合规压力）
- **退订与删除**：用户可一键删除来源与历史内容（MVP 可先做管理接口）

---

## 十四、开发路线图与里程碑

### 14.1 范围界定

**MVP（2–4 周）范围**
- **数据源（先少后多）**：
  - RSS/网站（优先）
  - GitHub（Trending、Releases、指定 Repo 的 Releases/Issues 可选）
  - 公众号：先走第三方 RSS 化/聚合服务（可替换为自建采集器）
- **处理能力**：清洗、去重、基础规则过滤、评分排序、LLM 摘要与行动建议
- **推送渠道**：邮件（必选）+ Telegram（可选）
- **反馈闭环**：提供"有用/无用/忽略/收藏"最小闭环（可以先通过 Telegram/邮件回复链接落到一个简单网页）

**非目标（MVP 不做）**
- 完整的多租户 SaaS、复杂权限体系
- 全量实时推送（先做定时精选与少量高分实时）
- 完整知识图谱/复杂偏好自动发现（先做可解释的轻量版本）

### 14.2 里程碑与交付物（2–4 周可落地）

- **里程碑 0（1–2 天）**：项目骨架
  - NestJS 项目初始化、模块划分、TypeORM/Prisma 配置
  - MySQL 数据表迁移方案确定
  - 环境变量/Docker Compose 配置

- **里程碑 1（第 1 周）**：自建 Agent Loop + 基础 Tool（理解原理）
  - 直接调 `@anthropic-ai/sdk` API，**手写 Agent Loop**（不用 Vercel AI SDK）
  - 实现 tool calling 协议的手动解析和执行
  - RSS 采集器 + GitHub 采集器 封装为 Agent Tool
  - 过滤、评分 封装为 Agent Tool
  - 邮件推送 Tool
  - **关键验证**：自建 Agent Loop 能自主调用 Tool 完成采集→过滤→推送的完整流程
  - **关键学习**：亲手踩 tool calling 协议、消息格式、循环控制、错误处理的坑

- **里程碑 2（第 2 周）**：切换 Vercel AI SDK + 智能化（体验抽象价值）
  - 用 `generateText` + `maxSteps` 替换手写 Agent Loop，对比体验
  - LLM 摘要生成 Tool
  - 用户画像读取/更新 Tool
  - Agent system prompt 优化（让 Agent 决策更智能）
  - 反馈接口与简单 Web 页面（或邮件/Telegram 反馈链接）
  - **关键验证**：Agent 能根据用户画像做出差异化决策
  - **关键体会**：SDK 帮你处理了什么、你手写时踩了哪些坑

- **里程碑 3（第 3–4 周，可选）**：记忆 + 反思 + 前端
  - 记忆系统 Tool（读取/存储经验）
  - Agent 反思能力（分析来源质量、发现偏好变化）
  - Telegram 推送 Tool
  - React 前端基础页面（今日精选、来源管理、反馈、Agent 决策日志查看）

### 14.3 Phase 规划（完整版）

#### Phase 1: Agent MVP (4-6周)

**目标**: 先自建 Agent Loop 理解原理，再切 SDK，实现一个能自主决策的单 Agent

- [ ] NestJS 项目搭建 + MySQL + Redis + Docker Compose
- [ ] 用户系统 (注册/登录/画像)
- [ ] 核心 Tool 开发（采集、过滤、评分、摘要、推送、记忆）
- [ ] **自建 Agent Loop**（直接调 @anthropic-ai/sdk，手写循环）
- [ ] 验证自建 Agent Loop 跑通完整流程
- [ ] 切换到 Vercel AI SDK（generateText + maxSteps），对比体验
- [ ] Agent System Prompt 设计与优化
- [ ] Agent 决策日志与可观测性
- [ ] 邮件推送
- [ ] React 基础 Web UI

#### Phase 2: Agent 智能化 (4-6周)

**目标**: 增强 Agent 的记忆、反思和自适应能力

- [ ] 完善记忆系统（短期/长期记忆）
- [ ] Agent 反思能力（来源质量分析、偏好发现）
- [ ] 基于反馈的 Agent 行为调整
- [ ] 弱去重 Tool（simhash 或引入向量相似度）
- [ ] Telegram 推送 Tool
- [ ] Agent 对话界面（Vercel AI SDK streaming）
- [ ] Agent 行为 Dashboard（查看决策过程）

#### Phase 3: 多 Agent 协作 (4-6周)

**目标**: 引入 Mastra.js，实现多 Agent 协作架构

- [ ] 迁移到 Mastra.js Agent 框架
- [ ] 拆分为多个专业 Agent（采集 Agent、分析 Agent、写作 Agent）
- [ ] 协调者 Agent 编排子 Agent
- [ ] Agent Memory 持久化（Mastra 内置能力）
- [ ] 周报生成
- [ ] 知识图谱构建
- [ ] 性能优化

#### Phase 4: Agent 自主进化 (持续)

**目标**: Agent 能力持续增长，趋向完全自主

- [ ] Agent 自主优化 system prompt
- [ ] Agent 建议添加新 Tool
- [ ] 更多数据源 Tool（Twitter, YouTube, 知识星球等）
- [ ] 移动端适配
- [ ] 多用户协作
- [ ] API 开放
- [ ] 插件系统（用户自定义 Tool）

---

## 十五、验收清单

建议直接做成测试/脚本：

- **Agent 可运行**：Agent 能通过 tool calling 自主完成采集→过滤→评分→摘要→推送的完整流程
- **Agent 决策可观测**：每次执行的 step 日志完整，可回溯 Agent 的决策路径
- **日报产出**：在设定时间自动生成并发送；内容结构完整（分数/摘要/建议/链接）
- **来源管理**：新增/暂停/删除来源后，下一个任务周期生效
- **去重**：同一链接不会重复入库；相似内容不会同时进入 Top N
- **反馈闭环**：标记"无用/忽略"后，Agent 在后续执行中调整策略（可通过 Agent 日志验证）
- **容错**：任一 Tool 执行失败，Agent 能降级处理（跳过或重试），不影响整体任务完成

---

## 十五-B、Agent 评估体系

> Agent 是否在进步？推荐质量是否在提升？需要量化指标来衡量，而不是凭感觉。

### 15B.1 评估维度

**核心评估（基于用户反馈）：**

| 指标 | 计算方式 | 目标值 | 说明 |
|------|---------|--------|------|
| **推荐命中率** | 用户标记"有用"的条数 / 推送总条数 | ≥ 60% | Agent 推荐的内容是否符合用户诉求 |
| **过滤准确率** | 被过滤内容中用户不会想看的比例（抽样验证） | ≥ 80% | Agent 过滤掉的内容是否确实该过滤 |
| **漏推率** | 用户在其他渠道发现但 Agent 没推荐的重要内容数 / 周 | ≤ 2 条/周 | Agent 是否遗漏了用户关心的内容 |

**辅助评估（系统可自动统计）：**

| 指标 | 计算方式 | 说明 |
|------|---------|------|
| **决策稳定性** | 同样的输入数据，多次运行 Agent 的 Top N 重合度 | Agent 是否稳定可靠 |
| **步数效率** | 平均完成任务的 Agent Loop 步数 | 越少越好（同等质量下） |
| **Tool 调用合理性** | 是否有无意义的重复调用、冗余步骤 | 反映 System Prompt 质量 |
| **推荐命中率趋势** | 每周命中率的变化曲线 | Agent 是否在持续进步 |

### 15B.2 评估数据采集

```
用户反馈（核心数据源）：
  每条推送内容 → 用户可标记：✅ 有用 / ❌ 无用 / ⭐ 收藏 / 🔇 忽略
  可选：用户给出"为什么无用"的简短原因（1-2 个标签，如"不相关""太基础""已知"）

过滤验证（定期抽样）：
  每周从被过滤掉的内容中随机抽 10-20 条 → 用户快速浏览标题判断是否该过滤
  目的：验证 Agent 没有误杀好内容

Agent 日志（自动记录）：
  每次 Agent 执行的完整 step 记录、Tool 调用参数与返回值、最终推送结果
```

### 15B.3 评估驱动优化

评估结果直接指导 Agent 优化方向：

- **命中率低** → 检查 System Prompt 中用户画像的描述是否准确，检查相关性评分 Tool 是否合理
- **过滤准确率低（误杀多）** → 放宽过滤规则，或让 Agent 在过滤时更保守
- **漏推率高** → 检查是否有来源未被采集、评分权重是否需要调整
- **决策不稳定** → 优化 System Prompt 的指令明确性，减少模糊表述
- **步数过多** → 审视 Agent 是否在做无用功，优化 Tool 的粒度设计

---

## 十六、成本估算

### 16.1 LLM API 成本

> Agent 模式下 LLM 调用量会比工作流模式高，因为 Agent Loop 每个 step 都需要一次 LLM 推理。

| 场景 | 每日调用量 | Token 消耗/次 | 日成本 (Claude) |
|------|-----------|--------------|----------------|
| Agent Loop 推理（决策） | ~10-15 steps/次 | ~500-1000 tokens | ~$0.15 |
| 内容摘要（Tool 调用） | 10-20 篇 | ~2000 tokens | ~$0.6 |
| 相关性评分（Tool 内） | 20-50 篇 | ~500 tokens | ~$0.15 |
| 用户画像/记忆查询 | 2-5 次 | ~500 tokens | ~$0.02 |

**预估月成本**: $30-60 (个人使用，Agent 模式比工作流略高)

**成本控制策略**：
- Agent 推理用较便宜的模型（如 Claude Haiku / GPT-4o-mini），摘要生成用较强模型
- 评分尽量用规则引擎（零 LLM 成本），只对模糊场景用 LLM 辅助判定
- Tool 执行结果缓存，相同输入不重复调用 LLM
- 设置 maxSteps 上限，避免 Agent 无限循环

### 16.2 基础设施成本

| 服务 | 规格 | 月成本 |
|------|------|--------|
| 云服务器 | 2C4G | ~$20 |
| 数据库 | MySQL (Docker 自建) | $0（包含在主机内） |
| Redis | Docker 自建 | $0（包含在主机内） |

**预估月成本**: $20-30 (个人部署，MySQL + Redis 自建)

**MVP 成本优化**：全部自建在一台 2C4G 主机上，月成本仅主机费用 + LLM API 费用

---

## 十七、风险与挑战

### 17.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 微信公众号采集困难 | 核心功能受限 | 使用第三方服务，备选 RSS |
| LLM 调用成本过高 | 运营成本增加 | 本地模型兜底，缓存优化 |
| Agent 决策不稳定 | 每次执行结果差异大 | 优化 system prompt、设置 Tool 调用约束、记录日志持续优化 |
| Agent Loop 步数超限 | 任务不完整 | 设置合理 maxSteps、关键 Tool 设置超时、降级到固定流水线兜底 |
| 数据源 API 限制 | 采集频率受限 | 分布式采集，合理调度 |

### 17.2 产品风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 过度推送打扰用户 | 用户流失 | 智能推送策略，频率控制 |
| 摘要质量不稳定 | 信任度下降 | 多模型对比，质量监控 |
| 隐私数据安全 | 合规风险 | 数据加密，最小权限 |

### 17.3 风险清单与规避策略

- **公众号采集不稳定**：MVP 先走第三方 RSS 化/聚合服务；后续再替换为自建采集器
- **LLM 成本/延迟**：只对候选 Top K 调用、缓存幂等、失败降级
- **信息噪声过大**：优先做可解释的规则过滤 + 强去重，确保日报质量
- **过度打扰**：默认仅日报；实时推送需显式开启且支持免打扰

---

## 十八、后续演进

与 Agent 开发能力成长对齐的演进方向：

- **Agent 能力深化**：
  - Level 0：**自建 Agent Loop**（直接调 LLM API + 手写循环，深入理解 Agent 原理）
  - Level 1：切换 Vercel AI SDK（体验框架抽象价值，专注 Tool 和 Prompt 设计）
  - Level 2：引入记忆系统和反思能力（Agent 从经验中学习）
  - Level 3：引入 Mastra.js，体验多 Agent 协作
  - Level 4：Agent 自主进化（自优化 prompt、自建议新 Tool）
- **Agent 开发能力提升路径**：
  - Level 0: 理解 Tool Calling 协议和 Agent Loop 的底层机制（自建）
  - Level 1: 掌握 System Prompt Engineering 对 Agent 行为的影响
  - Level 2: 学习 Agent 记忆系统设计（短期/长期/语义记忆）
  - Level 3: 实践多 Agent 编排与协作模式
  - Level 4: 探索 Agent 自主进化和 Meta-Learning
- **技术栈演进**：
  - 向量能力：当内容量 > 1 万条时引入 pgvector 或 Qdrant，用于语义去重和语义搜索
  - 数据库迁移：如需 JSONB 高级查询或向量能力，可从 MySQL 迁移到 PostgreSQL
  - 自适应学习：先做"建议列表 + 人工确认"模式，再逐步自动化
  - 记忆系统增强：从 MySQL 记忆 → 向量记忆 → 知识图谱
- **待引入的能力（已规划，暂未实现）**：
  - **热点发现能力**（Phase 2+）：当前 MVP 聚焦个性化推荐。后续可引入热点发现机制，包括：
    - 跨源话题聚合：检测同一事件/话题在多个来源中出现（如"Claude 发布新版本"同时出现在 GitHub Trending、RSS、公众号中）
    - 趋势检测：短时间内某话题被大量讨论，即使不在用户画像标签中也应推送
    - 突发性评分维度：在现有评分模型中加入"突发性"维度（短时间内多源提及的权重提升）
    - 实现方式：可作为新的 Agent Tool（如 `detect_trending_topics`），Agent 在采集后自动调用
  - **System Prompt 版本管理与 A/B 测试**（Phase 2+）：
    - System Prompt 是 Agent 行为的核心控制手段，不同的 prompt 对 Agent 决策影响巨大
    - 后续可引入 prompt 版本管理（每个版本标记日期和变更内容）
    - 可选：A/B 测试机制（同一批内容用不同 prompt 执行，对比推荐命中率）
    - 这是 Agent 开发能力中"Prompt Engineering"的高阶实践

---

## 十九、总结

本方案设计了一个**真正的 Agent 项目**——智能热点信息管家。**这不是一个 LLM 工作流**（固定管道调用 LLM），而是一个以 LLM 为"大脑"、通过 Tool Calling 自主决策的智能体。

**Agent 项目的核心特征（区别于工作流）**：
1. **LLM 是决策中枢**：不是代码写死流程，而是 Agent 自主决定调用哪些 Tool、以什么顺序
2. **Agent Loop**：感知→思考→行动→观察→再思考 的循环，通过 Vercel AI SDK `maxSteps` 实现
3. **Tool Calling**：所有业务能力封装为 Tool，Agent 通过 LLM tool calling 自主选择调用
4. **记忆与反思**：Agent 拥有短期/长期记忆，能回顾历史决策、学习经验、调整行为
5. **可扩展**：加功能 = 注册新 Tool，Agent 自动学会使用，无需改动编排逻辑

**项目双重目标**：
- **产品目标**：构建一个自主运行的个人信息管家，每天产出高质量精选推送
- **学习目标**：通过实战系统性提升 Agent 开发能力（Tool 设计、Prompt 工程、Agent Loop、记忆系统、多 Agent 协作）

技术选型遵循**全栈 TypeScript 统一**原则：
- 前端：React + TailwindCSS + shadcn/ui
- 后端：NestJS (TypeScript)
- **Agent 框架**：自建 Agent Loop（Level 0）→ Vercel AI SDK（Level 1）→ Mastra.js（Level 3）
- Agent/LLM：@anthropic-ai/sdk + Vercel AI SDK
- 数据库：MySQL（MVP）→ PostgreSQL（长期）
- 任务调度：@nestjs/schedule + Bull Queue
- 通过 REST API 前后端分离

**核心取舍**：
- **不引入 Python**：全栈 TS 统一，Agent 生态（@anthropic-ai/sdk → Vercel AI SDK → Mastra.js）已足够成熟
- **先自建再用框架**：里程碑 1 自建 Agent Loop 深入理解原理，里程碑 2 切 SDK 体验抽象价值，这是提升 Agent 开发能力的最佳路径
- **不使用向量数据库（MVP）**：URL 去重 + simhash + LLM 判定已够用
- **MySQL 而非 PostgreSQL（MVP）**：足够、熟悉、部署简单

**Agent 能力成长路径**：
```
Level 0 (里程碑 1): 自建 Agent Loop —— 理解底层原理
Level 1 (里程碑 2): 切换 Vercel AI SDK —— 体验框架抽象价值
Level 2: 记忆增强 + 反思能力 + 自适应
Level 3 (Mastra.js): 多 Agent 协作
Level 4: Agent 自主进化
```

建议从 Level 0 开始，**先自己搭一个能跑的 Agent Loop**（直接调 LLM API + 手写循环），把 tool calling 协议、消息格式、循环控制、错误处理都亲手实现一遍。跑通后再切到 SDK，你会深刻理解每一层抽象的价值。
