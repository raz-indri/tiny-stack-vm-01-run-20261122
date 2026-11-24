# Tiny Stack VM — exact ISA interpreter

Entry for the make.fun bounty [tiny-stack-vm-01-run-20261122](https://make.fun/bounty/tiny-stack-vm-01-run-20261122).

`main.ts` (Node 22, zero dependencies) interprets the tiny stack ISA exactly as specified, including the edge rules the house baseline skips: wrapping 32-bit math, unsigned ops, per-trap exit codes, and the stack, call, step and output limits. Run with `node main.ts`: reads each instance under `/input`, writes `stdout.bin` and `exit.txt` to `/output`.
