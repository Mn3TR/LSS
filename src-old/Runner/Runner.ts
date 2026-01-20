import { type ChildProcess, spawn } from "node:child_process";
import type { Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import type { task } from "../type/task.type";
import type _LogHandler from "./RunnerLogHandler";

class Runner {
    /** 实例的日志处理器 */
    private LogHandler: _LogHandler | undefined;
    /** 子进程对象 */
    private child: ChildProcess | null = null;
    /** 超时计时器 */
    private timeoutTimer: NodeJS.Timeout | null = null;
    /** 自身的日志记录器*/
    private Logger: Logger<unknown> = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "Runner",
    });

    constructor(private t: task) {
        //监听主进程信号，防止主程序退出后子进程变成“孤儿”
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        this.Logger.debug("setup signalHandlers");
        const killChild = () => {
            this.Logger.debug(
                "received exit signal, start killing child process",
            );
            if (this.child && !this.child.killed) {
                this.Logger.info(`正在清理子进程 PID: ${this.child.pid}`);
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
        this.Logger.debug(`task log source:${useStdout}`);

        return new Promise((resolve) => {
            // 启动子进程
            this.Logger.debug("start child process");
            this.child = spawn(this.t.config.executableFilePath, {
                shell: true,
                detached: false, // 确保子进程不脱离会话
                stdio: useStdout ? ["inherit", "pipe", "pipe"] : "inherit",
            });

            //启动日志
            if (this.LogHandler) {
                this.Logger.debug("create logHandler");

                if (useStdout && this.child.stdout) {
                    this.Logger.debug(
                        "task log use stdout, start logHandler by stdout",
                    );
                    this.LogHandler.start(
                        this.LogHandler.defaultHandler,
                        this.child.stdout,
                    );
                } else {
                    this.Logger.debug(
                        "task log use file, start logHandler by file",
                    );
                    this.LogHandler.start(this.LogHandler.defaultHandler);
                }
            }

            const pid = this.child.pid;
            this.Logger.info(
                `任务启动 [PID: ${pid}] [路径: ${this.t.config.executableFilePath}]`,
            );

            // 超时控制逻辑
            if (this.t.config.timeout && this.t.config.timeout > 0) {
                this.Logger.debug(
                    `任务开启了超时控制,其将会在运行${this.t.config.timeout}s后被强制终止`,
                );
                this.timeoutTimer = setTimeout(() => {
                    if (this.child && !this.child.killed) {
                        this.Logger.error(
                            `任务${this.t.config.name}运行超时 (${this.t.config.timeout}s)，强制终止, PID: ${pid}`,
                        );
                        this.child.kill("SIGKILL"); // 超时强制杀掉
                    }
                }, this.t.config.timeout * 1000);
            }

            this.child.on("close", (code) => {
                this.cleanup();
                this.Logger.info(`进程退出，退出码: ${code}`);
                resolve(code);
            });

            this.child.on("error", (err) => {
                this.cleanup();
                this.Logger.error(`进程错误: ${err.message}`);
                resolve(null);
            });
        });
    }

    /**
     * 清理资源：停止日志监听、清除超时计时器
     */
    private cleanup() {
        this.Logger.debug("Runner cleanup");
        this.Logger.debug("stop LogHandler");
        if (this.LogHandler) this.LogHandler.stop();
        if (this.timeoutTimer) {
            this.Logger.debug("clear timeoutTimer");
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }
}

export default Runner;
