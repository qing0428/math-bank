# MathBank — 数学智能题库系统

基于多模态大模型的数学智能题库系统，将纸质数学试卷秒级转化为结构化数字题库。

## 功能特性

- **拍照识别**：上传试卷图片，AI 自动识别公式、图形与题型，输出标准 LaTeX 格式
- **批量录入**：多张试卷图片一次性上传，按题号顺序提取全部题目
- **两阶段推理**：先描述后结构化，降低推理复杂度，提升识别准确率
- **年级自适应**：根据年级自动调整解题策略（小学算术 → 高中导数）
- **多维检索**：按年级、知识板块、难度、标签多维度筛选题目
- **AI 解题**：一键生成适配年级的详细解题步骤
- **AI 打标**：自动为题目生成知识点标签
- **LaTeX 渲染**：KaTeX 引擎实时预览数学公式

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite |
| 样式方案 | Tailwind CSS 3 |
| 公式渲染 | KaTeX |
| 后端服务 | Node.js + Express |
| 数据库 | SQLite（better-sqlite3，WAL 模式）|
| 部署方案 | Docker 单容器（Node.js 同时托管前端 + API）|
| API 协议 | OpenAI Chat Completions 兼容接口 |

## 快速开始

### 本地开发

```bash
# 安装前端依赖
npm install
# 安装后端依赖
cd server && npm install && cd ..
# 启动开发服务器
npm run dev
```

### Docker 部署

```bash
# 构建并启动（单容器）
docker compose build --no-cache
docker compose up -d

# 查看日志
docker logs -f mathbank
```

访问 http://localhost:3080

### 架构说明

单容器部署：Node.js 同时负责前端静态文件托管和后端 API 服务。

```
用户请求 → :3080 → Express (Node.js)
                      ├── /api/*   → REST API（SQLite 读写）
                      ├── 静态文件  → dist/（Vite 构建产物）
                      └── 其他路径  → index.html（SPA 路由）
```

SQLite 数据通过 Docker volume (`mathbank-data`) 持久化存储在 `/data/mathbank.db`。

## 使用说明

1. **配置 API**：进入「API 设置」，配置视觉识别和文本生成 API（支持阿里云百炼、DeepSeek 等）
2. **录入题目**：上传试卷图片，AI 自动识别并填充题目内容、答案、年级、知识板块
3. **题库检索**：按年级、难度、标签等多维度筛选查找题目
4. **生成解析**：点击按钮即可生成适配年级的解题步骤

## 支持的 API

- 阿里云百炼（DashScope）原生接口及兼容模式
- OpenAI / DeepSeek / 其他 OpenAI 兼容接口
- 视觉识别与文本生成可配置不同服务商
