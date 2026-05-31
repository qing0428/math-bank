# MathBank Docker 部署教程

本文档详细介绍如何在各种 NAS 系统和服务器上通过 Docker 部署 MathBank 数学智能题库系统。

---

## 目录

- [部署前提](#部署前提)
- [方案一：GHCR 拉取镜像（推荐）](#方案一ghcr-拉取镜像推荐)
- [方案二：本地构建镜像](#方案二本地构建镜像)
- [飞牛 OS (fnOS) 部署](#飞牛-os-fnos-部署)
- [群晖 DSM 部署](#群晖-dsm-部署)
- [威联通 QTS 部署](#威联通-qts-部署)
- [Unraid 部署](#unraid-部署)
- [通用 Linux 服务器部署](#通用-linux-服务器部署)
- [常见问题](#常见问题)
- [数据备份与恢复](#数据备份与恢复)
- [更新升级](#更新升级)

---

## 部署前提

### 硬件要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 1 核 | 2 核+ |
| 内存 | 512MB | 1GB+ |
| 存储 | 1GB | 5GB+（含题库数据） |
| 架构 | x86_64 / ARM64 | x86_64 |

### 网络要求

- NAS 需要能访问互联网（拉取镜像或下载依赖）
- 如果在国内网络环境，建议配置 Docker 镜像加速或代理
- 部署后使用 AI 功能需要能访问 LLM API（如阿里云百炼、DeepSeek 等）

### 端口说明

| 端口 | 用途 | 可自定义 |
|------|------|---------|
| 3080 | Web 访问端口 | ✅ 修改 docker-compose.yml |
| 3001 | 容器内部端口（不对外暴露） | ❌ |

---

## 方案一：GHCR 拉取镜像（推荐）

直接从 GitHub Container Registry 拉取预构建镜像，无需在 NAS 上安装编译工具。

### 1. 创建数据目录

```bash
# 创建项目目录（路径可自定义）
mkdir -p /vol1/docker/mathbank/data
cd /vol1/docker/mathbank
```

### 2. 创建 docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
services:
  app:
    image: ghcr.io/qing0428/math-bank:latest
    container_name: mathbank
    ports:
      - "3080:3001"
    volumes:
      - ./data:/data
    environment:
      - DB_PATH=/data/mathbank.db
      - PORT=3001
    restart: unless-stopped
EOF
```

### 3. 登录 GHCR 并拉取

```bash
# 登录 GitHub Container Registry
docker login ghcr.io -u qing0428
# 密码输入你的 GitHub Personal Access Token（需要 read:packages 权限）
# Token 生成地址：https://github.com/settings/tokens

# 拉取镜像
docker compose pull

# 启动容器
docker compose up -d
```

### 4. 访问

浏览器打开 `http://<NAS的IP>:3080`

---

## 方案二：本地构建镜像

如果无法访问 GHCR，可以从源码本地构建。

### 1. 克隆仓库

```bash
mkdir -p /vol1/docker/mathbank
cd /vol1/docker/mathbank
git clone https://github.com/qing0428/math-bank.git src
cd src
```

### 2. 构建并启动

```bash
# 构建镜像（首次约 3-5 分钟）
docker compose build --no-cache

# 启动容器
docker compose up -d

# 查看日志
docker logs -f mathbank
```

> **注意**：`better-sqlite3` 是原生模块，构建时需要 `python3 make g++`，Dockerfile 中已包含。

---

## 飞牛 OS (fnOS) 部署

飞牛 OS 是国产 NAS 系统，支持 Docker 和 Docker Compose。

### 方式 A：SSH 命令行部署（推荐）

#### 1. 开启 SSH

- 进入 **控制面板** → **终端与 SNMP** → **终端**
- 勾选 **启用 SSH 功能**
- 记下端口号（默认 22）

#### 2. SSH 连接

```bash
ssh <你的用户名>@<飞牛NAS的IP>
```

#### 3. 配置 Docker 代理（如果需要）

如果拉取镜像慢或失败，配置 Docker 代理：

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d

sudo tee /etc/systemd/system/docker.service.d/proxy.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:你的代理端口"
Environment="HTTPS_PROXY=http://127.0.0.1:你的代理端口"
Environment="NO_PROXY=localhost,127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

#### 4. 创建目录并部署

```bash
# 创建目录
sudo mkdir -p /vol1/1000/Docker\ Compose/Mathbank/data
cd /vol1/1000/Docker\ Compose/Mathbank

# 创建 docker-compose.yml
sudo tee docker-compose.yml << 'EOF'
services:
  app:
    image: ghcr.io/qing0428/math-bank:latest
    container_name: mathbank
    ports:
      - "3080:3001"
    volumes:
      - ./data:/data
    environment:
      - DB_PATH=/data/mathbank.db
      - PORT=3001
    restart: unless-stopped
EOF

# 登录 GHCR
sudo docker login ghcr.io -u qing0428

# 拉取并启动
sudo docker compose pull
sudo docker compose up -d

# 查看日志
sudo docker logs -f mathbank
```

#### 5. 访问

浏览器打开 `http://<飞牛IP>:3080`

### 方式 B：飞牛 Docker 图形界面部署

1. 打开飞牛 OS 的 **Docker** 应用
2. 进入 **Compose** → **创建项目**
3. 项目名称填写 `mathbank`
4. 项目路径选择 `/vol1/1000/Docker Compose/Mathbank`
5. 选择 **使用配置文件**，粘贴上面的 `docker-compose.yml` 内容
6. 点击 **启动**

### 方式 C：本地构建

```bash
cd /vol1/1000/Docker\ Compose/Mathbank
git clone https://github.com/qing0428/math-bank.git src
cd src
sudo docker compose build --no-cache
sudo docker compose up -d
```

---

## 群晖 DSM 部署

### 方式 A：Container Manager（DSM 7.2+）

1. 打开 **Container Manager**（原 Docker 套件）
2. 进入 **项目** → **新建**
3. 项目名称：`mathbank`
4. 路径：选择 `/docker/mathbank`
5. 选择 **上传 docker-compose.yml** 或直接粘贴：

```yaml
services:
  app:
    image: ghcr.io/qing0428/math-bank:latest
    container_name: mathbank
    ports:
      - "3080:3001"
    volumes:
      - ./data:/data
    environment:
      - DB_PATH=/data/mathbank.db
      - PORT=3001
    restart: unless-stopped
```

6. 点击 **下一步** → **完成**

### 方式 B：SSH 命令行

```bash
ssh admin@<群晖IP>
sudo -i
mkdir -p /volume1/docker/mathbank/data
cd /volume1/docker/mathbank

# 创建 docker-compose.yml（内容同上）
# ...

docker compose pull
docker compose up -d
```

### 方式 C：Container Manager 图形界面

1. **Container Manager** → **映像** → **新增** → **从 URL 添加**
2. 输入：`ghcr.io/qing0428/math-bank:latest`
3. 下载完成后，进入 **容器** → **新增**
4. 选择映像，端口设置 `3080 → 3001`
5. 存储空间添加 `/volume1/docker/mathbank/data` → `/data`
6. 环境变量添加 `DB_PATH=/data/mathbank.db` 和 `PORT=3001`
7. 启用 **自动重新启动**

---

## 威联通 QTS 部署

### 方式 A：Container Station

1. 打开 **Container Station**
2. 进入 **创建** → **应用程序**
3. 粘贴 docker-compose.yml 内容
4. 点击 **创建 + 运行**

### 方式 B：SSH 命令行

```bash
ssh admin@<威联通IP>
sudo -i

mkdir -p /share/Container/mathbank/data
cd /share/Container/mathbank

# 创建 docker-compose.yml
# ...

docker compose pull
docker compose up -d
```

---

## Unraid 部署

### 方式 A：Docker Compose 插件

1. 安装 **Docker Compose Manager** 插件（Community Applications 中搜索）
2. 创建新的 compose 项目
3. 粘贴 docker-compose.yml 内容
4. 启动

### 方式 B：命令行

```bash
mkdir -p /mnt/user/appdata/mathbank/data
cd /mnt/user/appdata/mathbank

# 创建 docker-compose.yml
# ...

docker compose pull
docker compose up -d
```

---

## 通用 Linux 服务器部署

适用于 Ubuntu、Debian、CentOS 等任何安装了 Docker 的 Linux 系统。

### 1. 安装 Docker

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# CentOS / RHEL
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
```

### 2. 部署

```bash
mkdir -p /opt/mathbank/data
cd /opt/mathbank

cat > docker-compose.yml << 'EOF'
services:
  app:
    image: ghcr.io/qing0428/math-bank:latest
    container_name: mathbank
    ports:
      - "3080:3001"
    volumes:
      - ./data:/data
    environment:
      - DB_PATH=/data/mathbank.db
      - PORT=3001
    restart: unless-stopped
EOF

docker login ghcr.io -u qing0428
docker compose pull
docker compose up -d
```

### 3. 防火墙放行端口

```bash
# Ubuntu (ufw)
sudo ufw allow 3080

# CentOS (firewalld)
sudo firewall-cmd --add-port=3080/tcp --permanent
sudo firewall-cmd --reload
```

---

## 常见问题

### Q: 拉取镜像超时 / 网络不通

**A: 配置 Docker 镜像加速**

```bash
# 编辑 daemon.json
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://registry.docker-cn.com"
  ]
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

或者配置代理（见飞牛 OS 部分）。

### Q: 端口 3080 被占用

**A: 修改端口映射**

编辑 `docker-compose.yml`，将 `3080` 改为其他端口：

```yaml
ports:
  - "8080:3001"  # 改为 8080 或其他未占用端口
```

然后重启：`docker compose up -d`

### Q: 容器启动后无法访问

**A: 检查日志**

```bash
docker logs mathbank
```

常见原因：
- 端口被防火墙拦截
- 端口映射配置错误
- 数据目录权限不足

### Q: 数据库文件在哪里

**A: 在宿主机的 data 目录中**

```
<你的部署目录>/data/mathbank.db
```

这是 SQLite 文件，可以直接备份复制。

### Q: 如何修改 API 设置

**A: 在 Web 界面中操作**

1. 打开 `http://<IP>:3080`
2. 点击左侧菜单 **API 设置**
3. 配置视觉识别和文本生成 API

支持的 API：
- **阿里云百炼**（DashScope）：推荐国内使用
- **DeepSeek**：性价比高
- **OpenAI**：GPT-4o 等
- 其他 OpenAI 兼容接口

---

## 数据备份与恢复

### 备份

```bash
# 方法 1：直接复制数据库文件
cp /vol1/docker/mathbank/data/mathbank.db /vol1/backup/mathbank_$(date +%Y%m%d).db

# 方法 2：用 Docker 命令备份（不停机）
docker exec mathbank sqlite3 /data/mathbank.db ".backup /data/backup.db"
docker cp mathbank:/data/backup.db /vol1/backup/mathbank_$(date +%Y%m%d).db
```

### 恢复

```bash
# 停止容器
docker compose down

# 替换数据库文件
cp /vol1/backup/mathbank_20260531.db /vol1/docker/mathbank/data/mathbank.db

# 重新启动
docker compose up -d
```

### 自动备份（crontab）

```bash
# 编辑定时任务
crontab -e

# 每天凌晨 3 点自动备份
0 3 * * * cp /vol1/docker/mathbank/data/mathbank.db /vol1/backup/mathbank_$(date +\%Y\%m\%d).db
```

---

## 更新升级

### GHCR 镜像方式

```bash
cd /vol1/docker/mathbank

# 拉取最新镜像
docker compose pull

# 重启容器（自动使用新镜像）
docker compose up -d

# 验证版本
docker logs --tail 5 mathbank
```

### 本地构建方式

```bash
cd /vol1/docker/mathbank/src

# 拉取最新代码
git pull

# 重新构建并启动
docker compose build --no-cache
docker compose up -d
```

---

## 架构图

```
┌─────────────────────────────────────────────────┐
│                    用户浏览器                      │
│              http://<IP>:3080                     │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              Docker 容器 (mathbank)               │
│                                                   │
│   Express (Node.js) 监听 :3001                    │
│   ├── /api/*      → REST API (SQLite 读写)        │
│   ├── 静态文件     → dist/ (Vite 构建产物)         │
│   └── 其他路径     → index.html (SPA 路由)        │
│                                                   │
│   SQLite 数据库: /data/mathbank.db                │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────▼───────┐
              │  宿主机 data/  │  ← 持久化存储
              │  mathbank.db   │
              └───────────────┘
```

---

## 版本说明

| 版本 | 说明 |
|------|------|
| v1.0.16 | 自动保存组卷、题型分组顺序、教师答案去 markdown |
| v1.0.15 | 移除 A3 组卷，简化为 A4 |
| v1.0.14 | A3 密封线和双栏布局 |
| v1.0.13 | 题库编辑完整字段、密封线排版修正 |
| v1.0.12 | 组卷格式修复、Word 导出优化、PDF 分页修复 |
| v1.0.11 | 解析附带图片、表格文字描述、选择题完整识别 |
| v1.0.9 | 题库图片自适应、解析换行渲染 |
| v1.0.8 | 表格列规范修复、波浪号显示 |
| v1.0.7 | boxed 修复、默认勾选、解析可编辑、页面状态保留 |

镜像地址：`ghcr.io/qing0428/math-bank:latest`

GitHub 仓库：https://github.com/qing0428/math-bank
