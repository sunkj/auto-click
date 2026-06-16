# AutoClick - 手机投屏与控制软件

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Electron](https://img.shields.io/badge/Electron-31-green)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6)

AutoClick 是一款基于 Electron 的跨平台 Android 设备投屏与控制软件。支持 USB 连接手机后实时投屏、键鼠模拟交互、脚本录制与自动化执行。

---

## 功能特性

### ✅ 已实现

| 类别 | 功能 |
| :--- | :--- |
| **设备连接** | USB 自动发现设备、连接/断开、型号/分辨率/连接方式显示 |
| **画面投屏** | scrcpy 实时视频流解码渲染、画布等比缩放自适应、窗口最小化投屏模式 |
| **交互控制** | 单击模拟手指点击、拖动模拟滑动、返回键/Home 键 |
| **脚本管理** | 脚本/文件夹创建、编辑、删除、树形展开、导入/导出 `.js` 文件 |
| **步骤编辑** | 4 种步骤类型（点击/输入/滑动/长按）、步骤名称自定义、增删改查 |
| **脚本执行** | 全量执行、单步执行、步骤高亮、超时控制、失败重试、手动中断 |
| **系统配置** | 脚本超时时间、步骤执行间隔、最大重试次数配置 |
| **深色主题** | 默认启用深色模式 |

### 🚧 待实现

- 中文输入支持
- 操作录制自动生成脚本
- 定时任务（Cron 表达式）
- Webhook 通知（飞书/钉钉/微信）
- 多设备同时连接
- Windows 平台打包

---

## 技术栈

| 层级 | 技术 | 版本 |
| :--- | :--- | :--- |
| 桌面容器 | Electron | ^31.1.0 |
| UI 框架 | React | ^18.3.1 |
| 类型系统 | TypeScript | ^5.5.2 |
| UI 组件库 | shadcn/ui (Radix UI + TailwindCSS) | — |
| 样式方案 | TailwindCSS | ^3.4.4 |
| 状态管理 | Zustand | ^4.5.4 |
| 构建工具 | Vite | ^5.3.2 |
| 数据库 | SQLite (TypeORM + better-sqlite3) | — |
| 投屏解码 | @yume-chan/scrcpy-decoder-tinyh264 | ^2.1.0 |
| 图标库 | lucide-react | ^0.400.0 |
| 打包工具 | electron-builder | ^24.13.3 |

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **Android 设备**（USB 调试已开启）
- **ADB**（Android Debug Bridge，需在系统 PATH 中）

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd AutoClick

# 安装依赖
npm install

# 重新编译原生模块
npm run postinstall
```

### 开发

```bash
# 同时启动渲染进程（Vite HMR）和主进程
npm run dev
```

启动后会自动打开 Electron 窗口，连接 Android 设备后即可使用。

### 构建与打包

```bash
# 构建生产版本
npm run build

# 打包为 macOS DMG
npm run package
```

---

## 项目结构

```
AutoClick/
├── src/
│   ├── main/                       # 主进程（Node.js）
│   │   ├── index.ts                # 入口：窗口创建 + IPC 注册
│   │   ├── config.ts               # 配置管理
│   │   ├── script/                 # 脚本管理模块
│   │   │   ├── services/           #   业务逻辑层（ScriptService）
│   │   │   ├── entities/           #   数据实体（TypeORM）
│   │   │   ├── repositories/       #   仓储层
│   │   │   └── ipc/                #   IPC 处理器
│   │   ├── script-engine/          # 脚本执行引擎
│   │   │   ├── script-engine.ts    #   核心引擎
│   │   │   ├── step-executor.ts    #   步骤执行器
│   │   │   ├── adb-executor.ts     #   ADB 命令执行器
│   │   │   └── execution-queue.ts  #   执行队列
│   │   └── screen-mirror/          # 投屏管理
│   │       ├── adb.ts              #   ADB 命令行封装
│   │       ├── control.ts          #   触控/按键控制
│   │       ├── bridge-manager.ts   #   桥接子进程管理
│   │       └── bridge.mjs          #   scrcpy 视频流子进程
│   ├── preload/
│   │   └── index.ts                # 预加载脚本（contextBridge）
│   ├── renderer/                   # 渲染进程（React）
│   │   └── src/
│   │       ├── App.tsx             # 应用根组件
│   │       ├── components/         # UI 组件
│   │       │   ├── ScriptPanel.tsx  #   脚本管理面板
│   │       │   ├── StepPanel.tsx    #   步骤列表面板
│   │       │   ├── MirrorPanel.tsx  #   投屏面板
│   │       │   ├── ScreenCanvas.tsx #   投屏画布（TinyH264）
│   │       │   └── ...             #   弹窗组件
│   │       ├── stores/             # Zustand 状态管理
│   │       │   ├── scriptStore.ts
│   │       │   └── deviceStore.ts
│   │       └── globals.css         # 全局样式 + 主题变量
│   └── types/
├── docs/                           # 项目文档
│   ├── 需求.md                     #   产品需求文档
│   ├── 架构.md                     #   系统架构设计
│   ├── 界面.md                     #   UI 设计文档
│   ├── 开发计划.md                 #   开发迭代计划
│   └── 详细设计/                   #   详细设计文档
├── resources/                      # 应用图标等静态资源
├── release/                        # 打包输出
└── package.json
```

---

## 使用指南

### 连接设备

1. 通过 USB 连接 Android 设备
2. 确保已开启 **USB 调试**（开发者选项中）
3. 点击 AutoClick 中的 **"连接"** 按钮
4. 连接成功后自动显示投屏画面

### 管理脚本

1. 点击 **"+ 新建脚本/目录"** 创建脚本或文件夹
2. 在脚本中添加步骤（点击、输入、滑动、长按）
3. 选中步骤后可编辑或删除
4. 支持导入/导出 `.js` 格式的脚本文件

### 执行脚本

1. 选中脚本后点击 **▶ 运行** 按钮全量执行
2. 或选中单个步骤点击运行单独执行
3. 执行过程中当前步骤 **黄色高亮** 显示
4. 可随时点击 **⬜ 停止** 中断执行

---

## 开发日志

各迭代开发详情记录在 [docs/开发日志/](docs/开发日志/) 目录中。

| 日志 | 内容 |
| :--- | :--- |
| [开发日志1](docs/开发日志/开发日志1.md) | 需求讨论、架构设计、Iteration 1-2 |
| [开发日志2](docs/开发日志/开发日志2.md) | UI 实现、Figma 对接 |
| [开发日志3-4](docs/开发日志/开发日志3.md) | 脚本管理 Service 层设计与实现 |
| [开发日志5](docs/开发日志/开发日志5.md) | 投屏管理实现 |
| [开发日志6](docs/开发日志/开发日志6.md) | 脚本执行引擎实现 |
| [开发日志7](docs/开发日志/开发日志7.md) | Settings 实现、UI 调整 |

---

## 许可

[MIT](LICENSE)
