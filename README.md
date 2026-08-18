# @theterms/mcp

MCP server for TheTerms — expose the TheTerms REST API as tools for AI agents.

## Configuration

The server reads two environment variables at call time:

- `THETERMS_API_KEY` — an org-scoped TheTerms API key, sent as the `X-Api-Key` header on every request.
- `THETERMS_API_BASE_URL` — the TheTerms REST API's base URL, **including the `/api/v1` mount prefix**. For example:

  ```
  THETERMS_API_BASE_URL=https://api.theterms.com/api/v1
  ```

  Each tool's underlying request uses a bare resource path (e.g. `/containers`, `/documents/{id}/draft`) that is appended directly to this base URL — so a value ending in anything other than `/api/v1` will 404.
