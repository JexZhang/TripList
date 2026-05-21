<!-- BEGIN init-project:managed -->
# 初始化报告（临时，Phase D 清理时删除）

## Phase A: SCAN 完成
- 生成时间：2026-05-21 17:11:04
- 项目：行册
- 技术栈：React, Shell/Bash, TypeScript
- 语言：shell, typescript
- 业务文件数：23（源码 13 个）
- 模块数：18
- 测试覆盖：0/23 文件有对应测试（文件名匹配）
- 依赖边：8 条，1 个模块有内部依赖图
- 入口文件：3 个
- 模块展示策略：模块数量 18 个，不超过 20，已全部列出。

## 扫描统计
- 含 imports 的文件：4
- 含 exports 的文件：12
- 含测试覆盖的文件：0
- Mermaid 依赖图模块：config

## 入口文件
- config/index.ts
- src/app.ts
- src/pages/index/index.tsx

## 下一步
**Phase B1: PLAN** — AI 将：
1. 运行 plan-split.py 机械粗分（连通分量 + 重叠检查），输出 .plan-split.md
2. 启动 Planner Agent 语义验证拆分方案，等待你确认

**Phase B2: SPEC** — AI 将：
3. 最多 2 个并行启动 Spec Writer Agent，每个读一个 capability 的全部源文件
4. 每个 Spec Writer 输出 openspec/specs/{slug}/spec.md + 追加写入 doc/.covered.json
5. 运行 check-coverage.sh 检查覆盖率（≥95%）

**Phase B3: SYNTHESIZE** — 启动 Synthesizer Agent：
6. 读所有 spec.md + .scan-*.json 分片 → 合成 codemap / patterns / 校正 commands

**Phase D: VALIDATE + 清理** — 运行 post-init-check.sh 质量门禁，删除临时文件
**Phase E: AGENTS.md** — AI 生成根目录 AGENTS.md 导航地图

> 最终 doc/ 只保留 codemap.md、patterns.md、commands.md 三个文件。
<!-- END init-project:managed -->
