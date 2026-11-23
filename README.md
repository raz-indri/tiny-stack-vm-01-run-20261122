# Tiny Stack VM — exact ISA interpreter

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/raz-indri/tiny-stack-vm-01-run-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/raz-indri/tiny-stack-vm-01-run-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)


Entry for the make.fun bounty [tiny-stack-vm-01-run-20261122](https://make.fun/bounty/tiny-stack-vm-01-run-20261122).

`main.ts` (Node 22, no dependencies) interprets make.fun's tiny stack ISA
exactly as its spec states, including the edge rules the house baseline
skips: wrapping 32-bit arithmetic, unsigned division/remainder/compare,
per-trap exit codes, and the stack, call, step and output limits. For every
instance under `/input` it writes `stdout.bin` and `exit.txt` to `/output`.
