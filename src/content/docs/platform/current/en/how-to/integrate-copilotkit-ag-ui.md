---
title: "Connect a CopilotKit chat over AG-UI"
description: "Connect CopilotKit to Awaken with an AG-UI HttpAgent, verify one durable thread, and choose a production connection boundary."
evidence:
  - "crates/server/awaken-protocol-ag-ui/src/router.rs"
  - "crates/server/awaken-protocol-ag-ui/src/types.rs"
section: "Connect"
subsection: "Connect applications"
order: 28
---

Connect a CopilotKit v2 chat to an Awaken Agent through the AG-UI endpoint.
Start with a direct local `HttpAgent`, send one task, and confirm that the same
thread can be read from committed history before choosing the production path.

## Goal

Finish with a CopilotKit chat that renders Awaken's AG-UI event stream and uses
one stable `threadId`. You will also know which component must own authentication
when the browser connection moves beyond local development.

## Prerequisites

- Run `awaken` and complete [self-hosting setup](/docs/agents/how-to/self-host/).
- Publish a runnable model and, if needed, the Agent the chat will use.
- Use a Node.js React project.
- Decide whether this is a local direct connection or a production connection.
  CopilotKit gives those paths different configuration and security boundaries.

## 1. Choose the connection boundary

| Use | CopilotKit path | What it means |
| --- | --- | --- |
| Local wiring and UI work | `agents__unsafe_dev_only` with an AG-UI `HttpAgent` | The browser calls Awaken directly; do not ship this setting |
| Production direct connection | `selfManagedAgents` with a secured `HttpAgent` | Your endpoint owns authentication and authorization; current CopilotKit documentation places this option in its Enterprise offering |
| Production runtime proxy | `runtimeUrl` pointing to Copilot Runtime | Copilot Runtime discovers and proxies Agents; `runtimeUrl` does not point directly to Awaken's `/v1/ag-ui` run endpoint |

The next steps use the local path so you can verify the protocol without adding
a second server.

## 2. Install CopilotKit and the AG-UI client

```bash
npm install @copilotkit/react-core@1 @ag-ui/client@0.0.58
```

The example uses CopilotKit's v2 exports. Keep the versions selected by your
application lockfile and review CopilotKit's migration notes before changing its
major API surface.

## 3. Register Awaken as a local HttpAgent

Use the default endpoint first, or replace the URL with
`/v1/ag-ui/agents/<agent_id>` to select one published Agent:

```tsx
"use client";

import { HttpAgent } from "@ag-ui/client";
import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";

const awakenAgent = new HttpAgent({
  url: "http://localhost:8080/v1/ag-ui",
  threadId: "copilotkit-demo-1",
});

export default function App() {
  return (
    <CopilotKit
      agent="awaken"
      agents__unsafe_dev_only={{ awaken: awakenAgent }}
    >
      <CopilotChat agentId="awaken" />
    </CopilotKit>
  );
}
```

The registry key `awaken` is the ID CopilotKit components use. The endpoint path
selects the Awaken Agent. The explicit `threadId` keeps subsequent runs on the
same committed Session.

Do not replace `agents__unsafe_dev_only` with `runtimeUrl=".../v1/ag-ui"`.
`runtimeUrl` expects the Copilot Runtime API, including discovery behavior that
a raw AG-UI run endpoint does not provide.

## 4. Verify

1. Open the page and send a recognizable task, such as:

   ```text
   List the two decisions in this note: choose an owner, then choose a deadline.
   ```

2. Confirm `CopilotChat` renders the response as it arrives.
3. Read the same thread from Awaken:

   ```bash
   curl -sS http://localhost:8080/v1/ag-ui/threads/copilotkit-demo-1/messages
   ```

4. Confirm the returned `items` contain the submitted task and the committed
   Agent response.

An `HttpAgent` keeps messages in browser memory while the page is open. If the
product must survive a refresh, load committed history before constructing the
Agent and provide those messages as `initialMessages`.

## 5. Move to a production path

Before traffic reaches the endpoint:

1. Choose Copilot Runtime proxying or the supported production
   `selfManagedAgents` path for your CopilotKit plan.
2. Authenticate the caller and authorize the selected Workspace, Agent, and
   thread at the server boundary.
3. If the browser calls Awaken directly, have your backend mint a short-lived
   application access token limited to `ag-ui`, the required thread operations,
   and the authorized Session binding. An application token may be sent as the
   `HttpAgent` bearer header; provider credentials and Workspace service keys may not.
4. Terminate CORS and TLS at the owning ingress or same-origin application
   server.
5. Re-run the task and committed-history check through the production URL.

## Troubleshooting

If the table does not resolve the problem, record the selected connection path,
package versions, route, HTTP status, thread ID, and correlation ID before
contacting support. Remove tokens and message content first.

| Symptom | Check | Action |
| --- | --- | --- |
| CopilotKit requests `/info` or reports a runtime connection failure | The raw AG-UI URL was passed as `runtimeUrl` | For local direct use, register an `HttpAgent`; otherwise point `runtimeUrl` at an actual Copilot Runtime |
| CopilotKit reports a missing runtime or key | The local Agent map is absent or the v2 import is not in use | Pass `agents__unsafe_dev_only={{ awaken: awakenAgent }}` and use the `/v2` exports shown above |
| The browser reports a CORS error | The page and Awaken have different origins | Use a same-origin proxy or configure the ingress CORS policy |
| A reload starts with no messages | Only the in-memory `HttpAgent` state was used | Fetch committed thread history and pass it as `initialMessages` |
| The run returns 404 | The server, port, or Agent-scoped path is wrong | Confirm `awaken` is listening, then compare the route with the AG-UI reference |

## Next steps

- Read the [AG-UI protocol reference](/docs/agents/protocols/ag-ui/) before
  handling tool calls, state, context, resume input, or custom events.
- Use [Manage a Session](/docs/agents/how-to/manage-a-session/) for interrupt,
  archive, and lifecycle decisions.
- Review [Console and authentication ownership](/docs/agents/reference/admin-console/)
  before exposing an application route.
- Use the [AI SDK guide](/docs/agents/how-to/integrate-ai-sdk-frontend/) if
  your UI already owns a Vercel AI SDK `useChat` surface.
