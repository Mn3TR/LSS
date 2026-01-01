import { type ChildProcess, spawn } from "node:child_process";
import type { task } from "../type/task.type";
import type _LogHandler from "./RunnerLogHandler";

class Runner {
    private LogHandler: _LogHandler | undefined;
    private child: ChildProcess | null = null;
    private timeoutTimer: NodeJS.Timeout | null = null;

    constructor(private t: task) {
        // 关键：监听主进程信号，防止主程序退出后子进程变成“孤儿”
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        const killChild = () => {
            if (this.child && !this.child.killed) {
                console.log(
                    `[Runner] 正在清理子进程 (PID: ${this.child.pid})...`,
                );
                this.child.kill("SIGTERM"); // 优雅退出
            }
        };

        // 监听常见的退出信号
        process.on("SIGINT", killChild); // Ctrl+C
        process.on("SIGTERM", killChild); // 终止信号
        process.on("exit", killChild); // 主进程正常或异常结束
    }

    async run(): Promise<number | null> {
        const useStdout = this.t.config.taskLogConfig?.logSource === "stdout";

        return new Promise((resolve) => {
            // 启动子进程
            this.child = spawn(this.t.config.executableFilePath, {
                shell: true,
                detached: false, // 确保子进程不脱离会话
                stdio: useStdout ? ["inherit", "pipe", "pipe"] : "inherit",
            });

            //启动日志
            if (this.LogHandler) {
                this.LogHandler.start(this.LogHandler.defaultHandler);
                if (useStdout && this.child.stdout) {
                    this.LogHandler.start(
                        this.LogHandler.defaultHandler,
                        this.child.stdout,
                    );
                }
            }

            const pid = this.child.pid;
            console.log(
                `[Runner] 任务启动 [PID: ${pid}] [路径: ${this.t.config.executableFilePath}]`,
            );

            // 超时控制逻辑
            if (this.t.config.timeout && this.t.config.timeout > 0) {
                this.timeoutTimer = setTimeout(() => {
                    if (this.child && !this.child.killed) {
                        console.error(
                            `[Runner] 任务运行超时 (${this.t.config.timeout}s)，强制终止 PID: ${pid}`,
                        );
                        this.child.kill("SIGKILL"); // 超时强制杀掉
                    }
                }, this.t.config.timeout * 1000);
            }

            this.child.on("close", (code) => {
                this.cleanup();
                console.log(`[Runner] 进程退出，退出码: ${code}`);
                resolve(code);
            });

            this.child.on("error", (err) => {
                this.cleanup();
                console.error(`[Runner] 进程错误: ${err.message}`);
                resolve(null);
            });
        });
    }

    /**
     * 清理资源：停止日志监听、清除超时计时器
     */
    private cleanup() {
        if (this.LogHandler) this.LogHandler.stop();
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }
}

export default Runner;
