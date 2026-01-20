import * as fs from "node:fs";
import * as path from "node:path";
import defaultConfig from "./asset/defaultConfig.json";
import BackendLauncher from "./BackendLauncher";
import type { Iconfig } from "./type/config.type";
import { type IQueue, QueueSchema } from "./type/queue.type";
import { TaskSchema } from "./type/task.type";
import init from "./Util/Logger.util";

/**
 * LSS的命令行前端
 */
class Fronter {
    /** Fronter程序所在的目录 */
    public appDir =
        typeof process.pkg !== "undefined"
            ? path.dirname(process.execPath)
            : process.cwd();

    /** 日志记录器基类 */
    public BaseLogger = init(this.appDir);
    /** 自身的日志记录器 */
    private readonly Logger = this.BaseLogger.getSubLogger({
        name: "Fronter",
    });
    /** config */
    public config: Iconfig = defaultConfig;

    /**
     * 应用程序入口方法。
     * 2. 解析命令行参数获取操作模式及文件路径。
     * 3. 校验配置文件存在性。
     * 4. 读取并解析 JSON 配置，传给Backend Server
     * @returns {void}
     */
    async main(): Promise<void> {
        this.Logger.debug("main function");
        this.Logger.debug("read config");
        try {
            this.config = JSON.parse(fs.readFileSync("./config,json", "utf8"));
            this.Logger.debug("parsed config file");
        } catch (_error) {
            this.Logger.warn(
                "couldn't parse or read config file, use defaule config",
            );
        }

        this.Logger.debug("try to start Backend");
        await BackendLauncher.ensureRunning();

        this.Logger.debug("start parsing argv");
        const filePath = this.parse();
        this.Logger.debug(`found task/queue file path:${filePath}`);

        let rawConfig: any;
        try {
            rawConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
            this.Logger.debug("parsed task/queue file");
        } catch (_error) {
            this.Logger.fatal("couldn't parse or read task/queue file");
            process.exit(1);
        }

        if (rawConfig.type === "task") {
            const validated = TaskSchema.parse(rawConfig); // 校验任务

            //TaskPoolManager.init(new task(validated));
        } else if (rawConfig.type === "queue") {
            const validated = QueueSchema.parse(rawConfig); // 校验队列
            //TaskPoolManager.init(new queue(validated));
        }
        const payload = this.preparePayload(rawConfig);
        await fetch(`http://localhost:${this.config.backend_port}/submit`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    /**
     * 解析命令行参数并确定任务执行模式。
     * 该函数根据提供的参数识别指令类型(单任务或队列),并将相对路径解析为绝对路径.
     * @example
     * // 命令行输入: lssf.exe rt "./task.json"
     * // 返回: { type: "task", filePath: "C:/absolute/path/task.json" }
     * @returns {Object} 返回包含模式类型和解析后文件路径的对象
     * @returns {"task" | "queue"} type - 执行模式：'rt' (task) 或 'rq' (queue)
     * @returns {string} filePath - 任务配置文件的绝对路径
     * @throws {Error} 如果参数无法识别，将打印错误日志并调用 `process.exit(0)` 终止进程
     */
    private parse(): string {
        this.Logger.debug("parse fucntion");
        const [, , cmd, file] = process.argv;

        if (process.argv.length === 4 && cmd === "run" && file) {
            return path.resolve(this.appDir, file);
        }

        this.Logger.fatal(`Unknown arg:${cmd}`);
        process.exit(1);
    }

    private preparePayload(rawConfig: any): IQueue {
        if (rawConfig.type === "task") {
            this.Logger.debug("task to queue");
            // 校验单任务合法性
            this.Logger.debug("start validating task file");
            const validatedTask = TaskSchema.parse(rawConfig);
            this.Logger.debug("file validated");

            // 归一化为 Queue 结构
            return {
                type: "queue",
                name: validatedTask.name || "Single_Task_Queue",
                tasks: [validatedTask], // 包装成数组
            };
        }

        if (rawConfig.type === "queue") {
            this.Logger.debug("start validating queue file");
            return QueueSchema.parse(rawConfig);
        }

        this.Logger.fatal("unknown type");
        throw new Error("unknown type");
    }
}

export default new Fronter();
