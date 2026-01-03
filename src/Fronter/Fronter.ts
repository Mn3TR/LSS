import * as fs from "node:fs";
import * as path from "node:path";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import RunnerWrapper from "../RunnerWrapper/RunnerWrapper";
import { QueueSchema, queue } from "../type/queue.type";
import { TaskSchema, task } from "../type/task.type";

//TODO
class LSSHttpServer {}

/**
 * 调度中心类，负责初始化执行环境并分发任务。
 */
class Fronter {
    /** 绑定的 HTTP 服务类 */
    static LSSHttpServer = LSSHttpServer;

    /** 自身的日志记录器 */
    private Logger = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "Fronter",
    });

    /**
     * 应用程序入口方法。
     * 2. 解析命令行参数获取操作模式及文件路径。
     * 3. 校验配置文件存在性。
     * 4. 读取并解析 JSON 配置，根据 `type` 字段初始化对应的运行器 (RunnerWrapper)。
     * @returns {void}
     */
    main(): void {
        this.Logger.debug("main function");
        this.Logger.debug("start parsing argv");
        const filePath = this.parse();
        this.Logger.debug(`found task/queue file path:${filePath}`);

        let rawConfig: any;
        try {
            rawConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
            this.Logger.debug("parsed task/queue file");
        } catch (error) {
            this.Logger.fatal("couldn't parse or read task/queue file");
            process.exit(1);
        }

        if (rawConfig.type === "task") {
            this.Logger.debug("start validating task file");
            const validated = TaskSchema.parse(rawConfig); // 校验任务
            this.Logger.debug("file validated");
            RunnerWrapper.init(new task(validated));
        } else if (rawConfig.type === "queue") {
            this.Logger.debug("start validating queue file");
            const validated = QueueSchema.parse(rawConfig); // 校验队列
            RunnerWrapper.init(new queue(validated));
            this.Logger.debug("file validated");
        }
    }

    /**
     * 解析命令行参数并确定任务执行模式。
     * 该函数根据BootstrapWrapper提供的参数识别指令类型(单任务或队列),并将相对路径解析为绝对路径.
     * @example
     * // 命令行输入: lss.exe rt "./task.json"
     * // 返回: { type: "task", filePath: "C:/absolute/path/task.json" }
     * @returns {Object} 返回包含模式类型和解析后文件路径的对象
     * @returns {"task" | "queue"} type - 执行模式：'rt' (task) 或 'rq' (queue)
     * @returns {string} filePath - 任务配置文件的绝对路径
     * @throws {Error} 如果参数无法识别，将打印错误日志并调用 `process.exit(0)` 终止进程
     */
    private parse(): string {
        this.Logger.debug("parse fucntion");
        const [, , cmd, file] = BootstrapWrapper.argv;

        if (BootstrapWrapper.argc === 4 && cmd === "run" && file) {
            return path.resolve(BootstrapWrapper.env.selfPath, file);
        }

        this.Logger.fatal(`Unknown arg:${cmd}`);
        process.exit(1);
    }
}

new Fronter().main();
