# Ticket Monitor System - Kubernetes Deployment Guide

本指南说明如何将 Gateway (Elysia.js) 和 Probe (Go) 部署到 Kubernetes (k8s) 集群中。

## 部署架构设计

1. **Namespace**: 部署在独立的命名空间 `ticket-monitor` 中。
2. **Gateway (网关)**:
   - **Deployment**: 单副本部署 (`replicas: 1`)，使用 `Recreate` 重启策略。这是为了确保 SQLite 数据库 (`gateway.db`) 文件访问的一致性，防止多 Pod 并发写入损坏数据库，并避免多实例同时挂载 `ReadWriteOnce` (RWO) 云盘冲突。
   - **ConfigMap**: 将监控的 `config.json` 抽取为 ConfigMap。当监控的演出 ID 或轮询时间变化时，直接修改 ConfigMap 并对网关进行滚动更新。
   - **PersistentVolumeClaim (PVC)**: 网关依赖 SQLite 记录历史门票变动（`diffs` 表）、实时票种状态（`tickets` 表）和节点在线状态。为了防止 Pod 重启后数据丢失，我们为其挂载了一个持久卷。
   - **Service**: 声明为一个 `ClusterIP` 类型的 Service（名称为 `ticket-gateway`），向内网公开端口 `3000`。
3. **Probe (探针)**:
   - **DaemonSet**: 在集群的每个 Node 上部署一个 Probe 容器。
   - **Environment Variables**:
     - `NODE_NAME`: 通过 Downward API 获取当前 Pod 所在的物理节点名称并上报给网关。
     - `GATEWAY_WS_URL`: 填入网关的内部集群地址 `ws://ticket-gateway.ticket-monitor.svc.cluster.local:3000/ws/probe`。
     - `PROBE_TOKEN`: 与网关共享的 WebSocket 鉴权密钥（来自 Secret `probe-gateway-auth`）。
   - **鉴权**: Gateway 与 Probe 使用同一 `PROBE_TOKEN`；探针在 WS 握手时发送 `Authorization: Bearer <token>`。

---

## 自动化镜像构建 (GitHub Actions)

项目内置了 GitHub Actions 工作流文件，可以在代码推送到 GitHub 时，自动构建并推送网关和探针的多架构 Docker 镜像。

工作流配置在：`.github/workflows/build-docker.yml`。

### 触发条件
- 代码被推送到 `main` 或 `master` 分支（自动构建并推送 `latest` 标签和分支名标签）。
- 推送了形如 `v*` 的版本 Tag（自动构建并提取 SemVer 语义化标签）。
- 手动在 GitHub Actions 页面触发构建（`workflow_dispatch`）。

### 默认注册表
默认使用 GitHub 官方提供的 **GitHub Container Registry (GHCR)**。镜像路径为：
- Gateway 网关：`ghcr.io/<your-github-username-or-org>/<your-repo-name>/ticket-gateway:latest`
- Go 探针：`ghcr.io/<your-github-username-or-org>/<your-repo-name>/ticket-probe:latest`

### 镜像多平台/多架构支持
GitHub Action 构建脚本已默认配置支持 **`linux/amd64`** (标准服务器 CPU) 和 **`linux/arm64`** (苹果 M系列芯片 / 部分云厂商 ARM 服务器)，利用 Docker Buildx 在构建时自动合并为一个 Multi-Arch 镜像，拉取时会自动根据所在主机架构下载对应版本。

---

## 快速开始

### 1. 使用 GitHub Action 编译并发布镜像
1. 将本地项目代码上传至 GitHub 仓库。
2. GitHub Action 会自动执行构建并推送至 GHCR。
3. 您可以在 GitHub 个人主页的 "Packages" 面板看到发布成功的镜像（初次发布建议将其设置为 **Public** 以免 k8s 拉取镜像时报权限错误，或者配置 `imagePullSecrets`）。

*(如果您想使用阿里云、腾讯云或私有 Harbor 仓库，只需在 `.github/workflows/build-docker.yml` 中修改 `REGISTRY` 环境变量，并在 `Log in` 步骤使用您自己的 secrets 即可。)*

### 2. 部署到 Kubernetes
所有的 K8s 部署清单存放在 `deploy/` 目录中。

#### A. 创建命名空间
```bash
kubectl create namespace ticket-monitor
```

#### B. 部署网关配置、鉴权密钥与存储
```bash
# 先编辑 deploy/probe-gateway-secret.yaml，将 token 替换为强随机串（openssl rand -hex 32）
kubectl apply -f deploy/probe-gateway-secret.yaml
kubectl apply -f deploy/gateway-configmap.yaml
kubectl apply -f deploy/gateway-pvc.yaml
```

#### C. 部署网关实例及服务
> **注意**：部署前，请先编辑 `deploy/gateway-deployment.yaml`，将镜像地址修改为您实际推送到 GHCR 的地址（如 `ghcr.io/yourname/yourrepo/ticket-gateway:latest`）。

```bash
kubectl apply -f deploy/gateway-deployment.yaml
kubectl apply -f deploy/gateway-service.yaml
```

#### D. 部署探针 (DaemonSet)
> **注意**：部署前，请先编辑 `deploy/probe-daemonset.yaml`，将镜像地址修改为您实际推送到 GHCR 的地址（如 `ghcr.io/yourname/yourrepo/ticket-probe:latest`）。网关与探针须使用**同一** `PROBE_TOKEN`，建议同步滚动。

```bash
kubectl apply -f deploy/probe-daemonset.yaml
```

---

## 运维与调优

### 如何更新监控的项目 ID
如果需要添加或删除监控的项目（演出 ID）：
1. 修改 `deploy/gateway-configmap.yaml` 中的 `config.json` 内容。
2. 应用更新：
   ```bash
   kubectl apply -f deploy/gateway-configmap.yaml
   ```
3. 重启网关以应用最新配置（网关启动时会解析 `config.json` 并重新调度任务给在线探针）：
   ```bash
   kubectl rollout restart deployment/ticket-gateway -n ticket-monitor
   ```

### 检查各节点运行状态
由于 Gateway 提供了内部 HTTP API 接口，您可以使用 `kubectl exec` 或在内网通过 `curl` 访问网关查看系统快照和各节点调度负载情况：
```bash
# 获取网关的整体运行快照
kubectl exec -it -n ticket-monitor deploy/ticket-gateway -- curl http://localhost:3000/api/snapshot

# 查看当前在线的探针节点列表及分配任务数
kubectl exec -it -n ticket-monitor deploy/ticket-gateway -- curl http://localhost:3000/api/nodes
```
