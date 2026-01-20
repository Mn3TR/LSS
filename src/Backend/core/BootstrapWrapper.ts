import * as fs from "node:fs";
import * as path from "node:path";
import type { Logger } from "tslog";
import defaultConfig from "../assets/defaultConfig.json";
import type { appEnv } from "../type/appenv.type";
import { configSchema, type Iconfig } from "../type/config.type";
import loggerInit from "../Util/Logger.util";

/**
 * 引导程序包装器，负责预处理执行环境、配置加载及基础目录准备。
 * 1. 识别并适配可执行文件（pkg）与源代码运行环境。
 * 2. 统一管理命令行参数。
 * 3. 确保必要的缓存目录（./temp）存在。
 * 4. 同步加载全局 `config.json` 配置文件。
 */
class BootstrapWrapper {
    /** 应用程序环境信息，包含运行模式及绝对路径基础 */
    public readonly env: appEnv;

    /** 全局配置对象，从 config.json 加载 */
    public readonly config: Iconfig;

    /** 命令行参数的总个数 */
    public readonly argc: number = process.argv.length;

    /** 原始命令行参数数组 */
    public readonly argv: string[] = process.argv;

    /** 日志记录器基类 */
    public readonly BaseLogger: Logger<unknown>;

    /** 自身的日志记录器 */
    private readonly Logger: Logger<unknown>;

    /**
     * 初始化执行环境。
     * 1. 环境检测：通过process.pkg判断是否处于打包后的二进制环境中。
     * 2. 路径修正：如果是 pkg 环境，使用execPath获取路径，否则使用cwd。
     * 3. 目录准备：检查并按需创建./temp临时文件夹。
     * 4. 配置加载：校验并读取config.json
     */
    constructor() {
        //检查运行环境,并获取工作路径
        this.env = {
            isPkg: typeof process.pkg !== "undefined",
            appDir:
                typeof process.pkg !== "undefined"
                    ? path.dirname(process.execPath)
                    : process.cwd(),
            cwd: process.cwd(),
        };

        //配置加载,配置不存在则使用默认配置
        const configPath = path.join(this.env.appDir, "config.json");
        if (!fs.existsSync(configPath)) {
            console.warn("couldn't find config.json, use default config");
            //配置文件不存在,使用默认配置后退出
            this.config = defaultConfig;
        }

        try {
            this.config = configSchema.parse(
                JSON.parse(fs.readFileSync(configPath, "utf8")),
            );
        } catch (_e) {
            console.error("failed to parse config.json, use default config");
            this.config = defaultConfig;
        }

        //初始化日志记录器
        this.BaseLogger = loggerInit(this.env.appDir);
        this.Logger = this.BaseLogger.getSubLogger({
            name: "BootstrapWrapper",
            //TODO 暂时用defaultconfig的level
            minLevel: this.config.loglevel,
        });
        this.Logger.debug("BaseLogger init");

        this.Logger.debug(`check environment, get cwd:${this.env.appDir}`);

        //确保缓存目录存在
        const tempDir = path.join(this.env.appDir, "temp");
        if (!fs.existsSync(tempDir)) {
            this.Logger.debug("didn't find temp dictionary, create it");
            try {
                fs.mkdirSync(tempDir);
            } catch (error) {
                this.Logger.fatal("cloudn't create temp dictionary");
                this.Logger.fatal(error);
                process.exit(1);
            }
        }

        //调用Fronter
        this.Logger.debug("Bootstrap done, call Fronter.main()");
    }
}

export default new BootstrapWrapper();
