# @theterms/mcp

MCP server for TheTerms — expose the TheTerms REST API as tools for AI agents.

This is a stdio-transport [Model Context Protocol](https://modelcontextprotocol.io/) server: it runs as a local subprocess of your MCP client (Claude Code, Claude Desktop, Cursor, and other stdio-MCP-compatible clients), exposing 10 tools that wrap TheTerms' containers, documents, and signing-requests REST endpoints.

## Usage

Add `@theterms/mcp` to your MCP client's configuration:

```json
{
  "mcpServers": {
    "theterms": {
      "command": "npx",
      "args": ["-y", "@theterms/mcp"],
      "env": {
        "THETERMS_API_KEY": "tt_your_api_key_here",
        "THETERMS_API_BASE_URL": "https://app.theterms.app/api/v1"
      }
    }
  }
}
```

## Configuration

The server reads two environment variables at call time:

- `THETERMS_API_KEY` — an org-scoped TheTerms API key, sent as the `X-Api-Key` header on every request. See [Authentication](https://docs.theterms.app/api-reference/authentication) for how to create one.
- `THETERMS_API_BASE_URL` — the TheTerms REST API's base URL, **including the `/api/v1` mount prefix**. For example:

  ```
  THETERMS_API_BASE_URL=https://app.theterms.app/api/v1
  ```

  Each tool's underlying request uses a bare resource path (e.g. `/containers`, `/documents/{id}/draft`) that is appended directly to this base URL — so a value ending in anything other than `/api/v1` will 404.

## Tools

The server exposes exactly 10 tools: `list_containers`, `create_container`, `list_documents`, `get_document`, `create_document`, `update_draft`, `publish_document`, `send_signing_request`, `get_signing_request`, and `list_signing_requests`. See the [MCP Server docs page](https://docs.theterms.app/api-reference/mcp-server) for the full reference table, including required inputs and load-bearing usage notes for `update_draft` (must replace the full clause list on every call) and `send_signing_request` (requires a versionId, not a documentId).

## Known Limitations

- **Attribution.** Every action taken through this server is attributed to the organization's owner in TheTerms' activity records, regardless of which team member's API key was actually used — a pre-existing characteristic of the REST API's current API-key auth model, not something this server introduces or can fix.
- **Rate limiting.** The REST API enforces a per-API-key rate limit (subject to change). Heavy conversational use in a short window may hit `429` responses; this server surfaces those as a clear, retryable tool error rather than crashing.
