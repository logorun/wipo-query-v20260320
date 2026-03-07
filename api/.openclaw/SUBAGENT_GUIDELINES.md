# 🐙 八爪鱼 Subagent 工作准则 v1.0

> 基于 Anthropic "Effective harnesses for long-running agents" + 用户指定准则

---

## 核心哲学

### Anthropic 文章关键洞察
1. **外部循环优于长会话** - 用外部脚本循环调用 agent，而非单个长会话
2. **一次只做一件事** - 每个 subagent session 只完成一个原子任务
3. **状态持久化** - 通过文件系统保存状态，而非依赖会话记忆
4. **干净上下文** - 每次启动都是全新的、无历史负担的上下文

### 用户指定准则

#### 准则 1: 不虚构数据临时应对任务
**问题**: Subagent 遇到缺失数据时，倾向于伪造/mock 数据来"完成"任务
**禁止**:
- ❌ 创建假数据假装功能正常
- ❌ 用 mock 值填充缺失的配置
- ❌ 假设数据结构存在而实际不存在
- ❌ "假装"修复成功而未实际验证

**正确做法**:
- ✅ 遇到缺失数据立即停止
- ✅ 通过任务状态文件报告阻塞原因
- ✅ Body 决定如何处理（获取真实数据/调整设计）
- ✅ 所有数据必须来源真实（代码、配置、API）

#### 准则 2: 少量多次调用 Subagent
**原则**: 宁可 10 次 5 分钟的会话，也不要 1 次 50 分钟的会话

**为什么**:
- 短会话 = 更低的上下文污染风险
- 短会话 = 更容易定位和修复问题
- 短会话 = 失败时损失更小，重试更快
- 短会话 = 更好的并行性

**执行**:
- 每个 subagent 任务应该 5-15 分钟完成
- 超过 15 分钟的任务必须进一步拆分
- Body 频繁检查进度（每 30-60 秒）

#### 准则 3: 按代码依赖拆分极细粒度 Todo
**原则**: 任务粒度应该细到"几乎不可能再拆分"

**拆分维度**:
1. **文件依赖** - 修改文件 A 必须等文件 B 完成
2. **逻辑依赖** - 函数 C 依赖函数 D 的实现
3. **数据依赖** - 需要文件 X 生成的数据才能继续
4. **接口依赖** - API 端点依赖 service 层的实现

**示例**（API 完善项目）:
```
❌ 粗粒度（避免）:
- [ ] 完善 tasks API

✅ 细粒度（推荐）:
- [ ] 读取当前 tasks.js route 文件，记录所有端点
- [ ] 读取 taskController.js，分析已有方法
- [ ] 检查 routes 和 controller 的映射关系，找出缺失端点
- [ ] 创建端点缺失清单文件
- [ ] 实现 GET /tasks/:taskId/results 端点（路由层）
- [ ] 实现 getTaskResults controller 方法
- [ ] 添加 getTaskResults 的输入验证
- [ ] 编写 getTaskResults 单元测试
- [ ] ...（继续拆分）
```

---

## 工作流程

### Phase 1: Body 分析（当前阶段）
1. **探索现状** - 读取现有代码，理解结构
2. **识别缺口** - 找出需要完善的部分
3. **任务拆分** - 按依赖关系拆分成原子任务
4. **创建清单** - 生成详细的 tasks.json

### Phase 2: 并行执行
```
Body:
1. 从 tasks.json 读取待处理任务
2. 分析依赖图，找出当前可并行执行的任务组
3. 为每个任务启动独立的 subagent (sessions_spawn)
4. 等待 30-60 秒，检查进度
5. 如果有完成的任务，更新依赖状态
6. 继续下一轮，直到全部完成
```

### Phase 3: 验证整合
1. Body 读取所有任务结果
2. 运行集成测试
3. 验证所有功能正常
4. 报告给用户

---

## Subagent 任务模板

每个 subagent 任务必须包含：

```yaml
任务ID: "task-001"
目标: "具体、可验证的描述"
输入文件: ["依赖的文件路径"]
输出文件: ["将创建/修改的文件路径"]
验证命令: "运行此命令验证成功"
最大耗时: "10分钟"

步骤:
  1. "读取输入文件"
  2. "执行具体操作"
  3. "运行验证命令"
  4. "更新任务状态文件"
  5. "git commit"

禁止:
  - "不要假设数据存在，必须验证"
  - "不要创建 mock 数据"
  - "不要超出指定范围"
  - "不要询问用户，遇到问题记录到状态文件"
```

---

## 状态文件规范

### tasks.json 结构
```json
{
  "version": "1.0",
  "project": "wipo-api-enhancement",
  "createdAt": "2026-03-06T10:30:00Z",
  "tasks": [
    {
      "id": "explore-routes",
      "description": "读取并分析现有 routes 文件",
      "status": "completed",
      "priority": 1,
      "dependencies": [],
      "inputFiles": ["api/src/routes/tasks.js"],
      "outputFiles": ["api/.openclaw/findings/routes-analysis.md"],
      "assignedTo": null,
      "startedAt": null,
      "completedAt": "2026-03-06T10:35:00Z",
      "result": "success",
      "notes": "发现 4 个端点，其中 1 个缺失 controller"
    }
  ]
}
```

### 任务状态流转
```
pending → assigned → in_progress → completed/failed
```

---

## 当前项目：WIPO API 完善

### 第一步：现状探索（当前）
需要创建 subagent 来：
1. 读取 api/src/routes/*.js - 列出所有现有端点
2. 读取 api/src/controllers/*.js - 列出所有 controller 方法
3. 对比 routes 和 controllers，找出映射关系
4. 检查 service 层实现
5. 生成缺口分析报告

### 待办清单（初步）
- [ ] Task 1: 分析现有 routes 结构
- [ ] Task 2: 分析现有 controllers
- [ ] Task 3: 分析 service 层
- [ ] Task 4: 识别缺失端点
- [ ] Task 5+: 逐个实现缺失功能

---

## 执行检查清单

每次启动 subagent 前，Body 检查：
- [ ] 任务是否足够细粒度（<15分钟）
- [ ] 输入文件是否存在（不虚构）
- [ ] 依赖任务是否已完成
- [ ] 验证命令是否可执行

每次 subagent 完成后，Body 检查：
- [ ] 输出文件是否创建
- [ ] 验证命令是否通过
- [ ] git commit 是否存在
- [ ] 任务状态是否更新
