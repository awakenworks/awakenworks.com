---
title: "Run your first Awaken Session"
description: "Start Awaken locally, publish one Agent, send it work through the official Anthropic SDK, and reopen the same Session after a restart."
evidence:
  - "crates/bin/awaken-cli/src/main.rs"
  - "web/src/components/agent/AgentQuickstart.tsx"
  - "e2e/managed_e2e.mjs"
section: "Start"
order: 1
---

Start Awaken on your machine, publish one Agent in the Console, then call that
Agent from a small Node.js application. You are done when the application prints
an `agent.message`, the Session returns to `idle`, and the same history is still
available after restarting Awaken.

Awaken Agents is open source. Its first stable release is coming soon, and
interfaces or behavior may still change before then.

## Before you start

You need:

- a local checkout of the Awaken source at the revision shown above this page;
- a Rust toolchain that can build the workspace;
- Node.js 20 or later;
- one credential for a supported model provider.

Use a dedicated data directory for this guide. It keeps the Agent, provider
configuration, and Session history together and gives you a clear cleanup
boundary.

## 1. Build Awaken

Run these commands from the Awaken repository root:

```console
cargo build -p awaken-cli --bin awaken
./target/debug/awaken --version
./target/debug/awaken config
```

The last command prints the effective configuration with secrets redacted. Add
`--json` when another program needs to read it. Awaken does not assemble
deployment, model, business, or credential settings from ambient `AWAKEN_*`
variables.

## 2. Start Awaken locally

```console
./target/debug/awaken all-in-one --data-dir /tmp/awaken-evaluation
```

AllInOne starts Control, Coordinator, Resources, a local Worker, the Console,
and the protocol APIs on `127.0.0.1:8080`. Before entering a credential, check
that you are talking to the process you just started:

```console
curl http://127.0.0.1:8080/v1/capabilities
```

Keep this terminal running. If startup reports that `127.0.0.1:8080` is already
in use, the process exits; it does not select another port. Start it again with
an explicit free port, for example `--port 8181`, and use that port in every URL
and in `AWAKEN_BASE_URL` below.

## 3. Connect one model provider

Open `http://127.0.0.1:8080/w/default/overview`, follow the provider-readiness
link, and choose **Provider connections**. Select a provider and authentication
method, then choose **Verify & import models**.

Continue when the connection reads `ready` and at least one imported model is
marked executable. The command checks the credential and endpoint before it
saves the Provider, endpoint, credential reference, and model offerings. Use
[Configure providers, models, and credentials](./how-to/configure-providers-models-credentials)
if the connection does not become ready.

## 4. Publish an Agent

Open **Agents**, create an Agent, and use the built-in quickstart:

1. Choose **Task assistant**, **Repository change**, or **Evidence brief**.
2. Give the Agent a human-readable display name and a stable API id.
3. Select a model marked runnable.
4. Choose the Environment for the first Run.
5. Enter one small task you can recognize in the reply.
6. Review the publication diff, then choose **Review, publish & run**.

Record the published Agent id and Environment id shown by the Console. The
application uses both in the next step. Publishing creates the immutable
execution snapshot; a draft cannot start this Session.

## 5. Send work from a Node.js application

Open a second terminal and create a small application:

```console
mkdir awaken-quickstart && cd awaken-quickstart
npm init -y
npm pkg set type=module
npm install @anthropic-ai/sdk
```

This Node.js guide was validated with TypeScript SDK 0.122.0. That is a
validation coordinate, not a dependency requirement. Choose the SDK version
under your own dependency policy and check its resource families in the
[compatibility matrix](./compatibility).

Set the ids you recorded in the Console. Local no-login mode accepts `local` as
the key. In a self-managed protected deployment, open **Access**, create a
dedicated Workspace service API key, and copy the cleartext shown once. Choose
**Workspace administrator** for this quickstart because the client creates a
Session; the read-only developer role can inspect existing state but cannot
start work. Set an expiry and revoke the key after the evaluation.

Do not substitute a short-lived application access token here. Those tokens
are bound to browser or mobile protocol operations; the trusted Managed Agents
backend uses the Workspace service API key.

```console
export AWAKEN_BASE_URL=http://127.0.0.1:8080
export AWAKEN_API_KEY=local
export AWAKEN_AGENT_ID=your-published-agent-id
export AWAKEN_ENVIRONMENT_ID=your-environment-id
```

Create `quickstart.mjs`:

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: process.env.AWAKEN_BASE_URL,
  apiKey: process.env.AWAKEN_API_KEY,
});

const session = await client.beta.sessions.create({
  agent: process.env.AWAKEN_AGENT_ID,
  environment_id: process.env.AWAKEN_ENVIRONMENT_ID,
});

const stream = await client.beta.sessions.events.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{
    type: 'user.message',
    content: [{ type: 'text', text: 'Introduce yourself and complete one small representative task.' }],
  }],
});

for await (const event of stream) {
  console.log(event.type);
  if (event.type === 'agent.message') {
    for (const block of event.content ?? []) {
      if (block.type === 'text') console.log(block.text);
    }
  }
  if (event.type === 'session.status_idle') break;
}

console.log(`session=${session.id}`);
```

Run it:

```console
node quickstart.mjs
```

The terminal should print the Agent's text, `session.status_idle`, and a Session
id. The complete event list can also contain the accepted user event, running
state, model or tool activity, and cumulative `session.usage`.

A short `queued` period is normal while an eligible Worker claims the Run. Do
not create another Session or change the model during that period. Act only when
Awaken returns one of the explicit results below.

## 6. Reopen the Session after a restart

Save the printed Session id. Stop Awaken with `Ctrl-C`, then run the same
AllInOne command with the same `--data-dir`:

```console
./target/debug/awaken all-in-one --data-dir /tmp/awaken-evaluation
```

From the application directory, list the committed events:

```console
node -e "import('@anthropic-ai/sdk').then(async ({default:Anthropic}) => { const c=new Anthropic({baseURL:process.env.AWAKEN_BASE_URL,apiKey:process.env.AWAKEN_API_KEY}); for await (const e of c.beta.sessions.events.list(process.argv[1])) console.log(e.type) })" your-session-id
```

You should see the earlier `user.message`, `agent.message`, and terminal status.
Streamed deltas improve the live display; the committed event list is what the
restarted process reopens.

## Act on an explicit result

| Result | Meaning | Action |
| --- | --- | --- |
| Startup exits with `address is already in use` | No listener was started | Start again with an unused `--port`, then update every local URL |
| Provider verification returns an error | The connection was not saved as ready | Correct the endpoint or authentication on that Provider Connection; do not create catalog objects by hand |
| `/v1/config/executable-models` has no usable model | No complete Native provider, offering, credential, and Runtime combination is ready | Finish the Provider Connection or choose an available imported model |
| SDK returns `invalid_request_error` | The request or compatibility header was rejected before execution | Check `baseURL`, the application token, `managed-agents-2026-04-01`, Agent id, and Environment id |
| The Environment reports no eligible Worker and the Session stays `queued` after the expected Worker startup | No process currently satisfies the frozen placement requirements | Start or correct an eligible Worker, then continue observing the same Session |
| Reading the saved Session returns not found after restart | The process opened a different data directory or the application used a different Session id | Restart with the same `--data-dir` and read the recorded Session id |

## Keep or remove the local state

Stop the foreground process with `Ctrl-C`. Keep `/tmp/awaken-evaluation` if you
want to continue with the same Agent and Session. Remove that directory only
after Awaken has stopped and only after confirming that it contains no work you
need. Never remove a broad parent directory.

## Continue from here

- Coming from an earlier runtime or local server? Follow the [Awaken 1.0 migration guide](./how-to/migrate-to-1-0) before reusing configuration or data.
- [Connect the published Agent](./how-to/connect-a-published-agent) through another application protocol.
- Check the [Managed Agents compatibility boundary](./compatibility).
- [Deploy and operate Awaken](./how-to/self-host) with explicit identity, database, backup, and Sandbox boundaries.
- Use the generated [management OpenAPI contract](./reference/management-openapi) for automation.
