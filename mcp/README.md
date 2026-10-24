# SIGMA MCP server

The read-only SIGMA API as [Model Context Protocol](https://modelcontextprotocol.io) tools, so
Claude (Desktop, Code) or any other MCP client can look up dengue signals, reporting units,
mapped facilities, medicine prices and policy evidence, and see where each answer comes from.

## In plain language

An AI assistant connected to this server can answer "Did Iloilo City have an EARS alarm in
July 2019?" by calling SIGMA's API and reading the real record, instead of guessing. Every
answer it gets starts with the data's status (`live`, `demo`, `not_connected`) and whether it
contains demo data, so the assistant can say what kind of evidence it is. The data is
historical (2016–2021) and SIGMA is a hackathon prototype, not a validated public-health source.

## Tools

| Tool | API endpoint | What it returns |
| --- | --- | --- |
| `sigma_health` | `GET /health` | Which SIGMA services are operating |
| `sigma_sources` | `GET /sources` | Every dataset, its licence and status |
| `dengue_signals` | `GET /dengue/signals` | EARS C1/C2/C3 per reporting unit and week (`locationId`, `week`) |
| `dengue_units` | `GET /dengue/units` | The 126 reporting units: cases, EARS weeks, DOH-threshold weeks per year (`unitId`) |
| `dengue_observations` | `GET /dengue/observations` | National weekly cases, OpenDengue (`from`, `to`, `limit`) |
| `dengue_summary` | `GET /dengue/summary` | National weekly/monthly/yearly aggregates with gaps |
| `access_units` | `GET /access/units` | Mapped hospitals, clinics, pharmacies, labs per unit (`unitId`) |
| `access_medicines` | `GET /access/medicines` | Dengue medicines and DOH procurement prices |
| `policy_info` | `GET /policy/info` | Policy assessment areas and AI disclosure |
| `policy_evidence` | `GET /policy/evidence` | Curated policy records (`locationId`, `topic`, `verificationStatus`) |

All tools are read-only (`readOnlyHint`). Two endpoints are deliberately left out:
`POST /chat` (it needs the server's model key and costs money per call) and `/access/metrics`
(retired: no public source reports medicine stock or searches).

Each result is text: a provenance line (`status`, `isSample`, `generatedAt`), a warning when
the status is not `live` or the response holds demo data, then the API's `data` as JSON. API
errors (unknown unit, bad week, unreachable server) come back as tool errors with the API's
own message, never as empty data.

## Run it

Node.js 20 or later.

```bash
cd mcp
npm ci
npm start                                              # stdio; talks to the deployed API
SIGMA_API_BASE_URL=http://localhost:3000/api/v1 npm start   # or to `npm run dev` in web/
```

**Claude Code**

```bash
claude mcp add sigma -- node /absolute/path/to/datascience-2026/mcp/src/server.mjs
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "sigma": {
      "command": "node",
      "args": ["/absolute/path/to/datascience-2026/mcp/src/server.mjs"],
      "env": { "SIGMA_API_BASE_URL": "https://datascience-2026.vercel.app/api/v1" }
    }
  }
}
```

Then ask, for example: *"Using SIGMA, which EARS methods alarmed for Iloilo City in the week
of 14 July 2019?"*

## Files

| File | What it is |
| --- | --- |
| `src/server.mjs` | Builds the MCP server and registers one tool per endpoint (stdio transport) |
| `src/tools.mjs` | Tool names, descriptions, input schemas (zod) and the result format |
| `src/api.mjs` | SIGMA API client: envelope checks, timeouts, error mapping |
| `test/server.test.mjs` | End-to-end tests through a real MCP client over an in-memory transport |

```bash
npm test        # node --test
npm run check   # syntax check
```
