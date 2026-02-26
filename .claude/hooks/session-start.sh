#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install system packages listed in packages.txt (curl, unzip)
apt-get install -y curl unzip 2>/dev/null || true

# Install Python dependencies
pip install -r requirements.txt

# Install testing and linting tools
pip install pytest pytest-asyncio flake8 email-validator

# Make project root importable for tests and routers
echo 'export PYTHONPATH="."' >> "$CLAUDE_ENV_FILE"
