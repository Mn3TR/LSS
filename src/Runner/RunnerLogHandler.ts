import * as fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import watch, { type Watcher } from "node-watch";
import type { Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import type { ITaskLogConfig } from "../type/task.type";

/**
 * 任务日志处理器，负责定位日志文件并实时追踪新增内容。
 */
class TaskLogHandler {
    /** 日志来源 */
    private logSource: "file" | "stdout";
    /** 日志路径, 使用stdout时为undefined */
    private logFilePath: string | undefined;
    /** 上次读取文件的位置 */
    private lastSize = 0;
    /** 存储上次轮询读取到的、不完整的行末尾数据 */
    private tailBuffer: Buffer = Buffer.alloc(0);
    /** 防止异步重入锁 */
    private isProcessing = false;
    /** watcher实例 */
    private watcher?: Watcher;
    /** 自身的日志记录器*/
    private Logger: Logger<unknown> = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "Runner",
    });

    constructor(config: ITaskLogConfig) {
        this.Logger.debug("LogHandler created");
        this.logSource = config.logSource;
        this.Logger.debug(`task logSource:${this.logSource}`);
        if (this.logSource === "file") {
            this.Logger.debug("task use file log, start finding");
            let foundPath: string | null = null;

            switch (config.logFileSearchMethod) {
                case "field":
                    foundPath = this.findFile(
                        config.logFileFolderPath,
                        "field",
                        config.logFilenameField,
                    );
                    break;
                case "filename":
                    foundPath = this.findFile(
                        config.logFileFolderPath,
                        "filename",
                        config.logFileName,
                    );
                    break;
                case "latest":
                    foundPath = this.findFile(
                        config.logFileFolderPath,
                        "latest",
                    );
                    break;
            }

            if (foundPath !== null) {
                this.logFilePath = foundPath;
                this.Logger.debug(`find log file in:${this.logFilePath}`);
            } else {
                this.Logger.fatal(
                    `无法通过方法 "${config.logFileSearchMethod}" 找到文件`,
                );
                throw new Error(
                    `无法通过方法 "${config.logFileSearchMethod}" 找到文件`,
                );
            }
        }
    }

    /**
     * 启动日志监听流程。
     */
    public async start(
        callback: (line: string) => void,
        stream?: Readable,
    ): Promise<void> {
        this.Logger.debug("start listening log");
        if (this.logSource === "file" && this.logFilePath) {
            try {
                this.Logger.debug("init lastSize, skip history");
                // 初始化偏移量，跳过历史数据
                this.lastSize = fs.statSync(this.logFilePath).size;
            } catch {
                this.lastSize = 0;
            }
            //启动监听
            this.Logger.debug(`start listening log in:${this.logFilePath}`);
            this.watcher = watch(this.logFilePath, (evt, _name) => {
                if (evt === "update") {
                    this.Logger.debug("log file updated");
                    this.pollFile(callback);
                }
            });
        }

        if (this.logSource === "stdout" && stream) {
            this.Logger.debug("start listening log by stream");
            stream.on("data", (chunk: Buffer) => {
                this.Logger.debug("log stream updated");
                this.processNewBuffer(callback, chunk);
            });
        }
    }

    /**
     * 文件改动
     */
    private async pollFile(callback: (line: string) => void) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        if (this.logFilePath) {
            try {
                this.Logger.debug("get log file currentSize");
                const { size: currentSize } = fs.statSync(this.logFilePath);

                // 处理日志翻转（如文件被清空或重建）
                if (currentSize < this.lastSize) {
                    this.lastSize = 0;
                    this.tailBuffer = Buffer.alloc(0);
                }

                if (currentSize > this.lastSize) {
                    const readLen = currentSize - this.lastSize;
                    const buffer = Buffer.alloc(readLen);

                    // 读取增量内容
                    this.Logger.debug("read new log contects");
                    const fd = fs.openSync(this.logFilePath, "r");
                    try {
                        fs.readSync(fd, buffer, 0, readLen, this.lastSize);
                        this.processNewBuffer(callback, buffer);
                    } finally {
                        fs.closeSync(fd);
                    }
                }
            } catch (error) {
                this.Logger.error(`读取日志错误:${error}`);
            } finally {
                this.isProcessing = false;
            }
        }
    }

    public stop(): void {
        this.Logger.debug("LogHandler stop");
        this.watcher?.close();
    }

    public defaultHandler(line: string) {
        //console.log(line);
    }

    /**
     * 内部文件搜索算法（保持不变）
     */
    private findFile(
        dir: string,
        mode: "filename" | "latest" | "field",
        query?: string,
    ): string | null {
        try {
            this.Logger.debug(`use method:${mode} to find log file`);
            const files = fs.readdirSync(dir);
            if (!files.length) return null;

            let targetFile: string | undefined;
            switch (mode) {
                case "filename":
                    targetFile = files.find((f) => f === query);
                    break;
                case "field":
                    targetFile = files.find((f) => {
                        const nameWithoutExt = path.parse(f).name;
                        return query ? nameWithoutExt.includes(query) : false;
                    });
                    break;
                case "latest":
                    targetFile = files
                        .map((f) => ({
                            name: f,
                            time:
                                fs.statSync(path.join(dir, f), {
                                    throwIfNoEntry: false,
                                })?.mtimeMs || 0,
                        }))
                        .sort((a, b) => b.time - a.time)[0]?.name;
                    break;
            }
            return targetFile ? path.join(dir, targetFile) : null;
        } catch (error) {
            console.error("文件搜索失败:", error);
            return null;
        }
    }

    /**
     * 处理新增buffer内容
     */
    private processNewBuffer(callback: (ling: string) => void, buffer: Buffer) {
        this.Logger.debug("process new buffer");
        // 将上次遗留的“半行”与本次读取内容合并
        const combinedBuffer = Buffer.concat([this.tailBuffer, buffer]);
        let offset = 0;

        // 查找换行符 (0x0A 为 \n)
        this.Logger.debug("find line breaks");
        while (true) {
            const nlIndex = combinedBuffer.indexOf(0x0a, offset);

            if (nlIndex === -1) {
                // 没找到换行符，剩下的部分存入 tailBuffer 等待下次轮询
                this.Logger.debug("couldn't find line breaks");
                this.tailBuffer = combinedBuffer.slice(offset);
                break;
            }

            // 提取完整行，并处理 \r\n (Windows 兼容)
            this.Logger.debug("found line breaks");
            const line = combinedBuffer
                .toString("utf8", offset, nlIndex)
                .replace(/\r$/, "");

            if (line.trim()) {
                this.Logger.debug("call handler");
                callback(line);
            }

            offset = nlIndex + 1;
        }
        if (this.logSource === "file" && this.logFilePath) {
            this.Logger.debug("update lastSize");
            const { size: currentSize } = fs.statSync(this.logFilePath);
            this.lastSize = currentSize;
        }
    }
}

export default TaskLogHandler;
