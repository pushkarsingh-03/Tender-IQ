#!/bin/bash
# TenderIQ — Safe update script
# Run this on any machine to pull latest code WITHOUT touching your local database.
#
# Usage:  bash update.sh
#
# What it does:
#   1. git pull (code + schema only — tenderiq.db is gitignored and NEVER touched)
#   2. bun install (install/update root deps)
#   3. bun install inside client/ (install/update frontend deps)
#
# What it does NOT do:
#   - It does NOT run db:restore (which would overwrite your local data)
#   - It does NOT delete or modify tenderiq.db in any way
#
# After running this, start the app with:  bun run dev
# The server auto-migrates the DB schema (adds new columns) on first boot.

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        TenderIQ — Safe Updater           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Pull latest code
echo "→ Pulling latest code from GitHub..."
git pull
echo ""

# 2. Install root dependencies
echo "→ Installing root dependencies..."
bun install
echo ""

# 3. Install frontend dependencies
echo "→ Installing frontend dependencies..."
bun install --cwd client
echo ""

echo "✅  Update complete! Your database was NOT touched."
echo ""
echo "   Start the app:  bun run dev"
echo "   (New DB columns, if any, will be added automatically on first boot.)"
echo ""
