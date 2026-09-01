---
title: "打开第一个 Awaken Workforce Issue"
description: "从源码启动 Workforce，bootstrap 一个 Project，并在本地工作空间中打开第一项 Issue。"
---

本指南会在你的电脑上启动 Awaken Workforce，并通过 `project bootstrap` 命令创建一项 Issue。
浏览器在 bootstrap 后的 Project 中显示 **Explore Awaken Workforce** 时，这条路径就完成了。

第一项 Issue 不会调用真实模型。它先准备好后续 Agent run 会使用的 Workforce workspace、Project、
Workflow 和工作记录。

## 开始前准备

你需要：

- Rust stable 与 Cargo；
- Node.js 22 或更高版本，以及 pnpm 11；
- `awaken-flow` 源码的本地 checkout，revision 与页面上方标注一致；
- 用于生成两份本地评估 secret 的 OpenSSL。

Cargo 会获取 Workforce 仓库固定的 Git dependencies。以下步骤把配置、secret 和 SQLite 文件都放在
明确的 `/tmp/awaken-flow-evaluation` 目录中。

## 1. 准备本地文件

在 `awaken-flow` 仓库根目录运行：

```sh
mkdir -p /tmp/awaken-flow-evaluation
umask 077
openssl rand -hex 32 > /tmp/awaken-flow-evaluation/vault-key
openssl rand -hex 32 > /tmp/awaken-flow-evaluation/worker-key
cp docs/examples/awaken-flow.toml /tmp/awaken-flow-evaluation/awaken-flow.toml
```

打开 `/tmp/awaken-flow-evaluation/awaken-flow.toml`，修改以下路径：

| 字段 | 本地值 |
| --- | --- |
| `vault_seal_key_file` | `/tmp/awaken-flow-evaluation/vault-key` |
| `storage.work_db` | `/tmp/awaken-flow-evaluation/work.db` |
| `storage.awaken_db` | `/tmp/awaken-flow-evaluation/awaken.db` |
| `storage.registry_db` | `/tmp/awaken-flow-evaluation/registry.db` |
| `worker_credentials."agent-worker-v1".signing_secret_file` | `/tmp/awaken-flow-evaluation/worker-key` |

保留 example 中的本地评估设置：

```toml
[iam]
mode = "none"
org_id = "local-org"
workspace_id = "local-workspace"

[server]
listen_addr = "127.0.0.1:7979"
embedded_orchestrator = true
embedded_agent_worker = true
```

模型 provider 和 API key 不属于这份 deployment document。以后加入真实 Agent execution 时，
它们仍由 Awaken 的 model catalog 与 credential vault 管理。

## 2. 检查部署文档

```sh
cargo run -p awaken-flow-server -- config schema \
  > /tmp/awaken-flow-evaluation/awaken-flow.schema.json

cargo run -p awaken-flow-server -- \
  config validate --config /tmp/awaken-flow-evaluation/awaken-flow.toml

cargo run -p awaken-flow-server -- \
  config show --config /tmp/awaken-flow-evaluation/awaken-flow.toml
```

`validate` 打印 `deployment configuration is valid` 后再继续。`show` 会打印不含 secret 内容的
规范化配置。启动 Server 前，先修正命令报告的字段或文件。

## 3. 启动完整本地进程

```sh
cargo run -p awaken-flow-server -- \
  --config /tmp/awaken-flow-evaluation/awaken-flow.toml
```

保持这个终端运行。默认命令会启动 Server、内嵌 Orchestrator 和内嵌 Agent Worker。生产环境
使用的拆分角色是 `server`、`orchestrator` 和 `agent-worker`，本指南暂时不需要它们。

## 4. Bootstrap Project 和 Issue

打开第二个终端，回到仓库根目录，复制两份 request example：

```sh
cp contracts/examples/project-bootstrap.json \
  /tmp/awaken-flow-evaluation/project-bootstrap.json
cp contracts/examples/create-first-issue.json \
  /tmp/awaken-flow-evaluation/create-first-issue.json
```

编辑 `project-bootstrap.json`，把 `project.workspace_id` 改为 `local-workspace`，与部署文档一致。
然后运行：

```sh
cargo run -p awaken-flow-server -- project bootstrap \
  --server http://127.0.0.1:7979 \
  --request /tmp/awaken-flow-evaluation/project-bootstrap.json \
  --first-issue /tmp/awaken-flow-evaluation/create-first-issue.json \
  --wait
```

JSON 输出中应包含 `"configuration_ready": true`，以及标题为 **Explore Awaken Workforce** 的
`first_issue` 对象。重复运行同一命令会使用相同 idempotency key，可以安全重试。该命令调用
Bootstrap API，不直接写数据库。

本指南在 loopback listener 上使用 `iam.mode = "none"`。以后切换为 local authentication 时，
通过 `--token-file` 传入 Server 打印的 owner-only `flow-admin-token` 路径。

## 5. 打开 Workforce 工作空间

在第三个终端运行：

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://127.0.0.1:5173` 并选择 `local-workspace`。**Home** 会显示 workspace 交付路径与
Project 目录。打开 **First project**：

1. 在 **Overview** 确认 Project readiness，并查看是否还有阻塞 setup；
2. 进入 **Issues**，确认列表中出现 **Explore Awaken Workforce**；
3. 打开这项 Issue，检查 **Your next step**、**Diagnosis**、Workflow progress 与 worklog。

这次 bootstrap 创建的是第一项 Issue，并不代表已经产生客户 Outcome。之后有了真实结果和正式
验收边界，再从 Workspace Home 使用 **Commission outcome**。真实 Agent execution 需要先发布
Agent，并配置 model、provider、credential 与 signed Worker；业务 Resource 和外部验收证据仍由
Objects 负责。

## 结果不一致时

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| 配置校验无法读取 secret | 两个文件路径与 owner read permission | 指向步骤 1 创建的文件，不要把 secret 文本写进 TOML。 |
| 配置校验报告其他字段 | 报告的字段与生成式 schema | 修正 deployment document，再次运行 `config validate`。 |
| Bootstrap 一直没有 ready | readiness response 与 `plan_digest` | 修复报告的 Project 配置，再重试同一命令。 |
| Bootstrap 返回 unauthorized | `iam.mode` 与 Server 启动输出 | 使用 local auth 时，通过 `--token-file` 传入打印的 owner-only token。 |
| 浏览器无法连接 API | Server 地址与 Vite proxy target | 保持端口 `7979` 和 `5173`，或同时修改 proxy 与浏览器 URL。 |
| 工作空间能打开，但没有 Issue | Bootstrap JSON 输出、**First project** 与当前 workspace | 确认 `first_issue` 存在，UI 当前显示 `local-workspace`，并且选择的是 **First project**。 |

## 停止或重新开始

用 `Ctrl-C` 停止每个前台进程。保留评估目录即可继续使用同一个 Project 和 Issue。若要重置，
请在两个进程均停止后，只删除部署文档中明确列出的三个 SQLite 文件。计划再次运行时，可以保留
TOML 与 secret 文件。

## 接下来

- [创建并跟踪 Issue](/zh/docs/workforce/how-to/create-and-follow-an-issue/)。
- [运行 API Workflow 路径](/zh/docs/workforce/tutorials/first-agent-run/)。
- [部署拆分角色](/zh/docs/workforce/operating/deployment-topologies/)。
