---
title: Before an Agent product can run unattended
description: Start with one recoverable task, one committed history, and a clear boundary between the product experience and Agent execution.
date: 2026-06-21
tags: [announcement, stack]
author: AwakenWorks
lang: en
---

Getting an Agent to answer once is a useful prototype. The next step is to let it
work beyond the life of a browser tab or Worker process. A user should be able to
leave, return, handle an approval, and continue the same task without asking the
Agent to start over.

That is the job AwakenWorks begins with: keep long-running Agent work recoverable,
inspectable, and under the operator's control.

## Start with one recoverable task

Choose one task with a finish line a person can recognize. For example, ask an
Agent to prepare a change, pause before a sensitive tool call, approve it, and
return a result with the files it produced. Then require the same task to survive
a client disconnect or Worker restart.

The application owns its domain. Awaken owns durable Agent execution. The
application still decides what a Project, Mission, review, and accepted result
mean to its users. Awaken keeps the Session, Run, committed events, Files,
permissions, Worker lease, Sandbox policy, and recovery path needed to carry that
work.

## Run it as one Session

[Awaken Agents](/agents) is an open, self-hosted service for durable Agent execution.
It keeps supported protocols, compatible agents, isolated workers, persisted
Sessions, and approval-aware tools behind one execution boundary on your
infrastructure.

Build the first path in this order:

1. publish or select an Agent and its Environment;
2. create a Session through a supported client contract;
3. let a Worker execute the Run and commit events, Files, and terminal state;
4. reconnect from committed facts when a live stream or process disappears;
5. inspect the record and let the application decide whether the result meets its
   finish line.

Awaken does not ask the product application to keep a second transcript or
invent another retry loop.

## Extend the loop only when the task needs it

[Awaken Agents internals](/docs/agents/runtime) include the Rust
execution kernel inside Awaken. Contributors and teams with advanced embedding
needs can program the loop through typed tools, committed state, phase hooks,
tool gates, and pluggable executors. It is an extension boundary, not a second
public product or a separate source of execution truth.

## Add cross-team workflow only when one Session is not enough

When the job spans several Runs, people, and business systems, the product also
needs to know who owns the next step and which external result closes the work.
[Awaken Workforce](/workforce) explores that layer with revisioned Workflows, typed
Resources, authorization, approvals, Attention, audit, and lease-bound Workers.
Teams with a concrete job can request focused early access.
Workforce is not required for the first Awaken task.

## Run the interruption test

Awaken is Apache-2.0 and self-hostable. Follow the
[quickstart](/docs/agents/get-started), run one Session, interrupt the client,
reconnect, and confirm that the same committed record remains available. The
[architecture](/docs/agents/concepts/architecture/) explains who owns each
part, while the [compatibility matrix](/docs/agents/compatibility/) lists the
supported client boundary. If this is the execution base you need, [inspect the
source and Star Awaken](https://github.com/AwakenWorks/awaken).
