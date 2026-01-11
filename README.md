# LSS (Log Script Scheduler)

LSS 是一个通过解析以json文件描述的任务流程(task/queue.json),并通过更改应用配置文件,监听应用日志实现自动化的命令行工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 特性

- **双模式调度**：支持单个任务 (`task`) 执行或多个任务组成的队列 (`queue`) 顺序执行。
- **参数注入**：在任务启动前自动将参数文件合并至目标配置文件，并在执行结束后自动从备份中恢复原始配置，确保配置文件的纯净性。
- **日志监听**：内置日志处理器，支持通过文件名匹配、关键字搜索或获取最新文件来实时追踪子进程输出。
- **保障机制**：提供任务超时强制终止逻辑

## 目录结构

```plaintext
src/
├── assets/              # 应用资源,包括默认配置文件
├── BootstrapWrapper/    # 环境检测、临时目录准备及全局配置加载
├── Fronter/             # 命令行入口，负责解析参数与模式分发
├── Runner/              # 核心执行器与日志轮询处理器
├── RunnerWrapper/       # 业务逻辑封装，执行参数备份与状态恢复
├── type/                # 基于 Zod 的强类型校验与定义
└── tsconfig.json        # 针对 CJS 和 pkg 环境优化的编译配置
```

## 快速开始

1.下载[releases](https://github.com/Mn3TR/LSS/releases)已打包好的二进制文件

2.运行任务

执行指令格式如下：

```bash
# 运行单个任务或队列
lss.exe run ./your_config.json
```

## 开发与调试

如果你想对 LSS 进行二次开发或在本地调试代码，可以参考以下说明：

1.安装依赖

```bash
npm install
```

2.启动监听模式

项目配置了监听模式,可以在代码修改后自动编译

```bash
npm run watch-build
```

3.环境说明

* 配置加载: `BootstrapWrapper` 会根据当前运行环境（源码或 `pkg` 二进制）自动定位基础路径。可直接在bundle.js文件同目录放置task/queue.json并使用相对路径,
* 临时文件: 运行时产生的备份文件（`.bak`）存放在 `./temp` 目录。该目录会被自动创建并已加入 `.gitignore`。

5.类型校验 (Zod)

所有输入配置均通过 `Zod` 进行严格校验。如果需要扩展配置项，请修改 `src/type/` 下的 Schema 定义，这能确保在任务运行前捕获格式错误。

## 配置示例

单个任务配置文件 (`task.json`)

```json
{
  "type": "task",
  "name": "testtask",
  "executableFilePath": "node script.js",
  "isNeedParam": true,
  "taskParamConfig": {
    "configFilePath": "settings.json",
    "paramFilePath": "input.json"
  },
  "isNeedLog": true,
  "taskLogConfig": {
    "logFileSearchMethod": "latest",
    "logFileFolderPath": "./logs",
    "successLog": "Process Completed",
    "failedLog": "Fatal Error"
  },
  "timeout": 300
}
```

Queue 配置文件示例 (`queue.json`)

```json
{
  "type": "queue",
  "name": "testqueue",
  "tasks": [
    {
      "type": "task",
      "executableFilePath": "python process_data.py",
      "isNeedParam": true,
      "taskParamConfig": {
        "configFilePath": "config.json",
        "paramFilePath": "input_params.json"
      },
      "isNeedLog": false,
      "timeout": 30
    },
    {
      "type": "task",
      "executableFilePath": "node report_gen.js",
      "isNeedParam": false,
      "isNeedLog": true,
      "taskLogConfig": {
        "logFileSearchMethod": "latest",
        "logFileFolderPath": "./logs",
        "logTimeSectionStart": 0,
        "logTimeSectionEnd": 10,
        "logTimeFormat": "HH:mm:ss",
        "successLog": "Success",
        "failedLog": "Error"
      },
      "timeout": 60
    }
  ]
}
```

最小 Task 配置文件示例 (`minimal_task.json`)
```json
{
  "type": "task",
  "executableFilePath": "node script.js",
  "isNeedParam": false,
  "isNeedLog": false,
}
```

## 技术栈

* **Runtime**: Node.js (Target: Node18+)
* **Language**: TypeScript
* **Data Validation**: [Zod](https://zod.dev/)
* **Utilities**: [Lodash](https://lodash.com/)
* **Tooling**: [Biome](https://biomejs.dev/), [esbuild](https://esbuild.github.io/), [pkg](https://github.com/vercel/pkg)

本项目采用 [MIT License](https://www.google.com/search?q=LICENSE)。
