# AutoClick - AI智能操控详细设计（V1.1）

| **文档版本** | **修改日期** | **修改人** | **修改内容** |
| :--- | :--- | :--- | :--- |
| V1.0 | 2026-06-23 | AI Assistant | 初始创建，基于需求文档3.7节"AI智能操控"展开详细设计 |
| V1.1 | 2026-06-23 | AI Assistant | 移除人工确认节点，指令生成后立即执行；将ADB直接调用改为转换为脚本引擎步骤并调用ScriptEngine执行 |

---

## 1. 模块概述

### 1.1 模块定位

AI智能操控模块是 AutoClick 的高阶自动化能力扩展，它将用户的自然语言指令（如"点击微信"、"滑动到下一屏"）通过 LangGraph.js 编排的 AI Agent 工作流，结合 DeepSeek 多模态视觉模型对手机屏幕的实时理解，自动转换为精确的 ADB 控制命令并执行。

### 1.2 职责边界

| **职责** | **说明** |
| :--- | :--- |
| **语义指令解析** | 接收用户自然语言指令，通过 LLM 解析为结构化动作意图 |
| **屏幕视觉感知** | 截取当前手机屏幕，通过 VLM 识别 UI 元素位置和文本内容 |
| **坐标映射与校准** | 将 VLM 返回的坐标根据设备分辨率校准，生成精确控制参数 |
| **工作流编排** | 使用 LangGraph.js 编排多步骤 Agent 工作流，管理状态流转 |
| **转换为脚本引擎步骤** | 将 VLM 解析结果转换为 `ScriptEngine` 的 `EngineStep[]` 格式，调用引擎执行 |

| **不包含的职责** | **说明** |
| :--- | :--- |
| ADB 设备连接管理 | 由 screen-mirror 模块负责，本模块通过 serial 参数引用 |
| 脚本数据持久化 | 由 ScriptService 负责 |
| 投屏画面渲染 | 由 MirrorPanel / ScreenCanvas 负责 |
| 触控命令底层执行 | 由 ScriptEngine 的 StepExecutor 负责，AI 模块不直接调用 ADB |

### 1.3 架构决策

| **决策项** | **选择** | **原因** |
| :--- | :--- | :--- |
| AI 编排框架 | LangGraph.js（@langchain/langgraph） | 原生支持 Node.js / TypeScript，有状态图编排能力，可与 Electron 主进程深度集成 |
| 视觉模型 | DeepSeek 多模态（deepseek-vision） | 高性价比的多模态理解能力，OpenAI 兼容 API 便于集成 |
| LLM 模型 | DeepSeek Chat | 意图解析和自然语言理解，与视觉模型统一 API 调用 |
| 工作流运行位置 | Electron 主进程 | 可访问 ADB、文件系统和 IPC，渲染进程仅负责 UI 展示 |
| 截图方式 | adb exec-out screencap -p | 独立于 scrcpy 视频流，在主进程中直接截取，避免耦合 |
| 命令执行方式 | 转换为 EngineStep[] → 调用 ScriptEngine | 复用现有脚本引擎的执行能力（队列、重试、进度推送），避免重复实现 ADB 调用逻辑 |
| 状态管理 | LangGraph StateGraph + Zustand（渲染进程） | LangGraph 管理 Agent 工作流状态，Zustand 管理 UI 展示状态 |

---

## 2. 技术选型

### 2.1 依赖包清单

| **依赖包** | **版本** | **说明** | **使用方式** |
| :--- | :--- | :--- | :--- |
| `@langchain/langgraph` | ^0.2.x | LangGraph 图编排核心 | 主进程构建 Agent StateGraph |
| `@langchain/core` | ^0.3.x | LangChain 基础库（消息模型、工具定义） | 定义 ChatModels、消息、工具 |
| `@langchain/openai` | ^0.3.x | OpenAI 兼容 API 封装 | 对接 DeepSeek API（baseURL 指向 DeepSeek） |
| `sharp` | ^0.33.x | 高性能图片处理 | 截图缩放、Base64 编解码、压缩优化 |
| 系统 ADB | PATH 环境变量 | 截图与命令执行 | child_process.exec 异步调用 |

### 2.2 备选方案说明

| **备选方案** | **优势** | **不选用的原因** |
| :--- | :--- | :--- |
| GPT-4o Vision | 识别精度更高 | 成本较高，DeepSeek 性价比更优 |
| 本地 OCR + 语义理解 | 无 API 调用成本 | 无法处理复杂 UI 布局和图标识别，准确率低 |
| LangChain Agent（非 Graph） | 更简单 | 缺少有状态图编排能力，无法处理复杂的分支和循环 |

---

## 3. 目录结构

```
src/main/
├── ai-agent/                       # AI 智能操控模块
│   ├── index.ts                    # 模块入口 + IPC Handler 注册
│   ├── types.ts                    # 类型定义（工作流状态、节点输出等）
│   ├── graph.ts                    # LangGraph StateGraph 定义与编译
│   ├── config.ts                   # 模块配置（API Key、模型名、超时等）
│   ├── nodes/                      # 工作流各节点实现
│   │   ├── intent-parser.ts        # 意图理解节点（LLM 调用）
│   │   ├── screenshot.ts           # 截屏节点（ADB screencap）
│   │   ├── visual-analysis.ts      # 视觉分析节点（VLM 调用）
│   │   ├── coordinate-mapper.ts    # 坐标映射节点（分辨率校准）
│   │   ├── step-converter.ts       # 步骤转换节点（AI 结果 → EngineStep[]）
│   │   └── script-engine-executor.ts # 引擎执行节点（调用 ScriptEngine.runSteps()）
│   ├── services/                   # 服务层
│   │   ├── deepseek-service.ts     # DeepSeek API 封装（LLM + VLM）
│   │   └── screen-service.ts       # 截图与图片处理服务
│   ├── utils/                      # 工具函数
│   │   ├── image-utils.ts          # 图片处理工具（压缩、Base64、对比）
│   │   └── coordinate-utils.ts     # 坐标计算工具（相对/绝对转换）
│   └── prompts/                    # 提示词模板
│       ├── intent-parser.md         # 意图理解提示词
│       └── visual-analysis.md       # 视觉分析提示词

src/renderer/
├── components/
│   └── AiAgentPanel.tsx            # AI 智能操控面板组件
├── stores/
│   └── aiAgentStore.ts             # AI Agent 状态管理（Zustand）
└── channels/
    └── aiAgentChannels.ts          # IPC 通道常量
```

### 3.1 文件职责说明

| **文件** | **职责** | **关键依赖** |
| :--- | :--- | :--- |
| `index.ts` | 模块入口，注册 ai-agent 相关 IPC 处理器 | graph, types, config |
| `graph.ts` | 定义 StateGraph，编译为可执行应用 | nodes/*, types |
| `types.ts` | AgentState、NodeOutput、IPC 消息类型定义 | — |
| `config.ts` | API Key、模型名、超时、重试等配置 | — |
| `nodes/intent-parser.ts` | LLM 意图理解节点实现 | deepseek-service, prompts |
| `nodes/screenshot.ts` | ADB 截图节点实现 | screen-service |
| `nodes/visual-analysis.ts` | VLM 视觉分析节点实现 | deepseek-service, image-utils, prompts |
| `nodes/coordinate-mapper.ts` | 坐标校准节点实现 | coordinate-utils |
| `nodes/step-converter.ts` | 步骤转换节点：AI 结果 → EngineStep[] | types |
| `nodes/script-engine-executor.ts` | 引擎执行节点：调用 ScriptEngine.runSteps() | script-engine（外部） |
| `services/deepseek-service.ts` | DeepSeek API 统一封装（Chat + Vision） | @langchain/openai |
| `services/screen-service.ts` | ADB 截图 + sharp 图片处理 | sharp |
| `services/adb-command-service.ts` |（可选）独立 ADB 命令执行 | child_process |

---

## 4. 模块依赖关系

```
index.ts (IPC Handler 注册)
    │
    ▼
graph.ts (StateGraph 编译)
    │
    ├── nodes/intent-parser.ts ──→ services/deepseek-service.ts
    │                                   └── @langchain/openai → DeepSeek API
    │
    ├── nodes/screenshot.ts ──→ services/screen-service.ts
    │                               ├── child_process (adb exec-out screencap)
    │                               └── sharp (图片压缩/编码)
    │
    ├── nodes/visual-analysis.ts ──→ services/deepseek-service.ts
    │                                   └── @langchain/openai → DeepSeek Vision API
    │
    ├── nodes/coordinate-mapper.ts ──→ utils/coordinate-utils.ts
    │
    ├── nodes/step-converter.ts ──→ types (EngineStep 格式映射)
    │
    └── nodes/script-engine-executor.ts ──→ ScriptEngine (外部)
                                              └── runSteps() → StepExecutor → ADB
```

### 4.1 外部依赖说明

| **外部模块** | **调用方式** | **说明** |
| :--- | :--- | :--- |
| `ScriptEngine`（script-engine 模块） | 直接调用 `runSteps()` | 执行 AI 生成的 EngineStep[]，复用其队列/重试/进度推送能力 |
| `screen-mirror/adb.ts` | 引用设备 serial | 获取当前连接设备的 serial 号和分辨率 |
| `config.ts` | 动态导入 | 读取 API Key、超时等配置 |
| `BrowserWindow` | Electron API | 向渲染进程推送工作流状态 |

---

## 5. 核心架构设计

### 5.1 LangGraph StateGraph 工作流图

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                 AgentState (全局状态)                         │
                    │  { userInput, screenshot, intent, target,                   │
                    │    coordinates, engineSteps, result, history, errors }       │
                    └─────────────────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────────┐
                    │                    ▼                        │
                    │         ┌──────────────────┐                │
                    │         │   intent-parser   │  ← LLM        │
                    │         │   (意图理解)      │                │
                    │         └────────┬─────────┘                │
                    │                  ▼                          │
                    │         ┌──────────────────┐                │
                    │   ┌──── │  intent-parser   │  ← keyEvent  │
                    │   │     │  (直接生成步骤)   │    跳过视觉   │
                    │   │     └──────────────────┘                │
                    │   │                                          │
                    │   │     ┌──────────────────┐                │
                    │   │     │   screenshot      │  ← ADB        │
                    │   │     │   (截屏)          │                │
                    │   │     └────────┬─────────┘                │
                    │   │              ▼                          │
                    │   │     ┌──────────────────┐                │
                    │   │     │  visual-analysis  │  ← VLM        │
                    │   │     │  (视觉分析)       │                │
                    │   │     └────────┬─────────┘                │
                    │   │              ▼                          │
                    │   │     ┌──────────────────┐                │
                    │   │     │ coordinate-mapper│  ← 校准        │
                    │   │     │  (坐标映射)       │                │
                    │   │     └────────┬─────────┘                │
                    │   │              ▼                          │
                    │   └──────┬───────┘                          │
                    │          ▼                                  │
                    │  ┌──────────────────┐                       │
                    │  │  step-converter   │  ← 转换为 EngineStep │
                    │  │  (步骤转换)       │    调用 ScriptEngine  │
                    │  └────────┬─────────┘                       │
                    │           ▼                                 │
                    │  ┌──────────────────┐                       │
                    │  │  script-engine    │  ← 复用现有引擎      │
                    │  │  (引擎执行)       │    队列/重试/进度推送 │
                    │  └────────┬─────────┘                       │
                    │           ▼                                 │
                    │  ┌──────────────────┐                       │
                    │  │     结束节点      │  ← 返回执行结果       │
                    │  └──────────────────┘                       │
                    └─────────────────────────────────────────────┘
```

### 5.2 状态对象设计（AgentState）

```typescript
interface AgentState {
  // 输入
  userInput: string;                   // 用户原始自然语言指令
  deviceSerial: string;                // 目标设备 serial 号
  deviceResolution: { width: number; height: number }; // 设备分辨率

  // 中间状态
  intent: IntentResult | null;         // 意图理解结果
  screenshotBase64: string | null;     // 屏幕截图（Base64）
  screenshotPath: string | null;       // 截图本地缓存路径
  visualResult: VisualResult | null;   // 视觉分析结果
  calibratedCoords: CalibratedCoord | null; // 校准后坐标
  engineSteps: EngineStep[];           // 转换后的脚本引擎步骤列表

  // 输出
  result: ScriptEngineResult | null;   // 脚本引擎执行结果
  error: AgentError | null;            // 错误信息

  // 上下文
  history: HistoryEntry[];             // 历史记录（多轮对话上下文）
}
```

### 5.3 工作流路由逻辑

| **条件** | **下一节点** | **说明** |
| :--- | :--- | :--- |
| 意图识别为 `keyEvent`（如返回/首页/菜单） | **跳过截图+视觉分析** → 直接到步骤转换 | 系统按键不依赖屏幕坐标，由 intent-parser 直接生成 EngineStep |
| 意图需要坐标（tap/swipe/longPress/input） | **screenshot → visual-analysis → coordinate-mapper** | 完整视觉链路，获取精确坐标 |
| 步骤转换完成 | **调用 ScriptEngine.runSteps()** | 直接执行，无需确认 |
| 引擎执行成功 | **返回成功结果** | 包含执行详情 |
| 任何节点发生错误 | **进入错误处理分支** → 重试/终止 | 根据错误类型决定 |

---

## 6. 节点详细设计

### 6.1 意图理解节点（intent-parser）

| **属性** | **描述** |
| :--- | :--- |
| **节点 ID** | `intent_parser` |
| **调用模型** | DeepSeek Chat（非 Vision，纯文本） |
| **输入** | `state.userInput` |
| **输出** | `state.intent` |

**处理逻辑**：
1. 加载 `intent-parser.md` 提示词模板，填充用户指令
2. 调用 DeepSeek Chat API，要求返回结构化 JSON
3. 解析 JSON，提取 `action`、`target`、`params`
4. 解析 JSON，提取 `action`、`target`、`params`

**返回数据结构**：
```typescript
interface IntentResult {
  action: 'tap' | 'swipe' | 'longPress' | 'input' | 'keyEvent' | 'sequence';
  target: string;                  // 目标语义描述，如"微信图标"、"WiFi 开关"
  params?: {
    direction?: 'up' | 'down' | 'left' | 'right';  // 滑动方向
    text?: string;                                     // 输入文本
    key?: 'HOME' | 'BACK' | 'MENU' | 'POWER';         // 按键类型
    duration?: number;                                 // 长按/滑动时长(ms)
    steps?: IntentResult[];                            // 复合指令的子步骤
  };
  confidence: number;              // 置信度 0-1
}
```

### 6.2 截屏节点（screenshot）

| **属性** | **描述** |
| :--- | :--- |
| **节点 ID** | `screenshot` |
| **调用方式** | `child_process.exec` 执行 ADB 命令 |
| **输入** | `state.deviceSerial` |
| **输出** | `state.screenshotBase64`、`state.screenshotPath` |

**处理逻辑**：
1. 执行 `adb -s <serial> exec-out screencap -p` 获取原始 PNG 数据
2. 通过 sharp 将图片缩放到最大 1024px（优化 VLM 调用成本）
3. 保存缩放后的图片到临时目录（用于人工确认展示）
4. 编码为 Base64（去掉 `data:image/png;base64,` 前缀）

**优化策略**：
- 缓存最近 3 帧截图，若界面未变化（像素对比）则复用
- 缩放比例记录到 state 供坐标映射节点反向校准

### 6.3 视觉分析节点（visual-analysis）

| **属性** | **描述** |
| :--- | :--- |
| **节点 ID** | `visual_analysis` |
| **调用模型** | DeepSeek Vision（多模态） |
| **输入** | `state.screenshotBase64` + `state.intent` |
| **输出** | `state.visualResult` |

**处理逻辑**：
1. 加载 `visual-analysis.md` 提示词模板，包含目标语义描述和截图
2. 构造多模态消息：system prompt + user（文本描述 + 图片）
3. 调用 DeepSeek Vision API，要求返回目标元素的精确坐标和描述
4. 解析响应，提取坐标信息

**返回数据结构**：
```typescript
interface VisualResult {
  elements: Array<{
    label: string;                // 识别出的元素名称
    bounds: {                     // 元素边界（基于缩放后图片坐标）
      x: number;
      y: number;
      width: number;
      height: number;
    };
    center: { x: number; y: number };  // 元素中心点
    confidence: number;           // 识别置信度 0-1
    text?: string;                // 元素上的文本（如有）
    type?: string;                // UI 控件类型（icon/button/text/switch）
  }>;
  rawDescription: string;         // VLM 返回的原始文本描述
}
```

### 6.4 坐标映射节点（coordinate-mapper）

| **属性** | **描述** |
| :--- | :--- |
| **节点 ID** | `coordinate_mapper` |
| **执行方式** | 纯计算，无外部调用 |
| **输入** | `state.visualResult` + `state.deviceResolution` + 截图缩放比例 |
| **输出** | `state.calibratedCoords` |

**处理逻辑**：
1. 获取截图缩放比例 `scale = originalWidth / resizedWidth`
2. 将 VLM 返回的坐标乘以缩放比例，映射回原始分辨率
3. 根据 action 类型计算最终坐标参数
   - `tap` → 取元素中心点 (center.x * scale, center.y * scale)
   - `swipe` → 根据方向计算起止坐标
   - `longPress` → 取元素中心点，duration = 1500ms
   - `input` → 取元素中心点（先 tap 聚焦，再 input text）

**返回数据结构**：
```typescript
interface CalibratedCoord {
  action: string;
  points: Array<{ x: number; y: number }>;  // 操作坐标点列表
  params: Record<string, any>;               // 附加参数（duration/text 等）
}
```

### 6.5 步骤转换节点（step-converter）

| **属性** | **描述** |
| :--- | :--- |
| **节点 ID** | `step_converter` |
| **执行方式** | 纯计算，将 AI 解析结果映射为 ScriptEngine 的 EngineStep 格式 |
| **输入** | `state.intent` + `state.calibratedCoords`（或 keyEvent 参数） |
| **输出** | `state.engineSteps` |

**处理逻辑**：
1. 根据 `intent.action` 和 `calibratedCoords` 组装 `EngineStep[]`
2. EngineStep 类型与 AI 动作类型的映射关系：

| **AI 动作类型** | **EngineStep.type** | **EngineStep.data** |
| :--- | :--- | :--- |
| tap | `click` | `{ x, y }` |
| swipe | `swipe` | `{ direction, distance?, duration? }` |
| longPress | `longpress` | `{ x, y, duration }`（duration 转为秒） |
| input | `click` + `type` | 先点击输入框聚焦，再输入文本 |
| keyEvent | `click`（特殊处理） | 由 ScriptEngine 直接执行 `input keyevent` |
| sequence | 多个 EngineStep | 按顺序组装为步骤数组 |

3. 每个步骤设置合理的 `delay`（默认 500ms，确保 UI 动效完成）

```typescript
interface EngineStep {
  type: 'click' | 'type' | 'swipe' | 'longpress';
  data: Record<string, any>;
  delay?: number;
}
```

**示例转换**：

| **AI 意图** | **生成的 EngineStep[]** |
| :--- | :--- |
| "点击微信" (tap at 160, 1860) | `[{ type: 'click', data: { x: 160, y: 1860 }, delay: 0.5 }]` |
| "滑动到下一屏" (swipe left) | `[{ type: 'swipe', data: { direction: 'left', distance: 600 }, delay: 0.5 }]` |
| "长按支付宝" (longPress at 380, 1860) | `[{ type: 'longpress', data: { x: 380, y: 1860, duration: 1.5 }, delay: 0.5 }]` |
| "返回桌面" (keyEvent HOME) | `[{ type: 'click', data: { keyEvent: 'KEYCODE_HOME' }, delay: 0.5 }]`
| "打开设置
d并点击WiFi" (sequence) | `[{ type: 'click', data: { x, y } }, { type: 'click', data: { x, y }, delay: 1.0 }]` |

### 6.6 引擎执行节点（script-engine-executor）

| **属性** | **描述** |
| :--- | :--- |
| **节点 ID** | `script_engine_executor` |
| **调用方式** | 调用 `ScriptEngine.runSteps()` — 新增方法，接收 EngineStep[] 直接执行 |
| **输入** | `state.engineSteps` + `state.deviceSerial` |
| **输出** | `state.result` |

**处理逻辑**：
1. 调用 `ScriptEngine.runSteps(steps, serial)` 执行步骤列表
2. 该方法内部复用 ScriptEngine 的：
   - `StepExecutor` — 执行单个步骤的 ADB 命令
   - `ExecutionQueue` — FIFO 队列管理（与脚本执行共用，避免冲突）
   - IPC 进度推送 — `engine:stepStart/stepEnd/stepError/complete`
   - 重试机制 — 基于配置的 `maxRetries`
   - 步骤间延迟 — 步骤级 delay + 全局 stepInterval
3. 等待执行完成，返回 `ScriptEngineResult`

```typescript
interface ScriptEngineResult {
  success: boolean;
  totalSteps: number;
  completedSteps: number;
  duration: number;
  error?: string;
  stepResults: Array<{ index: number; success: boolean; error?: string; duration: number }>;
}
```

> **说明**：此节点不直接调用 ADB，而是通过 ScriptEngine 复用已有的执行链路。ScriptEngine 的 `StepExecutor` 内部使用 `adb-executor.ts` 执行实际的 ADB shell 命令。

---

## 7. 类型定义（types.ts）

### 7.1 工作流状态类型

```typescript
// === Agent 工作流状态 ===
export interface AgentState {
  // 输入
  userInput: string;
  deviceSerial: string;
  deviceResolution: Resolution;

  // 中间状态
  intent: IntentResult | null;
  screenshotBase64: string | null;
  screenshotPath: string | null;
  visualResult: VisualResult | null;
  calibratedCoords: CalibratedCoord | null;
  engineSteps: EngineStep[];

  // 输出
  result: ScriptEngineResult | null;
  error: AgentError | null;

  // 上下文
  history: HistoryEntry[];
}

export interface Resolution {
  width: number;
  height: number;
}

// === 意图理解 ===
export interface IntentResult {
  action: ActionType;
  target: string;
  params?: IntentParams;
  confidence: number;
}

export type ActionType =
  | 'tap'
  | 'swipe'
  | 'longPress'
  | 'input'
  | 'keyEvent'
  | 'sequence';

export interface IntentParams {
  direction?: 'up' | 'down' | 'left' | 'right';
  text?: string;
  key?: 'HOME' | 'BACK' | 'MENU' | 'POWER' | 'APP_SWITCH';
  duration?: number;
  steps?: IntentResult[];
}

// === 视觉分析 ===
export interface VisualResult {
  elements: VisualElement[];
  rawDescription: string;
}

export interface VisualElement {
  label: string;
  bounds: Bounds;
  center: Point;
  confidence: number;
  text?: string;
  type?: string;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// === 坐标映射 ===
export interface CalibratedCoord {
  action: string;
  points: Point[];
  params: Record<string, any>;
}

// === 脚本引擎结果 ===
export interface ScriptEngineResult {
  success: boolean;
  totalSteps: number;
  completedSteps: number;
  duration: number;
  error?: string;
  stepResults: Array<{
    index: number;
    success: boolean;
    error?: string;
    duration: number;
  }>;
}

// === 错误 ===
export interface AgentError {
  code: ErrorCode;
  message: string;
  nodeId?: string;
  retryable: boolean;
}

export type ErrorCode =
  | 'DEVICE_NOT_FOUND'
  | 'SCREENSHOT_FAILED'
  | 'LLM_CALL_FAILED'
  | 'VLM_CALL_FAILED'
  | 'COORDINATE_INVALID'
  | 'STEP_CONVERSION_FAILED'
  | 'ENGINE_EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

// === 历史记录 ===
export interface HistoryEntry {
  timestamp: number;
  userInput: string;
  intent: IntentResult;
  screenshotPath: string | null;
  result: ScriptEngineResult | null;
  error: AgentError | null;
}

// === IPC 消息类型 ===
export type AiAgentIpcEvent =
  | { type: 'ai-agent:submit'; payload: { input: string } }
  | { type: 'ai-agent:status'; payload: { status: WorkflowStatus; node: string; message: string } }
  | { type: 'ai-agent:result'; payload: ScriptEngineResult }
  | { type: 'ai-agent:error'; payload: AgentError }
  | { type: 'ai-agent:history'; payload: HistoryEntry[] };

export type WorkflowStatus = 'running' | 'completed' | 'failed';
```

---

## 8. IPC 通道设计

### 8.1 通道常量

```typescript
// aiAgentChannels.ts
export const AI_AGENT_CHANNELS = {
  // 渲染进程 → 主进程
  SUBMIT: 'ai-agent:submit',              // 提交自然语言指令
  CANCEL: 'ai-agent:cancel',              // 取消当前工作流
  GET_HISTORY: 'ai-agent:get-history',    // 获取历史记录

  // 主进程 → 渲染进程
  STATUS: 'ai-agent:status',              // 工作流状态推送
  RESULT: 'ai-agent:result',              // 执行结果推送
  ERROR: 'ai-agent:error',                // 错误推送
  HISTORY: 'ai-agent:history',            // 历史记录推送
} as const;
```

### 8.2 IPC 流程时序

```
渲染进程 (React)                    主进程 (Node.js)
     │                                  │
     │── ai-agent:submit ──────────────→│  用户输入指令
     │                                  │
     │                                  ├── LangGraph 工作流启动
     │                                  │
     │←── ai-agent:status ─────────────│  "正在理解指令..."
     │                                  │
     │                                  ├── intent-parser 节点
     │                                  │
     │  (如需视觉分析)                   │
     │←── ai-agent:status ─────────────│  "正在截取屏幕..."
     │                                  │
     │                                  ├── screenshot 节点
     │                                  │
     │←── ai-agent:status ─────────────│  "正在分析屏幕内容..."
     │                                  │
     │                                  ├── visual-analysis 节点
     │                                  │
     │←── ai-agent:status ─────────────│  "正在校准坐标..."
     │                                  │
     │                                  ├── coordinate-mapper 节点
     │                                  │
     │←── ai-agent:status ─────────────│  "正在转换为执行步骤..."
     │                                  │
     │                                  ├── step-converter 节点
     │                                  │
     │←── ai-agent:status ─────────────│  "正在执行..."
     │                                  │
     │                                  ├── script-engine-executor
     │                                  │   └── ScriptEngine.runSteps()
     │                                  │       ├── StepExecutor.execute() x N
     │                                  │       └── IPC 进度推送
     │                                  │
     │←── ai-agent:result ─────────────│  返回脚本引擎执行结果
```

---

## 9. 渲染进程设计

### 9.1 AI 智能操控面板（AiAgentPanel.tsx）

**组件结构**：

```
AiAgentPanel
├── 输入区域
│   ├── 文本输入框（支持 placeholder："输入指令，如：点击微信"）
│   ├── 发送按钮
│   └── 快捷指令下拉（预设常用指令）
│
├── 状态展示区
│   ├── 工作流状态指示器（运行中/已完成/失败）
│   ├── 当前节点名称和描述
│   └── 进度动画
│
├── 结果展示区
│   ├── 执行结果（成功/失败标记）
│   ├── 执行步骤摘要（总步骤数、完成数、耗时）
│   └── 执行详情（每步结果展开）
│
└── 历史记录区
    ├── 历史指令列表（时间倒序）
    ├── 每条记录的指令/结果/步骤摘要
    └── 清空历史按钮
```

### 9.2 AI Agent 状态管理（aiAgentStore.ts）

```typescript
interface AiAgentState {
  // 当前工作流状态
  workflowStatus: WorkflowStatus;
  currentNode: string;
  statusMessage: string;

  // 执行结果
  lastResult: ScriptEngineResult | null;
  lastError: AgentError | null;

  // 历史记录
  history: HistoryEntry[];

  // Actions
  submit: (input: string) => void;
  cancel: () => void;
  clearHistory: () => void;
}
```

---

## 10. 配置设计（config.ts）

```typescript
export interface AiAgentConfig {
  // DeepSeek API 配置
  deepseek: {
    apiKey: string;                // DeepSeek API Key
    baseUrl: string;               // API 基础 URL（默认 https://api.deepseek.com）
    chatModel: string;             // LLM 模型名（默认 deepseek-chat）
    visionModel: string;           // VLM 模型名（默认 deepseek-vision）
    temperature: number;           // 温度参数（默认 0.1，意图解析用较低温度）
    maxTokens: number;             // 最大输出 Token（默认 2048）
    timeout: number;               // API 调用超时(ms)（默认 30000）
  };

  // 截图配置
  screenshot: {
    maxWidth: number;              // VLM 输入最大宽度（默认 1024）
    quality: number;               // JPEG 压缩质量（默认 80，0-100）
    cacheSize: number;             // 截图缓存帧数（默认 3）
    tempDir: string;               // 截图临时目录
  };

  // 工作流配置
  workflow: {
    nodeTimeout: number;           // 单个节点超时(ms)（默认 60000）
    maxRetries: number;            // 失败最大重试次数（默认 2）
    retryDelay: number;            // 重试间隔(ms)（默认 1000）
    defaultDuration: number;       // 默认长按/滑动时长(ms)（默认 300）
    longPressDuration: number;     // 长按判定时长(ms)（默认 1500）
  };

}
```

**配置存储方式**：
- API Key 等敏感信息存储在 Electron 的 `safeStorage` 加密存储中
- 非敏感配置存储在 `config.ts` 中，通过 `settings.json` 覆盖

---

## 11. DeepSeek 服务封装

### 11.1 服务设计

```typescript
// services/deepseek-service.ts

export class DeepSeekService {
  private chatModel: ChatDeepSeek;   // LLM 模型实例
  private visionModel: ChatDeepSeek; // VLM 模型实例

  constructor(config: AiAgentConfig) {
    // 初始化 Chat 模型（基于 @langchain/openai，baseURL 指向 DeepSeek）
    this.chatModel = new ChatDeepSeek({
      apiKey: config.deepseek.apiKey,
      model: config.deepseek.chatModel,
      temperature: config.deepseek.temperature,
      maxTokens: config.deepseek.maxTokens,
      timeout: config.deepseek.timeout,
    });

    // 初始化 Vision 模型
    this.visionModel = new ChatDeepSeek({
      apiKey: config.deepseek.apiKey,
      model: config.deepseek.visionModel,
      temperature: 0.1,             // 视觉分析使用更低温度
      maxTokens: config.deepseek.maxTokens,
      timeout: config.deepseek.timeout,
    });
  }

  // 意图理解（纯文本）
  async parseIntent(userInput: string): Promise<IntentResult> { /* ... */ }

  // 视觉分析（多模态：文本 + 图片）
  async analyzeScreenshot(screenshotBase64: string, intent: IntentResult): Promise<VisualResult> { /* ... */ }
}
```

### 11.2 提示词设计

**意图理解提示词**（`prompts/intent-parser.md`）：

```
你是一个手机自动化操作指令解析器。你需要将用户的自然语言指令解析为结构化的动作指令。

可用动作类型：
- tap：点击指定元素
- swipe：滑动屏幕（方向：up/down/left/right）
- longPress：长按指定元素
- input：输入文本
- keyEvent：系统按键（HOME/BACK/MENU/POWER/APP_SWITCH）
- sequence：多步骤复合指令

请以 JSON 格式返回结果，格式如下：
{
  "action": "tap",
  "target": "微信图标",
  "params": {},

  "confidence": 0.95
}

用户指令：{{userInput}}
```

**视觉分析提示词**（`prompts/visual-analysis.md`）：

```
你是一个手机屏幕视觉分析助手。你需要根据用户的描述，在提供的屏幕截图中找到目标元素的位置。

分析要求：
1. 仔细查看屏幕截图中的所有可见元素
2. 根据目标描述找到对应的 UI 元素
3. 返回该元素在图片中的精确坐标（基于图片像素坐标系）
4. 如果找不到目标元素，请在 elements 数组中返回空数组

请以 JSON 格式返回结果，格式如下：
{
  "elements": [
    {
      "label": "微信",
      "bounds": { "x": 100, "y": 1800, "width": 120, "height": 120 },
      "center": { "x": 160, "y": 1860 },
      "confidence": 0.95,
      "text": "微信",
      "type": "icon"
    }
  ],
  "rawDescription": "在屏幕底部 dock 栏找到微信图标..."
}

用户目标：{{targetDescription}}
```

---

## 12. LangGraph StateGraph 实现概要

### 12.1 图定义（graph.ts）

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './types';

// 定义节点函数签名
type NodeFunction = (state: AgentState) => Promise<Partial<AgentState>>;

export function createAiAgentGraph() {
  const workflow = new StateGraph<AgentState>({
    channels: {
      // 定义状态通道...
    },
  });

  // 添加节点
  workflow.addNode('intent_parser', intentParserNode);
  workflow.addNode('screenshot', screenshotNode);
  workflow.addNode('visual_analysis', visualAnalysisNode);
  workflow.addNode('coordinate_mapper', coordinateMapperNode);
  workflow.addNode('step_converter', stepConverterNode);
  workflow.addNode('script_engine_executor', scriptEngineExecutorNode);

  // 定义边
  workflow.addEdge('__start__', 'intent_parser');

  // 意图理解后的条件路由：keyEvent 跳过视觉分析，其他走视觉链路
  workflow.addConditionalEdges('intent_parser', (state) => {
    if (state.intent?.action === 'keyEvent') {
      return 'step_converter';       // 系统按键直接进入步骤转换
    }
    return 'screenshot';             // 需要坐标的走视觉链路
  });

  workflow.addEdge('screenshot', 'visual_analysis');
  workflow.addEdge('visual_analysis', 'coordinate_mapper');
  workflow.addEdge('coordinate_mapper', 'step_converter');
  workflow.addEdge('step_converter', 'script_engine_executor');
  workflow.addEdge('script_engine_executor', END);

  return workflow.compile();
}
```

### 12.2 工作流执行入口

```typescript
// index.ts - IPC Handler
ipcMain.handle(AI_AGENT_CHANNELS.SUBMIT, async (event, payload: { input: string }) => {
  const graph = createAiAgentGraph();
  const deviceInfo = getCurrentDevice(); // 从 screen-mirror 获取

  const initialState: AgentState = {
    userInput: payload.input,
    deviceSerial: deviceInfo.serial,
    deviceResolution: deviceInfo.resolution,
    intent: null,
    screenshotBase64: null,
    screenshotPath: null,
    visualResult: null,
    calibratedCoords: null,
    engineSteps: [],
    result: null,
    error: null,
    history: [],
  };

  try {
    const finalState = await graph.invoke(initialState, {
      callbacks: [{
        handleNodeStart: (nodeId) => {
          event.sender.send(AI_AGENT_CHANNELS.STATUS, {
            status: 'running',
            node: nodeId,
            message: getNodeDescription(nodeId),
          });
        },
      }],
    });

    event.sender.send(AI_AGENT_CHANNELS.RESULT, finalState.result);
  } catch (error) {
    event.sender.send(AI_AGENT_CHANNELS.ERROR, formatError(error));
  }
});
```

---

## 13. 错误处理与边界情况

### 13.1 错误码与处理策略

| **错误码** | **触发场景** | **处理策略** | **是否可重试** |
| :--- | :--- | :--- | :--- |
| `DEVICE_NOT_FOUND` | 设备未连接或 serial 无效 | 返回错误提示用户连接设备 | ❌ |
| `SCREENSHOT_FAILED` | ADB 截图命令失败 | 重试 2 次，仍失败则终止 | ✅ |
| `LLM_CALL_FAILED` | DeepSeek Chat API 调用失败 | 重试 2 次（指数退避），仍失败则终止 | ✅ |
| `VLM_CALL_FAILED` | DeepSeek Vision API 调用失败 | 重试 2 次（指数退避），仍失败则终止 | ✅ |
| `COORDINATE_INVALID` | VLM 未识别到目标元素或坐标越界 | 返回错误提示用户重新描述 | ❌ |
| `STEP_CONVERSION_FAILED` | AI 结果无法映射为有效的 EngineStep | 终止工作流，返回转换错误 | ❌ |
| `ENGINE_EXECUTION_FAILED` | ScriptEngine 执行步骤时出错 | 重试次数由 ScriptEngine 内部配置控制 | ✅ |
| `TIMEOUT` | 任意节点执行超时 | 终止工作流，返回超时错误 | ❌ |

### 13.2 边界情况处理

| **场景** | **处理逻辑** |
| :--- | :--- |
| 多设备连接 | 使用当前投屏面板选中的设备 serial，如无设备则报错 DEVICE_NOT_FOUND |
| 屏幕锁定/黑屏 | VLM 识别到黑屏/锁屏界面时，提示用户解锁手机 |
| VLM 未找到目标元素 | 返回 COORDINATE_INVALID 错误，提示用户更精确描述目标 |
| 用户连续快速提交指令 | 通过 ScriptEngine 的 ExecutionQueue 管理并发，正在执行时新指令排队等待 |
| API Key 未配置 | 首次使用时弹出配置对话框引导用户填写 |
| 网络断开 | API 调用超时后提示检查网络连接 |
| 图片超过 VLM 限制 | sharp 自动缩放至 1024px 内，确保不超 token 限制 |
| 复合指令执行部分失败 | sequence 类型的步骤列表中某步失败时，ScriptEngine 根据重试配置决定是否继续 |

---

## 14. 与现有模块的集成

### 14.1 与屏幕镜像模块的集成

| **集成点** | **方式** | **说明** |
| :--- | :--- | :--- |
| 获取设备 serial | `deviceStore.serial` | 读取当前投屏面板连接的设备标识，传入 ScriptEngine |
| 获取设备分辨率 | `deviceStore.resolution` | 用于坐标映射校准 |
| 截图 | 独立执行 `adb exec-out screencap -p` | 与 scrcpy 视频流解耦，由 screenshot 节点独立完成 |

### 14.2 与脚本引擎的深度集成

| **集成点** | **方式** | **说明** |
| :--- | :--- | :--- |
| **步骤执行** | 调用 `ScriptEngine.runSteps(steps, serial)` — 新增方法 | AI 模块将 EngineStep[] 传给 ScriptEngine 执行 |
| **执行队列复用** | 通过 ScriptEngine 的 ExecutionQueue 管理 | AI 指令与脚本执行共用队列，避免并发冲突 |
| **进度推送复用** | ScriptEngine 的 `engine:stepStart/stepEnd/stepError/complete` | 渲染进程可统一监听脚本和 AI 的执行进度 |
| **重试机制复用** | 使用 ScriptEngine 配置的 `maxRetries` | 统一配置，行为一致 |
| **步骤间延迟** | 使用 EngineStep.delay 或全局 stepInterval | 确保 UI 动效完成后再执行下一步 |

**ScriptEngine 新增方法**：

```typescript
// src/main/script-engine/script-engine.ts 新增
export class ScriptEngine {
  /**
   * 直接执行步骤列表（不经过数据库加载）
   * 由 AI 智能操控模块调用，传入动态生成的 EngineStep[]
   */
  async runSteps(steps: EngineStep[], serial: string): Promise<EngineExecutionResult> {
    const scriptId = `ai-agent-${Date.now()}`
    const { loadConfig } = await import('../config')
    const config = loadConfig()
    const stepInterval = config.stepInterval || 0
    const maxRetries = config.maxRetries || 0
    const scriptTimeout = config.scriptTimeout || 0

    const ctx = createExecutionContext(scriptId, serial, steps, stepInterval)
    const totalSteps = steps.length
    let completedSteps = 0
    const startTime = Date.now()
    const stepResults: StepResult[] = []

    for (let i = 0; i < totalSteps; i++) {
      if (this.shouldStop) { /* ... 停止处理 ... */ }

      ctx.currentIndex = i
      this.sendProgress({ scriptId, stepIndex: i, totalSteps, status: 'start' })

      let result = await this.stepExecutor.execute(steps[i], ctx)
      for (let r = 0; r < maxRetries && !result.success; r++) {
        result = await this.stepExecutor.execute(steps[i], ctx)
      }

      stepResults.push(result)

      if (!result.success) {
        this.sendProgress({ scriptId, stepIndex: i, totalSteps, status: 'error', error: result.error })
        return { success: false, totalSteps, completedSteps, duration: Date.now() - startTime, error: result.error, stepResults }
      }

      completedSteps++
      this.sendProgress({ scriptId, stepIndex: i, totalSteps, status: 'end' })

      if (i < totalSteps - 1) {
        const delay = steps[i].delay ?? stepInterval
        if (delay > 0) await this.sleep(delay * 1000)
      }
    }

    return { success: true, totalSteps, completedSteps, duration: Date.now() - startTime, stepResults }
  }
}
```

### 14.3 与配置模块的集成

| **配置项** | **来源** | **说明** |
| :--- | :--- | :--- |
| DeepSeek API Key | 安全设置页面 → safeStorage 加密存储 | 不硬编码在代码中 |
| ScriptEngine 配置（超时/重试/间隔） | config.ts | AI 模块执行时传递 serial 即可，配置由 ScriptEngine 内部读取 |

---

## 15. 安全性考虑

| **风险点** | **防护措施** |
| :--- | :--- |
| API Key 泄露 | 使用 Electron `safeStorage` 加密存储，不写入日志 |
| 恶意指令注入 | 意图解析节点过滤危险语义，EngineStep 由 ScriptEngine 的 StepExecutor 安全执行，不拼接 shell 命令 |
| 隐私数据（屏幕截图） | 截图仅保存在临时目录，工作流结束后自动清理；不上传至第三方服务器 |
| 误操作风险 | 步骤转换时对包含敏感语义（支付、删除、发送）的指令，经由 ScriptEngine 的单步执行可被用户通过停止按钮中断 |
| API 调用频率控制 | 单设备单次只能执行一个工作流，通过 ExecutionQueue 管理 |

---

## 16. 性能与优化

| **优化方向** | **策略** | **预期效果** |
| :--- | :--- | :--- |
| 截图传输体积 | sharp 缩放 1024px + JPEG 压缩 quality=80 | 原始截图 ~5MB → ~200KB，VLM 调用更快 |
| VLM 调用频率 | 截图缓存 3 帧 + 像素级变化检测 | 连续相同界面不重复调用，节省 API 费用 |
| LLM 意图解析速度 | 使用 `deepseek-chat`（非视觉模型更快速） | 意图解析 < 2s |
| 首次启动加载 | 懒加载 LangGraph 依赖 | 不影响应用启动速度 |
| 并发控制 | 单设备单工作流互斥 | 防止多个 AI 指令冲突执行 |

---

## 17. 附录：实现优先级

| **优先级** | **功能模块** | **说明** |
| :--- | :--- | :--- |
| P0（MVP） | 意图理解 + 截图 + 视觉分析 + 坐标映射 + 步骤转换 + ScriptEngine 执行 | 核心链路跑通，支持基本指令 |
| P1 | LangGraph 有状态图 + 错误重试 + 超时控制 | 工作流健壮性提升，ScriptEngine.runSteps() 方法实现 |
| P2 | 历史记录 + 多轮上下文 | 用户体验优化 |
| P3 | 复合指令（sequence） | 高级功能 |
| P4 | 本地预判断（OCR + 模板匹配降级） | 成本优化 |

---

**文档状态**：待评审
