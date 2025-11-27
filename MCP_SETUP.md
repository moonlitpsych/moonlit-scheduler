# Supabase MCP Setup Instructions for Claude Code

## Overview

Set up the Supabase MCP (Model Context Protocol) server so Claude Code can directly interact with my Supabase database — viewing schemas, running queries, and making changes with full context.

## Setup Steps

### 1. Add the MCP Server

Run this command to add the Supabase MCP server:

```bash
claude mcp add supabase --url "https://mcp.supabase.com/mcp"
```

Or to scope it to a specific project (recommended):

```bash
claude mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=PROJECT_REF_HERE"
```

**To find the project ref:** Go to Supabase Dashboard → Project Settings → General → Project ID

### 2. Authenticate

After adding the server, Claude Code should prompt for authentication. This will open a browser window to log in to Supabase and grant organization access. No personal access token is needed — it uses OAuth.

### 3. Verify the Connection

Once set up, test by asking Claude Code to:
- List available tables
- Describe the schema of a specific table
- Run a simple SELECT query

## Alternative: Manual Config File Setup

If the CLI command doesn't work, manually add to the MCP config file.

**Location:** `~/.claude/mcp.json` (global) or `.mcp.json` (project-level)

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=PROJECT_REF_HERE"
    }
  }
}
```

## For CI/Headless Environments

If browser-based OAuth isn't possible:

1. Generate a Personal Access Token at: https://supabase.com/dashboard/account/tokens
2. Use this config:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=PROJECT_REF_HERE",
      "headers": {
        "Authorization": "Bearer YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

## Security Recommendations

- **Don't connect to production databases** — use development/staging projects
- **Enable read-only mode** if connecting to real data (add `&readonly=true` to URL)
- **Keep manual approval enabled** for tool calls — review before executing
- **Scope to a single project** rather than giving access to all projects

## Available Capabilities Once Connected

- View and manage database schema
- Run SQL queries
- Create and modify tables
- Generate migrations
- Manage RLS policies
- View logs for debugging
- Generate TypeScript types

## Troubleshooting

**Authentication fails:**
- Clear browser cookies for supabase.com and retry
- Ensure you're logging into the correct Supabase organization

**Server not responding:**
- Verify the URL is correct
- Check that project_ref matches your actual project ID
- Run `claude mcp list` to verify the server is registered

**Permission errors:**
- Ensure your Supabase account has appropriate access to the project
- Check if read-only mode is enabled when you need write access