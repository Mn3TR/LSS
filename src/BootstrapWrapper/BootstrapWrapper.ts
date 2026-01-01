import * as fs from "node:fs";
import * as path from "node:path";
import type { appEnv } from "../type/appenv.type";

/**
 * 引导程序包装器，负责预处理执行环境、配置加载及基础目录准备。
 * * 该类作为程序启动的第一站，解决了以下核心问题：
 * 1. 识别并适配可执行文件（pkg）与源代码运行环境。
 * 2. 统一管理命令行参数。
 * 3. 确保必要的缓存目录（./temp）存在。
 * 4. 同步加载全局 `config.json` 配置文件。
 */
class BootstrapWrapper {
    /** 应用程序环境信息，包含运行模式及绝对路径基础 */
    public env: appEnv = { isPkg: false, selfPath: "" };

    /** 全局配置对象，从 config.json 加载 */
    public config: object = {};

    /** 命令行参数的总个数 */
    public argc: number = process.argv.length;

    /** 原始命令行参数数组 */
    public argv: string[] = process.argv;

    /**
     * 初始化执行环境。
     * * * 逻辑流程：
     * 1. **环境检测**：通过 `process.pkg` 判断是否处于打包后的二进制环境中。
     * 2. **路径修正**：如果是 pkg 环境，使用 `execPath` 获取路径，否则使用 `cwd`。
     * 3. **目录准备**：检查并按需创建 `./temp` 临时文件夹。
     * 4. **配置加载**：校验并读取 `config.json`，若文件缺失则直接中断程序。
     * * @returns {void}
     * @throws {Error} 若 `config.json` 解析失败或权限不足，可能抛出异常。
     */
    init(): void {
        // 1. 环境与路径适配
        const isPkg = typeof process.pkg !== "undefined";
        this.env = {
            isPkg,
            selfPath: isPkg ? path.dirname(process.execPath) : process.cwd(),
        };

        // 2. 确保缓存目录存在 (更紧凑的写法)
        if (!fs.existsSync("./temp")) fs.mkdirSync("./temp");

        // 3. 配置加载
        const configPath = path.join(this.env.selfPath, "config.json");
        if (!fs.existsSync(configPath)) {
            console.error("Couldn't find config.json, use default config");
            //todo 应当用更优雅的方式解决config不存在时的问题
            return;
        }

        try {
            this.config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        } catch (_e) {
            console.error("Failed to parse config.json");
            process.exit(1);
        }
    }
}

export default new BootstrapWrapper();
