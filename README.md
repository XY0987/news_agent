# 📰 News Agent — 智能新闻聚合与推送系统

一个以 LLM 为"大脑"的**个人信息管家 Agent**。根据用户画像自动采集、过滤、AI 评分、AI 摘要、个性化推送多平台信息源，并持续自我优化。

**这不是 LLM 工作流（固定管道），而是真正的 Agent 系统** — LLM 自主决策调用哪些工具、以什么顺序执行、推送什么内容。

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

## ✨ 核心特性

- **🤖 自建 Agent Loop** — 感知→思考→行动→观察→再思考，LLM 自主编排 14 种工具
- **📡 多源采集** — 微信公众号、RSS、GitHub Trending，可扩展
- **🧠 AI 评分 + 摘要** — 基于用户画像的多维度个性化评分（相关性/质量/时效/新颖度/可操作性）和 AI 摘要
- **📧 智能推送** — 邮件推送，高分文章完整展开，低分文章折叠，附带行动建议
- **🔄 兜底安全网** — Agent 失败时自动降级为规则引擎，确保每日推送不中断
- **💾 Agent 记忆** — 存储决策经验、来源质量评估，持续自我优化
- **🎨 完整前端** — 10 个页面，支持数据源管理、用户画像编辑、Agent 洞察分析等

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (:3000)                  │
│         React 19 + Vite + Zustand + shadcn/ui       │
└────────────────────────┬────────────────────────────┘
                         │ /api proxy
┌────────────────────────▼────────────────────────────┐
│                    Backend (:8000)                   │
│                  NestJS 11 + TypeORM                 │
│  ┌───────────────────────────────────────────────┐  │
│  │              Agent Loop (LLM 驱动)             │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────────────┐│  │
│  │  │ 感知工具 │ │ 行动工具 │ │   记忆 + 推送    ││  │
│  │  │Profile  │ │Collect  │ │ Memory / Email   ││  │
│  │  │Feedback │ │Filter   │ │ Digest / Log     ││  │
│  │  │ Memory  │ │Score    │ │                  ││  │
│  │  │         │ │Summary  │ │                  ││  │
│  │  └─────────┘ └─────────┘ └──────────────────┘│  │
│  └───────────────────────────────────────────────┘  │
└──────────┬─────────────────────────┬────────────────┘
           │                         │
    ┌──────▼──────┐          ┌───────▼───────┐
    │ MySQL (:3306)│          │ Redis (:6379) │
    └─────────────┘          └───────────────┘
```

## 📂 项目结构

```
news_agent/
├── backend/src/
│   ├── common/
│   │   ├── database/entities/    # 9 个 TypeORM 实体
│   │   ├── config/               # 全局配置
│   │   └── redis/                # Redis 模块
│   └── modules/
│       ├── agent/                # 🤖 Agent Loop + Tool Registry
│       ├── collector/            # 📡 采集（微信/RSS/GitHub）
│       ├── content/              # 📄 内容 CRUD
│       ├── digest/               # 📰 日报/周报
│       ├── feedback/             # 👍 用户反馈
│       ├── filter/               # 🔍 过滤去重
│       ├── memory/               # 🧠 Agent 记忆
│       ├── notification/         # 📧 推送通知（Email/Telegram）
│       ├── scheduler/            # ⏰ 定时任务
│       ├── scorer/               # 📊 规则评分
│       ├── source/               # 📡 数据源管理
│       ├── summary/              # ✍️ AI 摘要生成
│       └── user/                 # 👤 用户管理
├── frontend/src/
│   ├── api/                      # Axios API 封装
│   ├── components/               # 29 个 UI 组件
│   ├── pages/                    # 10 个页面
│   ├── store/                    # Zustand 状态管理
│   ├── types/                    # TypeScript 类型
│   └── utils/                    # 工具函数
└── docker-compose.yml
```

## 🚀 快速开始

### 环境要求

- **Node.js >= 22**（NestJS 11 + TS 5.7 + ES2023 需要，仅本地开发）
- Docker & Docker Compose
- 一个兼容 OpenAI API 的 LLM 服务（DeepSeek、OpenRouter 等均可）

### 前置准备：启动 MySQL 和 Redis 容器

项目不内置数据库容器，需要先在宿主机上创建并启动独立的 MySQL 和 Redis 容器。

**首次创建：**

```bash
# MySQL 5.7
docker run -d \
  --name mysql-container \
  -e MYSQL_ROOT_PASSWORD=你的密码 \
  -p 3306:3306 \
  -v ~/docker/mysql_data:/var/lib/mysql \
  mysql:5.7

# 创建项目数据库（首次需要）
docker exec mysql-container mysql -u root -p你的密码 -e "CREATE DATABASE IF NOT EXISTS news_agent DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Redis 7
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v ~/docker/redis/data:/data \
  redis:7 \
  redis-server --requirepass "你的密码" --appendonly yes
```

**日常启动/停止：**

```bash
# 启动
docker start mysql-container redis-container

# 停止
docker stop mysql-container redis-container

# 查看状态
docker ps --filter "name=mysql-container" --filter "name=redis-container"
```

### 方式一：Docker Compose 部署（推荐）

项目通过共享 Docker 网络（`news_agent_net`）让 API 容器直接通过容器名访问已有的 MySQL/Redis 容器，无需端口映射。

```bash
git clone https://github.com/your-username/news-agent.git
cd news-agent

# 1. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 LLM API Key、SMTP 等配置
# ⚠️ Docker 部署时 DATABASE_HOST 和 REDIS_HOST 必须填容器名：
#   DATABASE_HOST=mysql-container
#   REDIS_HOST=redis-container
#   REDIS_PORT=6379（容器内部端口，非宿主机映射端口）

# 2. 一键启动（推荐使用 start.sh）
bash start.sh
```

`start.sh` 会自动完成以下步骤：
1. 启动 MySQL/Redis 外部容器
2. 等待 MySQL 就绪
3. `docker-compose up -d --build` 构建并启动前后端服务
4. 将 mysql-container、redis-container 加入共享网络 `news_agent_net`
5. 重启 api 容器确保数据库连接生效

访问 http://localhost:3000（前端） | http://localhost:8000（后端 API）

**停止服务：**

```bash
docker-compose down
```

### 方式二：本地开发

本地开发时，`backend/.env` 中的 HOST 需要改为实际可访问的地址（如 `127.0.0.1` 或远程 IP）。

```bash
# 确认 Node 版本
node -v  # 需要 >= 22

# 修改 backend/.env 中的数据库连接：
#   DATABASE_HOST=127.0.0.1（或远程 IP）
#   REDIS_HOST=127.0.0.1（或远程 IP）
#   REDIS_PORT=6379（或宿主机映射的端口，如 6001）

# 后端
cd backend
npm install
npm run start:dev     # ⚠️ 不要用 ts-node 启动！

# 前端（新终端）
cd frontend
npm install
npm run dev
```

前端: http://localhost:3000 | 后端: http://localhost:8000

> **注意**：Docker 部署和本地开发使用不同的 HOST 配置。Docker 部署用容器名（`mysql-container`），本地开发用 IP 地址（`127.0.0.1` 或远程 IP）。切换时需修改 `backend/.env`。

## ⚙️ 环境变量配置

在 `backend/.env` 中配置：

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `DATABASE_HOST` | ✅ | MySQL 地址 |
| `DATABASE_PORT` | ✅ | MySQL 端口（默认 3306） |
| `DATABASE_USER` | ✅ | MySQL 用户名 |
| `DATABASE_PASSWORD` | ✅ | MySQL 密码 |
| `DATABASE_NAME` | ✅ | 数据库名 |
| `REDIS_HOST` | ✅ | Redis 地址 |
| `REDIS_PORT` | ✅ | Redis 端口（默认 6379） |
| `LLM_URL` | ✅ | LLM API 地址（OpenAI 兼容格式） |
| `LLM_API_KEY` | ✅ | LLM API Key |
| `LLM_MODEL` | ✅ | 模型名称（如 `deepseek-chat`） |
| `SMTP_HOST` | 📧 | SMTP 邮件服务器 |
| `SMTP_PORT` | 📧 | SMTP 端口 |
| `SMTP_USER` | 📧 | SMTP 用户名 |
| `SMTP_PASSWORD` | 📧 | SMTP 密码 |
| `SMTP_FROM` | 📧 | 发件人邮箱 |
| `WECHAT_TOKEN` | 🔧 | 微信公众号采集 Token |
| `WECHAT_COOKIE` | 🔧 | 微信公众号 Cookie |
| `GITHUB_TOKEN` | 🔧 | GitHub API Token |

> ✅ 必填 | 📧 邮件推送需要 | 🔧 对应采集源需要

## 🤖 Agent 工作流程

Agent 每次执行时，LLM 自主决策以下工具的调用顺序和参数：

```
1. 📖 读取用户画像 + 历史反馈 + 决策记忆
2. 📡 采集内容（微信公众号/RSS/GitHub）
3. 🔍 过滤去重（标题相似度 + 已推送去重）
4. ✍️ AI 批量生成摘要 + 多维度评分
5. 📧 发送每日精选推送
6. 🧠 存储本次决策经验到记忆
```

### Tool 一览

| 类别 | 工具 | 说明 |
|------|------|------|
| 感知 | `read_user_profile` | 读取用户画像和偏好 |
| 感知 | `read_feedback_history` | 读取最近反馈 |
| 感知 | `query_memory` | 查询历史决策经验 |
| 行动 | `collect_wechat` | 采集微信公众号文章 |
| 行动 | `filter_and_dedup` | 过滤去重 |
| 行动 | `score_contents` | 规则预评分 |
| 行动 | `batch_generate_summaries` | AI 批量摘要 + 评分 |
| 推送 | `send_daily_digest` | 发送每日精选邮件 |
| 记忆 | `store_memory` | 存储决策经验 |
| 记忆 | `analyze_source_quality` | 分析来源质量 |

## 📧 邮件效果

推送邮件自动按 AI 评分分区：
- **🔥 精选推荐**（评分 ≥ 60）— 完整展开，含摘要、评分拆解、行动建议
- **📂 更多文章**（评分 < 60）— 折叠展示，含摘要，点击可查看

## 🗄️ 数据模型

| 实体 | 说明 |
|------|------|
| `User` | 用户（画像/偏好/通知设置） |
| `Source` | 数据源（类型/配置/统计） |
| `Content` | 采集内容（标题/正文/元数据） |
| `ContentScore` | AI 评分（多维度评分/是否入选） |
| `UserContentInteraction` | 用户-内容交互（摘要/建议） |
| `Feedback` | 用户反馈（有用/无用/收藏） |
| `Memory` | Agent 记忆（类型/置信度） |
| `Digest` | 推送记录（渲染内容/发送时间） |
| `AgentLog` | 决策日志（会话/动作/推理） |

## 🛣️ 成长路线

| 阶段 | 方案 | 状态 |
|------|------|------|
| Level 0 | 自建 Agent Loop + Tool Calling | ✅ 当前 |
| Level 1 | 迁移到 Vercel AI SDK | 🔜 计划 |
| Level 2 | 记忆增强（长期记忆/反馈闭环） | 🔜 计划 |
| Level 3 | Mastra.js 多 Agent 协作 | 📋 远期 |
| Level 4 | 自主进化（自动调整策略） | 📋 远期 |

## 📄 License

MIT
