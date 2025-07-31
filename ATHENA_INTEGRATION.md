# Athena Health Integration Setup

## Quick Start

1. **Environment Setup**
   ```bash
   npm run athena:validate  # Check configuration
   npm run db:migrate:athena  # Verify database setup
   ```

2. **Test API Connection** (after getting credentials)
   ```bash
   node scripts/test-athena-connection.js
   ```

3. **Monitor Integration**
   ```bash
   npm run athena:monitor
   ```

## Required Credentials

Get these from Athena Health Developer Portal:
- `ATHENA_CLIENT_ID`
- `ATHENA_CLIENT_SECRET`
- `ATHENA_WEBHOOK_SECRET`

## Development Workflow

1. Test with sandbox environment first
2. Run integration tests: `npm run athena:test`
3. Monitor sync status in development
4. Deploy to production with production credentials

## Useful Commands

- `npm run athena:sync` - Manual sync trigger
- `npm run athena:validate` - Check configuration
- `npm run athena:monitor` - Watch sync status

## Troubleshooting

- Check logs in `athena_sync_log` table
- Verify webhook endpoints are accessible
- Monitor rate limiting in console
- Use sandbox environment for testing

