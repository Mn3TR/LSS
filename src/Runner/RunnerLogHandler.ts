import * as fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import watch, { type Watcher } from "node-watch";
import type { ITaskLogConfig } from "../type/task.type";

/**
 * 任务日志处理器，负责定位日志文件并实时追踪新增内容。
 */
class TaskLogHandler {
    private logSource: "file" | "stdout";
    private logFilePath: string;
    private lastSize = 0;
    /** 存储上次轮询读取到的、不完整的行末尾数据 */
    private tailBuffer: Buffer = Buffer.alloc(0);
    /** 防止异步重入锁 */
    private isProcessing = false;
    //watcher实例
    private watcher?: Watcher;

    constructor(config: ITaskLogConfig) {
        this.logSource = config.logSource;
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
                foundPath = this.findFile(config.logFileFolderPath, "latest");
                break;
        }

        if (foundPath !== null) {
            this.logFilePath = foundPath;
        } else {
            console.error(
                `无法通过方法 "${config.logFileSearchMethod}" 找到文件。`,
            );
            process.exit(1);
        }
    }

    /**
     * 启动日志监听流程。
     */
    public async start(
        callback: (line: string) => void,
        stream?: Readable,
    ): Promise<void> {
        try {
            // 初始化偏移量，跳过历史数据
            this.lastSize = fs.statSync(this.logFilePath).size;
        } catch {
            this.lastSize = 0;
        }

        if (this.logSource === "file") {
            //启动监听
            this.watcher = watch(this.logFilePath, (evt, _name) => {
                if (evt === "update") {
                    this.pollFile(callback);
                }
            });
        }

        if (this.logSource === "stdout" && stream) {
            stream.on("data", (chunk: Buffer) => {
                this.processNewBuffer(callback, chunk);
            });
            stream.on("data", (chunk: Buffer) => {
                const errorLine = chunk.toString().trim();
                if (errorLine) console.error(`[Stderr] ${errorLine}`);
            });
        }
    }

    /**
     * 轮询核心逻辑
     */
    private async pollFile(callback: (line: string) => void) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (!fs.existsSync(this.logFilePath)) return;

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
                const fd = fs.openSync(this.logFilePath, "r");
                try {
                    fs.readSync(fd, buffer, 0, readLen, this.lastSize);
                    this.processNewBuffer(callback, buffer);
                } finally {
                    fs.closeSync(fd);
                }
            }
        } catch (err) {
            console.error("Read log error:", err);
        } finally {
            this.isProcessing = false;
        }
    }

    public stop(): void {
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
        // 将上次遗留的“半行”与本次读取内容合并
        const combinedBuffer = Buffer.concat([this.tailBuffer, buffer]);
        let offset = 0;

        // 查找换行符 (0x0A 为 \n)
        while (true) {
            const nlIndex = combinedBuffer.indexOf(0x0a, offset);

            if (nlIndex === -1) {
                // 没找到换行符，剩下的部分存入 tailBuffer 等待下次轮询
                this.tailBuffer = combinedBuffer.slice(offset);
                break;
            }

            // 提取完整行，并处理 \r\n (Windows 兼容)
            const line = combinedBuffer
                .toString("utf8", offset, nlIndex)
                .replace(/\r$/, "");

            if (line.trim()) {
                callback(line);
            }

            offset = nlIndex + 1;
        }
        const { size: currentSize } = fs.statSync(this.logFilePath);
        this.lastSize = currentSize;
    }
}

export default TaskLogHandler;
