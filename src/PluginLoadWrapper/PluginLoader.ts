import * as fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import { PluginSchema } from "../type/plugin.type";

const pluginTypes = [
    "taskBeforeRun",
    "taskAfterRun",
    "logHandler",
    "queueBeforeRun",
    "queueAfterRun",
];

/**
 * 插件加载器
 */
class PluginLoader {
    private Logger: Logger<unknown> = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "PluginLoader",
    });
    /**
     * 根据配置文件加载插件
     * @param filePath 任务或队列配置文件的路径 (如: C:/data/task.json)
     */
    public async loadPlugin(
        filePath: string,
    ): Promise<Record<string, Function>> {
        this.Logger.debug("load Plugin");
        this.Logger.debug("init pluginTable");
        const pluginTable: Record<string, Function> = {};
        const require = createRequire(process.cwd() + "/index.js");

        // 1. 获取基础路径信息
        this.Logger.debug("get pluginConfigPath");
        const baseDir = path.dirname(filePath);
        const pluginConfigPath = path.join(baseDir, "plugin.json");

        // 2. 检查配置文件是否存在
        if (!fs.existsSync(pluginConfigPath)) {
            this.Logger.error(
                `task/queue: ${filePath} need plugin, but couldn't find plugin.json in ${pluginConfigPath}. return empty pluginTable`,
            );
            return pluginTable;
        }
        this.Logger.debug(`found pluginConfig in ${pluginConfigPath}`);

        // 3. 读取并解析配置
        let pluginConfig: Record<string, string>;
        try {
            pluginConfig = JSON.parse(
                fs.readFileSync(pluginConfigPath, "utf-8"),
            );
        } catch (error) {
            this.Logger.error(
                "couldn't read or parse pluginConfig.  return empty pluginTable",
            );
            return pluginTable;
        }

        // 4. 遍历键值对进行加载
        // key: 钩子类型 (如 "taskBeforeRun")
        // value: 插件文件路径 (如 "./my-plugin.js")
        for (const [hookType, relativePath] of Object.entries(pluginConfig)) {
            try {
                // 解析插件的绝对路径
                const fullPath = path.resolve(baseDir, relativePath);
                this.Logger.debug(`get pluginPath:${fullPath}`);

                // 动态导入模块
                let rawPlugin: unknown;
                try {
                    this.Logger.debug("try to import plugin");
                    rawPlugin = require(fullPath);
                } catch (error: any) {
                    this.Logger.error(
                        `failed to import plugin:${fullPath}, baseDir:${baseDir}, relativePath:${relativePath}`,
                    );
                }

                // 使用 Zod 进行结构校验
                const validated = PluginSchema.parse(rawPlugin);

                //确保配置文件的 key 与插件内部定义的 type 严格对齐
                if (validated.type !== hookType) {
                    this.Logger.error(
                        `类型冲突: plugin.json 配置为 "${hookType}", 但脚本 "${relativePath}" 内部定义为 "${validated.type}"`,
                    );
                    throw new Error();
                }

                // 提取函数并存入表格
                // 使用 (validated as any) 解决 TypeScript 在辨别联合类型上的索引访问限制
                const targetHook = validated[validated.type];

                if (typeof targetHook === "function") {
                    pluginTable[hookType] = targetHook;
                } else {
                    throw new Error(
                        `插件 "${validated.name}" 缺少对应的执行函数: ${validated.type}`,
                    );
                }
            } catch (err) {
                this.Logger.error(
                    `[PluginLoader] 加载插件 "${hookType}" 失败:`,
                    err,
                );
            }
        }

        return pluginTable;
    }

    private checkPlugin() {}
}

export default new PluginLoader();
