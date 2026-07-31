#!/bin/zsh
# One Actuary probe round, invoked by launchd every 30 minutes.
# Free estimate probes by default; flip to --paid once mainnet probing begins.
export PATH="/Users/mattspaulding/.nvm/versions/node/v22.9.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "/Users/mattspaulding/dev/actuary" || exit 1
mkdir -p data
npx tsx src/probe/runner.ts >> data/probe.log 2>&1
