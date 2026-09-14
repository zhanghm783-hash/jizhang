#!/usr/bin/env node
/**
 * 提交标记管理脚本 ——「提交前自动检查」的核心。
 *
 * 标记文件在 .claude/checks/ 下，共 4 种：
 *   tests.pass.json / tests.fail.json        单元测试帮工（tester）写
 *   quality.pass.json / quality.fail.json    质检帮工（quality-checker）写
 *
 * 规则：提交放行要求两个 pass 标记都存在且未过期；标记是一次性的，
 * 每次提交执行后（不管成功失败）立即销毁，下次提交必须重新检查。
 *
 * 子命令：
 *   write <类型> <状态> <json>   写标记（类型=tests|quality，状态=pass|fail），
 *                                自动补时间戳，并删除同类型相反状态的标记。
 *   check                        检查两个 pass 标记都在且未过期；不通过时
 *                                中文提示写到 stderr、退出码 2。
 *   consume                      销毁全部 4 个标记文件。
 *   check-and-consume            先 check，通过后立即 consume。
 *                                （供 Git 原生 pre-commit 钩子一次调用）
 *   pretooluse                   Claude Code PreToolUse 钩子专用：
 *                                读 stdin 的 JSON，识别 git commit 命令，
 *                                通过则放行（--no-verify 时补销毁标记），
 *                                不通过则中文提示 + 退出码 2 拦截。
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// 标记有效期兜底（毫秒）：防止拿很久以前的检查结果提交。不想要可改大或去掉。
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const checksDir = path.join(root, ".claude", "checks");
const MARKER_FILES = ["tests.pass.json", "tests.fail.json", "quality.pass.json", "quality.fail.json"];

function markerPath(name) {
  return path.join(checksDir, name);
}

function readMarker(name) {
  try {
    return JSON.parse(readFileSync(markerPath(name), "utf8"));
  } catch {
    return null;
  }
}

/** 检查一个 pass 标记：存在且未过期。返回 null 表示通过，否则返回原因。 */
function verifyPass(name, label) {
  const marker = readMarker(name);
  if (!marker) return `缺少「${label}通过」标记（.claude/checks/${name}）`;
  const at = Date.parse(marker.at);
  if (Number.isNaN(at)) return `「${label}通过」标记缺少有效时间（.claude/checks/${name}）`;
  if (Date.now() - at > MAX_AGE_MS) return `「${label}通过」标记已超过 24 小时，检查结果作废`;
  return null;
}

function fail(reasons) {
  process.stderr.write(
    [
      "⛔ git commit 被拦截：提交前必须通过「单元测试 + 质量检查」两道关。",
      ...reasons.map((r) => `  - ${r}`),
      "解决办法：对 Claude 说「帮我提交」，会自动并行跑单元测试和质检，全部通过后再提交。",
      "（紧急情况可手动执行 git commit --no-verify 跳过，请慎用。）",
      "",
    ].join("\n"),
  );
  process.exit(2);
}

/** 识别命令是否是一次 git commit（兼容 git -C "路径" commit 的写法） */
function isGitCommit(cmd) {
  const stripped = cmd.replace(/(-C|--git-dir|--work-tree)\s+("[^"]*"|'[^']*'|\S+)/g, " ");
  return /\bgit\s+commit(\s|$)/.test(stripped);
}

function write(argv) {
  const [type, status, jsonText] = argv;
  if (!["tests", "quality"].includes(type) || !["pass", "fail"].includes(status)) {
    process.stderr.write(`用法：markers.mjs write <tests|quality> <pass|fail> '<json>'\n`);
    process.exit(1);
  }
  let data = {};
  try {
    data = JSON.parse(jsonText || "{}");
  } catch {
    process.stderr.write("第三个参数必须是合法的 JSON 字符串\n");
    process.exit(1);
  }
  data.at = new Date().toISOString();
  mkdirSync(checksDir, { recursive: true });
  writeFileSync(markerPath(`${type}.${status}.json`), JSON.stringify(data, null, 2) + "\n", "utf8");
  // 删除同类型相反状态的标记，保证状态互斥
  const opposite = markerPath(`${type}.${status === "pass" ? "fail" : "pass"}.json`);
  rmSync(opposite, { force: true });
  console.log(`已写标记：${type}.${status}.json`);
}

function check() {
  const reasons = [
    verifyPass("tests.pass.json", "单元测试"),
    verifyPass("quality.pass.json", "质量检查"),
  ].filter(Boolean);
  if (reasons.length > 0) fail(reasons);
  console.log("提交关卡检查通过：单元测试与质量检查的通过标记齐全。");
  process.exit(0);
}

function consume() {
  for (const name of MARKER_FILES) rmSync(markerPath(name), { force: true });
  console.log("已销毁全部提交标记（一次性规则：下次提交需重新检查）。");
}

function checkAndConsume() {
  const reasons = [
    verifyPass("tests.pass.json", "单元测试"),
    verifyPass("quality.pass.json", "质量检查"),
  ].filter(Boolean);
  if (reasons.length > 0) fail(reasons);
  consume();
  process.exit(0);
}

function pretooluse() {
  let input = "";
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", () => {
    let cmd = "";
    try {
      cmd = String((JSON.parse(input).tool_input || {}).command || "");
    } catch {
      // 解析不了就当普通命令放行，避免误伤
      process.exit(0);
    }
    if (!isGitCommit(cmd)) process.exit(0);

    const reasons = [
      verifyPass("tests.pass.json", "单元测试"),
      verifyPass("quality.pass.json", "质量检查"),
    ].filter(Boolean);
    if (reasons.length > 0) fail(reasons);

    // 命令带 --no-verify 会跳过原生钩子，这里补做销毁，保持「每次提交都销毁」的规则
    if (/\s--no-verify(\s|$)/.test(cmd)) consume();
    process.exit(0);
  });
}

const [mode, ...rest] = process.argv.slice(2);
switch (mode) {
  case "write":
    write(rest);
    break;
  case "check":
    check();
    break;
  case "consume":
    consume();
    break;
  case "check-and-consume":
    checkAndConsume();
    break;
  case "pretooluse":
    pretooluse();
    break;
  default:
    process.stderr.write("用法：markers.mjs <write|check|consume|check-and-consume|pretooluse>\n");
    process.exit(1);
}
