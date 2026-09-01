---
title: "把运行时状态存入 PostgreSQL"
description: "把模式迁移与执行内核启动分开，并验证唯一事务提交权威。"
evidence:
  - "crates/stores/awaken-store-postgres/src/lib.rs"
---

当 Runtime 状态必须跨重启保留，而且多个进程可能向同一权威提交时，使用
PostgreSQL。先决定 Runtime 进程是否可以执行 DDL。受控部署应只迁移一次，让每个
Runtime 实例在不改变模式的前提下校验已安装版本。

## 选择启动路径

| 部署方式 | 迁移阶段 | Runtime 启动 |
| --- | --- | --- |
| 本地开发或单进程嵌入 | `connect` 或 `with_pool` 应用迁移 | 同一次调用水合读取投影 |
| 受控部署 | Runtime 启动前调用 `migrate` | `connect_existing` 校验迁移后水合 |
| 应用持有连接池的受控部署 | 只运行一次 `migrate` | `with_existing_pool` 校验并水合传入连接池 |

```mermaid
flowchart LR
    D[部署迁移任务] -->|migrate| DB[(PostgreSQL runtime 模式)]
    R1[Runtime 进程 A] -->|connect_existing| DB
    R2[Runtime 进程 B] -->|connect_existing| DB
    DB --> P1[本地读取投影 A]
    DB --> P2[本地读取投影 B]
```

## 增加适配器

```toml
[dependencies]
awaken-store-postgres = { git = "https://github.com/AwakenWorks/awaken" }
```

本地开发可以直接连接：

```rust
use awaken_store_postgres::PostgresCommitCoordinator;

let store = PostgresCommitCoordinator::connect(
    "postgres://user:pass@localhost:5432/mydb",
    10,
).await?;
```

迁移与 Runtime 分离的部署方式如下：

```rust
use awaken_store_postgres::PostgresCommitCoordinator;

PostgresCommitCoordinator::migrate(database_url, 2).await?;

// 迁移任务成功后，每个 Runtime 进程执行此路径。
let store = PostgresCommitCoordinator::connect_existing(
    database_url,
    10,
).await?;
```

应用持有 `sqlx::PgPool` 时，分别使用对应的 `with_pool` 或
`with_existing_pool`。

## 理解同一事务中的内容

```mermaid
sequenceDiagram
    participant Runtime as Runtime
    participant Store as PostgresCommitCoordinator
    participant DB as PostgreSQL
    participant View as 本地投影

    Runtime->>Store: commit(ThreadCommit)
    Store->>DB: 开始事务
    Store->>DB: 锁定 Thread 版本
    Store->>DB: 追加消息、状态、事件、Run 与票据变更
    Store->>DB: 推进 Thread 版本并提交
    alt SQL 提交成功
        Store->>View: 推进当前进程投影
        Store-->>Runtime: CommitRecord
    else 校验、版本或 SQL 失败
        Store-->>Runtime: 返回错误，事务不可见
    end
```

表使用固定的 `runtime_` 前缀。提交日志是权威，`runtime_run_record` 是最新 Run
缓存。模式包含提交、消息、状态命令、事件、等待票据、Thread 版本、操作回执和
PostgreSQL 提交序列对象。

启动时会从一个可重复读快照重建同步执行投影。如果提交、消息、状态命令、事件与
等待记录合计超过 1,000,000 行，系统会拒绝水合。达到该规模的权威在重启前应先
压缩或导出快照。

每个进程只会为自己成功提交的变更推进本地投影。Active-active 校正和恢复使用
适配器提供的 PostgreSQL 权威读取。不要把某个进程的同步投影视为其他进程提交的
实时订阅。

## 验证部署

先运行迁移任务，再用 `connect_existing` 启动两个 Runtime 实例，通过两个实例
提交并恢复不同 Thread。检查业务数据前，先确认迁移账本一致。

```sql
SELECT sequence, thread_id, run_id
FROM runtime_commit
ORDER BY sequence;

SELECT thread_id, version
FROM runtime_thread_version
ORDER BY thread_id;
```

## 只处理已返回的失败

| 已返回结果 | 系统仍无法解决的原因 | 外部操作 |
| --- | --- | --- |
| `StoreError::Connect` | 连接池无法访问 PostgreSQL 或完成认证 | 核对 URL、TLS、认证、网络路径与数据库就绪状态 |
| `migrate` 返回 `StoreError::Migrate` | 部署任务无法安装精确迁移包 | 为迁移身份授予所需 DDL 权限，再运行迁移任务 |
| `connect_existing` 返回 `StoreError::Migrate` | 已安装回执与预期迁移包不一致 | 停止启动并部署匹配的迁移包，不要让 Runtime 改写账本 |
| `StoreError::Hydrate` 提示安全启动上限 | 同步投影超过有界启动规模 | 重启前先压缩或导出快照 |
| 提交版本冲突 | 另一个已接受转换先修改了同一 Thread | 重新读取权威恢复快照，再由调用方重试该逻辑操作 |

事务自动回滚、模式校验成功和投影水合成功都是正常行为，不需要另写排查步骤。

## 相关文档

- [选择运行时状态与存储](/zh/docs/agents/runtime/state-and-storage/)
- [把运行时状态存入文件](/zh/docs/agents/runtime/how-to/use-file-store/)
- [状态与快照模型](/zh/docs/agents/runtime/explanation/state-and-snapshot-model/)
