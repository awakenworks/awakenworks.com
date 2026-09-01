---
title: "选择并部署自托管拓扑"
description: "从 AllInOne 开始；单个持久节点足够时停在那里；确有隔离或扩缩要求时再拆分 Control、Coordinator 与无数据库 Worker。"
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
  - "crates/bin/awaken-worker/src/admin.rs"
  - "crates/server/awaken-run-ingress-http/src/durable_ops.rs"
---

用这份指南选择你能够安全运营的最小部署。从 AllInOne 开始；一台机器足够时，加固为
持久单节点；只有当职责隔离或独立扩缩解决了明确需求时，才拆分 Control、Coordinator
与 Worker。

## 目标

在下列三个停止点中选择一个并完成部署。接入流量前，所选拓扑应加载一份脱敏的有效
配置，以预期角色启动，在重启后保留同一个已发布 Agent 与 Session，并具备已经演练的
恢复路径。

## 选择在哪里停下

| 当前需要 | 停止点 | 继续前必须满足 |
| --- | --- | --- |
| 在一台机器上评估或开发 | 本地 AllInOne | Console、API、本地 Worker 与重启恢复在一个进程中工作 |
| 在一台持久机器上运营 | 加固后的 AllInOne | 持久存储、稳定 seal key、已认证入口、监控与经过测试的备份恢复都已就绪 |
| 隔离权威职责或独立扩缩执行 | 拆分服务 | PostgreSQL schema、私有服务认证与无数据库 Worker 派发形成完整闭环 |

拆分进程不会产生第二份 Agent catalog 或 Session 路径。所有拓扑都运行同一组 Control、
Coordinator、Resources、Worker 与 Runtime 职责。

## 前置条件

- 完成[开始使用](../get-started)，并让同一个 Agent 在 AllInOne 中运行成功；
- 明确持久存储、secret 托管、入口、身份与备份的负责人；
- 拆分服务需要 PostgreSQL 和经过认证的私有网络；
- schema migration 前确定维护窗口与回滚点。

同一 Agent 尚未在 AllInOne 成功前，不要直接搭拆分集群。

## 1. 创建并校验一份配置文档

部署配置使用 TOML，而不是 `AWAKEN_*` 环境变量。先从本地 service profile 开始：

```toml
role = "all-in-one"
mode = "local"
data_dir = "/srv/awaken"
bind = "127.0.0.1:8080"
run_local_pool = true
no_browser = true
```

校验进程实际会使用的内容：

```console
awaken config --config /etc/awaken/config.toml
awaken all-in-one --config /etc/awaken/config.toml
```

`awaken config --json` 适合部署断言，因为 secret 与数据库 URL 会保持脱敏。完整 key
见[部署配置](../reference/configuration)。

## 2. 加固单节点

- 把 `data_dir` 放在持久存储上，并连同内嵌 store 备份。
- 只提供一个稳定 `control_seal_key_file` 或文档列出的其他 Control seal-key 来源；
  放在镜像和配置仓库之外。
- 明确选择 `identity_mode`，并把公共入口放在 TLS 与已认证 gateway 后。
- 当 proxy 负责 TLS 时，让服务只监听私网；SSE route 要关闭 proxy buffering。
- 选择满足风险下限的 Sandbox tier；不要为了让启动变绿就开启 local fallback。
- 在宣称 production-ready 前配置 `log_filter`、结构化日志/OTLP、内容采集 policy、
  retention 与备份恢复。

Local mode 会在启动时迁移内嵌 store；共享 server 部署不享受这一便利。

## 3. 拆分 Control 与 Coordinator

严格运行以下角色命令：

```console
awaken control --config /etc/awaken/control.toml
awaken coordinator --config /etc/awaken/coordinator.toml
```

Control 拥有 Agent publication、IAM、凭据变更、管理审计与 Data Subject consent。
Coordinator 拥有 executable registration、Deployment、Session、Environment 执行状态、
dispatch、commit 与 captured content。按角色配置 store；校验会拒绝 cross-owned database。

Control 必须设置 `coordinator_internal_url`。两端读取同一份
`executable_agent_registration_token_file`。反向 Coordinator→Control application
boundary 使用 `control_internal_url` 与 `control_service_token_file`。通过 secret
manager 投射这些最小权限 token 文件，不要把 token 值写进 TOML。

## 4. 启动服务前迁移共享 schema

在角色所有的配置中设置 `mode = "server"` 与 PostgreSQL store URL；再先于
application Pod 运行 migration job：

```console
awaken database migrate --config /etc/awaken/migration.toml
```

Server 进程只校验已有 schema，不在启动时写 DDL。拆分 Coordinator 要求
`runtime_database_url`。共享 Runtime 与 Resources 必须使用兼容的 shared store；
可能让某节点读取私有内嵌状态的混合形态会失败即关闭。

## 5. 增加无数据库 Worker

```toml
role = "worker"
mode = "server"
worker_server = "http://awaken-coordinator:8080"
worker_id = "worker-a"
worker_zone = "zone-a"
worker_credential_material_root = "/run/awaken/credentials"
worker_credential_trust_domain = "awaken.worker"
sandbox_tier = "namespace"
```

```console
awaken-worker --config /etc/awaken/worker.toml --server http://awaken-coordinator:8080
```

Worker 拒绝所有权威数据库字段、Control seal key 与私有 Control/Coordinator service
token。它注册 capability、claim/renew leased work、只 materialize 精确引用的凭据与
Resource、通过 fenced Coordinator 协议 commit，并在同一 epoch 下 settle。

Container tier 还要添加匹配的 feature/runtime 与 `container_image`。见
[配置 Sandbox tier](./configure-sandbox-tiers)。

## 6. Durable dispatch 通过后再配跨节点 wake-up

Dispatch database 拥有工作真相。`dispatch_wake = "pg-notify"` 或 `"nats"` 只缩短
空闲 Worker 等待下一次 poll 的时间。每个进程使用唯一 `dispatch_owner`；在依赖 wake
降低延迟前，先关闭 wake channel 验证 takeover。见[使用 NATS wake signal](./use-nats-wake-signal)。

## 验证

接入流量前：

- `awaken config --json` 显示预期角色与有效值，同时保持 secret 与数据库 URL 脱敏；
- 进程使用同一存储重启后，可以重新打开同一个已发布 Agent 与 Session；
- shared-server 部署在任何应用进程启动前完成 `awaken database migrate`；
- 拆分后的 Control 能注册 publication，Coordinator 能派发，且无数据库 Worker 能提交终态；
- TLS、认证、SSE proxy、日志、retention 与备份恢复符合你的运营 policy；
- 关闭 wake channel 后，dispatch takeover 仍能成功。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Awaken version、topology、确切 binary、已脱敏 config
report、health response、Session 或 Run ID 与 correlation ID，再联系支持。不要附带 token、
seal key、credential file 或 database URL。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| 进程拒绝 database 或 seal-key field | 确切 binary schema 与错误指出的 config key | 删除不受支持的 field；不要换用权限更大的进程绕过校验 |
| Control 发布成功但 registration 失败 | Coordinator URL、TLS、authentication status 与 correlation ID | 保留 publication，修复连接，再重试同一 registration |
| Coordinator 拒绝启动 | startup error 是否指出 shared runtime DB、schema 或私有 Control URL | 修正明确配置，或先完成 migration 再接入流量 |
| 已知 pending Run 在自动 drain 后仍未被领取 | 先确认 `GET /readyz` 返回 `200`，再从该 Run 的 `GET /v1/durable/threads/{thread}/dispatches` response 对照 placement requirement、Worker capability 与 capacity | 恢复失败的 readiness、connection、capability 或 capacity。没有 pending eligible Run 时，Worker 空闲是正常状态，不需要修复。 |

### 回滚拆分部署

先停止新 ingress、drain Worker，再让同一组规范组件以 AllInOne
打开其有权访问的 store layout。不要把 Coordinator projection row 复制进 Control，
也不要发明第二条 warm-install 路径。

## 下一步

- [查看完整部署配置](../reference/configuration)；
- [选择 Sandbox tier](./configure-sandbox-tiers)；
- [只把 NATS 用作 wake signal](./use-nats-wake-signal)；
- [查看生产可靠性与恢复](../concepts/production-reliability)；
- [查看平台架构与权威边界](../concepts/architecture)。
