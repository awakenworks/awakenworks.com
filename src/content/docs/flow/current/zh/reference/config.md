---
title: "部署配置"
description: "Awaken Workforce Server、Orchestrator 与 Agent Worker 共同使用的带版本 TOML。"
---

Awaken Workforce 进程配置只有一个权威来源：`--config` 选定的 TOML；若省略，则读取平台配置
目录中的 `awaken-flow/config.toml`。预览分发包附带维护中的示例。

## 命令

```sh
awaken-flow config validate --config ./awaken-flow.toml
awaken-flow config show --config ./awaken-flow.toml
awaken-flow config schema > awaken-flow.schema.json
```

校验会拒绝未知字段、不支持的 `schema_version`、无效值、引用文件缺失、Worker credential
不一致和角色配置不完整。`show` 输出规范化且不泄露 secret 的形式；`schema` 输出由 runtime
parser 同一组 Rust type 生成的 JSON Schema。

## 顶层 schema

| Key | 用途 |
| --- | --- |
| `schema_version` | 部署文档兼容版本；当前值为 `1`。 |
| `vault_seal_key_file` | Awaken credential-vault seal key 文件。 |
| `storage` | SQLite 路径或 Postgres URL 与连接池设置。 |
| `worker_credentials` | 命名签名 Worker identity；secret material 保留在文件中。 |
| `agent_execution` | Server 接受的 credential 与可选 checkpoint 目录。 |
| `iam` | `none`、`local` 或 `cloud` identity 模式。 |
| `pack` | Studio 开关及 trust、signer、Registry、curated release、credential 文件。 |
| `server` | Listener、public URL 与内嵌角色开关。 |
| `orchestrator` | Orchestrator 角色预留的类型化配置。 |
| `agent_worker` | Credential、control URL、ACP CLI、sandbox tier 与相关路径。 |
| `runtime` | Lease、timeout、sweep、retry、clock 与 node id 调优。 |
| `ssh` | 可选 known-hosts 文件、command allowlist 与 SSH binary。 |

## 存储变体

```toml
[storage]
kind = "sqlite"
work_db = "/var/lib/awaken-flow/work.db"
awaken_db = "/var/lib/awaken-flow/awaken.db"
registry_db = "/var/lib/awaken-flow/registry.db"
```

Postgres 使用 `kind = "postgres"`、`url`，以及可选 `registry_url`、`pool_size` 与
`connect_timeout_secs`。所有进程角色必须认同部署边界；Agent Worker 保持无数据库，并通过
`agent_worker.control_url` 访问 Server。

## 装配开关

| `embedded_orchestrator` | `embedded_agent_worker` | Server 进程行为 |
| --- | --- | --- |
| `true` | `true` | 完整本地拓扑 |
| `true` | `false` | Server 加 Orchestrator，外置 Agent Worker |
| `false` | `true` | Server 加 Agent Worker，外置 Orchestrator |
| `false` | `false` | 纯控制 Server，两个角色都外置 |

## 所有权边界

该文档刻意不包含 provider endpoint、model identifier 或 provider API key。模型连接由
Awaken 的持久化 model catalog、config publication 与 credential vault 拥有。Workforce 配置
只选择进程装配，不能形成第二条模型配置路径。

启动与恢复顺序参见[部署拓扑](/zh/docs/workforce/operating/deployment-topologies/)。实际 checkout 的
`config schema` 输出是精确、机器可读的字段与默认值契约；本页刻意不重复维护所有可选
runtime knob。
