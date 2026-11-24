// Tiny stack-machine interpreter for make.fun's ISA v1, written from
// the published spec: /input/<id>/program.bin + input.bin in,
// /output/<id>/stdout.bin + exit.txt out. No deps, clock or env.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const STEP_LIMIT = 1_000_000;
const OUT_LIMIT = 65_536;
const STACK_LIMIT = 256;

function readOrEmpty(path: string): Buffer {
  try { return readFileSync(path); } catch { return Buffer.alloc(0); }
}

function execute(code: Buffer, input: Buffer): { out: Buffer; code: number } {
  const stack: number[] = [];
  const calls: number[] = [];
  const mem = new Int32Array(256);
  const emitted: number[] = [];
  let pc = 0;
  let steps = 0;
  let cursor = 0;

  const trap = (n: number): never => { throw n; };
  // Pops `take`, pushes `give`: too few held traps 2, too deep traps 3.
  const guard = (take: number, give: number): void => {
    if (stack.length < take) trap(2);
    if (stack.length - take + give > STACK_LIMIT) trap(3);
  };
  const pop = (): number => stack.pop() as number;
  const push = (v: number): void => {
    stack.push(v | 0);
  };
  const done = (n: number) => ({ out: Buffer.from(emitted), code: n });
  // DIV/MOD/DIVU/MODU: pop b then a, trap 4 on b = 0. trunc and %
  // give the signed semantics; |0 in push wraps -2^31 / -1.
  const divide = (unsigned: boolean, isMod: boolean): void => {
    guard(2, 1);
    let b = pop();
    let a = pop();
    if (b === 0) trap(4);
    if (unsigned) { a >>>= 0; b >>>= 0; }
    push(isMod ? a % b : Math.trunc(a / b));
  };

  try {
    for (;;) {
      if (steps >= STEP_LIMIT) trap(10);
      if (pc < 0 || pc >= code.length) trap(9);
      const op = code[pc];
      // Immediate sizes: PUSH8 1, PUSH32 4, jumps/CALL 2; cut off traps 9.
      const imm = op === 0x01 ? 1 : op === 0x02 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
      if (imm > 0 && pc + imm >= code.length) trap(9);
      steps += 1;
      const next = pc + 1 + imm;
      switch (op) {
        case 0x00: return done(0);
        case 0x01: guard(0, 1); push((code[pc + 1] << 24) >> 24); break; // PUSH8, sign-extended
        case 0x02: guard(0, 1); push(code.readInt32LE(pc + 1)); break;
        case 0x03: guard(1, 0); pop(); break;
        case 0x04: guard(1, 2); push(stack[stack.length - 1]); break;
        case 0x05: { // SWAP
          guard(2, 2);
          const n = stack.length;
          [stack[n - 2], stack[n - 1]] = [stack[n - 1], stack[n - 2]];
          break;
        }
        case 0x06: guard(2, 3); push(stack[stack.length - 2]); break;
        case 0x07: { // ROT
          guard(3, 3);
          const n = stack.length;
          const third = stack[n - 3];
          stack[n - 3] = stack[n - 2];
          stack[n - 2] = stack[n - 1];
          stack[n - 1] = third;
          break;
        }
        case 0x10: guard(2, 1); push(pop() + pop()); break;
        case 0x11: { guard(2, 1); const b = pop(); push(pop() - b); break; }
        case 0x12: guard(2, 1); push(Math.imul(pop(), pop())); break; // MUL
        case 0x13: divide(false, false); break;
        case 0x14: divide(false, true); break;
        case 0x15: divide(true, false); break;
        case 0x16: divide(true, true); break;
        case 0x17: guard(1, 1); push(-pop()); break;
        case 0x18: guard(2, 1); push(pop() & pop()); break;
        case 0x19: guard(2, 1); push(pop() | pop()); break;
        case 0x1a: guard(2, 1); push(pop() ^ pop()); break;
        case 0x1b: guard(1, 1); push(~pop()); break;
        case 0x1c: // SHL / SHR / SHRU, count & 31
        case 0x1d:
        case 0x1e: {
          guard(2, 1);
          const b = pop();
          const a = pop();
          push(op === 0x1c ? a << (b & 31) : op === 0x1d ? a >> (b & 31) : (a >>> 0) >>> (b & 31));
          break;
        }
        case 0x20: guard(2, 1); push(pop() === pop() ? 1 : 0); break;
        case 0x21: { guard(2, 1); const b = pop(); push(pop() < b ? 1 : 0); break; } // LT
        case 0x22: { guard(2, 1); const b = pop() >>> 0; push((pop() >>> 0) < b ? 1 : 0); break; } // LTU
        case 0x30: pc = next + code.readInt16LE(pc + 1); continue; // JMP, relative to next
        case 0x31: guard(1, 0); pc = pop() === 0 ? next + code.readInt16LE(pc + 1) : next; continue;
        case 0x32: guard(1, 0); pc = pop() !== 0 ? next + code.readInt16LE(pc + 1) : next; continue;
        case 0x33: // CALL, absolute target
          if (calls.length >= 64) trap(7);
          calls.push(next);
          pc = code.readUInt16LE(pc + 1);
          continue;
        case 0x34: // RET
          if (calls.length === 0) trap(8);
          pc = calls.pop() as number;
          continue;
        case 0x40: {
          guard(1, 1);
          const addr = pop();
          if (addr < 0 || addr > 255) trap(6);
          push(mem[addr]);
          break;
        }
        case 0x41: { // STORE
          guard(2, 0);
          const addr = pop(); const v = pop();
          if (addr < 0 || addr > 255) trap(6);
          mem[addr] = v;
          break;
        }
        case 0x50: { // PRINT
          guard(1, 0);
          const text = String(pop());
          if (emitted.length + text.length > OUT_LIMIT) trap(11);
          for (let i = 0; i < text.length; i++) emitted.push(text.charCodeAt(i));
          break;
        }
        case 0x51:
          guard(1, 0);
          if (emitted.length + 1 > OUT_LIMIT) trap(11);
          emitted.push(pop() & 255);
          break;
        case 0x52: // IN: -1 past the end
          guard(0, 1);
          if (cursor < input.length) push(input[cursor++]);
          else push(-1);
          break;
        case 0x53: guard(1, 0); return done(pop() & 255); // EXIT
        default: trap(5);
      }
      pc = next;
    }
  } catch (t) {
    if (typeof t !== "number") throw t;
    return done(t);
  }
}

const ids = readdirSync("/input", { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^i\d{3}$/.test(d.name))
  .map((d) => d.name)
  .sort();
for (const id of ids) {
  const dir = `/input/${id}/`;
  const answer = execute(readOrEmpty(dir + "program.bin"), readOrEmpty(dir + "input.bin"));
  mkdirSync(`/output/${id}`, { recursive: true });
  writeFileSync(`/output/${id}/stdout.bin`, answer.out);
  writeFileSync(`/output/${id}/exit.txt`, `${answer.code}\n`);
}
