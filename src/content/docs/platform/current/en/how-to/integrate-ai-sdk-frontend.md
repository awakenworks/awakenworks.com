---
title: "Connect a Vercel AI SDK chat"
description: "Send a React useChat turn to Awaken, stream the response, and recover the same committed thread."
evidence:
  - "crates/server/awaken-protocol-ai-sdk/src/router.rs"
  - "crates/server/awaken-protocol-ai-sdk/src/types.rs"
section: "Connect"
subsection: "Connect applications"
order: 26
---

Connect an existing Vercel AI SDK React chat to a published Awaken Agent.
You will send one recognizable task, render its native UI Message Stream, and
read the same thread from committed history.

## Goal

Finish with a `useChat` component that sends a stable `threadId` to Awaken on
every turn. The browser displays the live stream; Awaken's history endpoint
remains the durable record to reload after a refresh or process restart.

## Prerequisites

- Run `awaken` and complete [self-hosting setup](/docs/agents/how-to/self-host/).
- Publish a runnable model and, if the UI targets one saved Agent, publish that
  Agent first.
- Use a Node.js React project. The pinned Awaken Console source declares the
  `ai` 7.x and `@ai-sdk/react` 4.x package lines used by this example.
- Decide whether browser and API share an origin. For a cross-origin local setup,
  configure CORS at a reverse proxy before opening the page.

## 1. Choose the run endpoint

Use the default route while proving the UI connection:

```text
http://localhost:8080/v1/ai-sdk/chat
```

To run one published Agent, use its scoped route instead:

```text
http://localhost:8080/v1/ai-sdk/agents/<agent_id>/runs
```

Keep the complete route and event catalog in the
[AI SDK protocol reference](/docs/agents/protocols/ai-sdk/). This page needs
only the endpoint your component will call.

## 2. Install the client packages

```bash
npm install ai@7 @ai-sdk/react@4
```

## 3. Send the thread ID with each turn

Add a chat component. `useChat({ id })` identifies client-side chat state, but
Awaken reads durable identity from the request body's `threadId`. Use
`prepareSendMessagesRequest` to send both `threadId` and `messages`:

```tsx
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const threadId = "support-demo-1";
const transport = new DefaultChatTransport({
  api: "http://localhost:8080/v1/ai-sdk/chat",
  prepareSendMessagesRequest: ({ messages }) => ({
    body: { threadId, messages },
  }),
});

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    transport,
  });

  return (
    <main>
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.role}:</strong>{" "}
          {message.parts.map((part, index) =>
            part.type === "text" ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      {error && <p role="alert">{error.message}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || status === "submitted" || status === "streaming") return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Message"
        />
        <button type="submit">Send</button>
      </form>
    </main>
  );
}
```

For a saved Agent, change only `api` to the scoped endpoint chosen in step 1.
Keep `threadId` stable for work that should continue in the same Session; choose
a new value when the user starts unrelated work.

## 4. Verify

1. Open the frontend and send a recognizable task, for example:

   ```text
   Summarize this note in one sentence: shipping is blocked by a missing credential.
   ```

2. Confirm text appears while `status` is `streaming` and the turn eventually
   leaves the streaming state.
3. Read the same thread from Awaken:

   ```bash
   curl -sS http://localhost:8080/v1/ai-sdk/threads/support-demo-1/messages
   ```

4. Confirm the returned `items` include the submitted note and the committed
   assistant response.

The history endpoint does not hydrate `useChat` automatically. On page load,
fetch this history and pass the projected messages into your application's chat
state if refresh recovery is part of your product.

## 5. Move to a production boundary

The preceding URL is a local connection check. Do not give a browser a Workspace
service API key or expose an unauthenticated local listener to the internet.

For an internet-facing application:

1. Let your backend authenticate the user and create or resolve one Managed
   Session.
2. Use the Console **Protocols** workflow to mint a short-lived application
   access token limited to `ai-sdk`, `thread.run`, `thread.messages.read`, and
   an explicit external-thread-to-Session binding.
3. Return only that short-lived token and bound thread ID to the browser.
4. Point `DefaultChatTransport` at
   `/v1/ai-sdk/threads/<thread_id>/runs` and add
   `Authorization: Bearer <application_access_token>`.
5. When the token expires, bind its replacement to the same Managed Session if
   the user is continuing the same work. Re-run the stream and history checks
   through the production ingress.

Authentication, TLS, and CORS belong at the server boundary. Provider
credentials and Workspace service keys never belong in frontend code.

## Troubleshooting

If the table does not resolve the problem, record the route, HTTP status,
response error code, thread ID, Session ID if known, and correlation ID before
contacting support. Remove bearer tokens and message content first.

| Symptom | Check | Action |
| --- | --- | --- |
| Every turn appears under a different thread | Inspect the POST body for `threadId` | Keep `prepareSendMessagesRequest`; `useChat`'s `id` alone is not the Awaken request field |
| The browser reports a CORS error | Compare the page origin with `localhost:8080` | Serve the UI from the same origin or configure the reverse proxy's allowed origin, methods, and headers |
| `useChat` receives no stream parts | Inspect the request URL and response content type | Use the exact run endpoint and confirm the response is `text/event-stream` |
| The run route returns 404 | Confirm the bind address and selected route | Start `awaken`, then compare the URL with the protocol reference |
| A production request returns 401 or 403 | Check token expiry, protocol, operation, and thread binding | Have the backend mint a new least-scope application token for the same authorized Session |
| The live reply appeared but refresh is empty | Check whether the app loads the history endpoint | Hydrate the client from committed history; do not treat the transient stream as storage |

## Next steps

- Read the [AI SDK protocol reference](/docs/agents/protocols/ai-sdk/) before
  rendering tools, approvals, files, usage, or platform metadata.
- Use [Manage a Session](/docs/agents/how-to/manage-a-session/) when your
  product needs interrupt, archive, or lifecycle behavior.
- Review [Console and authentication ownership](/docs/agents/reference/admin-console/)
  before exposing an application route.
- Choose [CopilotKit over AG-UI](/docs/agents/how-to/integrate-copilotkit-ag-ui/)
  when CopilotKit owns the application UI.
