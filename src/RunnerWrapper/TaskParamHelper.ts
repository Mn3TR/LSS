import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import _ from "lodash";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import type { ITaskParamConfig } from "../type/task.type";

/**
 * 任务参数辅助类，负责管理配置文件的备份、参数合并与状态恢复。
 * * 该工具通常用于在执行任务前，将动态参数 (Param) 注入到静态配置文件 (Config) 中，
 * 并在任务结束后通过备份文件恢复原始配置，确保配置文件的纯净性。
 */
class TaskParamHelper {
    /** 目标配置文件的绝对或相对路径 */
    private configFilePath: string;
    /** 包含待注入参数的文件路径 */
    private paramFilePath: string;
    /** 实例私有的备份文件名 */
    private backupFileName: string;

    /**
     * @param config 包含配置文件和参数文件路径的配置对象
     */
    constructor(config: ITaskParamConfig) {
        this.configFilePath = path.resolve(
            BootstrapWrapper.env.selfPath,
            config.configFilePath,
        );
        this.paramFilePath = path.resolve(
            BootstrapWrapper.env.selfPath,
            config.paramFilePath,
        );
        // 为每个 helper 实例生成唯一的备份标识
        const hash = crypto.randomBytes(4).toString("hex");
        this.backupFileName = `./temp/taskconfig_${Date.now()}_${hash}.bak`;
    }

    /**
     * 备份原始配置文件。
     * 将当前的配置文件复制到临时目录 (`./temp/taskconfig.bak`)。
     * @throws {Error} 若文件不存在或目录无写入权限将抛出异常。
     */
    backup(): void {
        fs.copyFileSync(this.configFilePath, this.backupFileName);
    }

    /**
     * 写入参数逻辑。
     * 读取参数文件并利用 `lodash.merge` 将其深度合并到配置文件中。
     * 注意：此操作会改变配置文件的内存对象，通常后续需配合写入磁盘操作（当前代码仅执行了内存合并）。
     * @returns {void}
     */
    write(): void {
        const config = JSON.parse(fs.readFileSync(this.configFilePath, "utf8"));
        const param = JSON.parse(fs.readFileSync(this.paramFilePath, "utf8"));
        // 深度合并参数到配置对象
        _.merge(config, param);
        fs.writeFileSync(this.configFilePath, JSON.stringify(config));
    }

    /**
     * 恢复配置文件。
     * 从临时备份文件中还原配置文件，并覆盖当前已修改的文件。
     */
    recovery(): void {
        try {
            if (fs.existsSync(this.backupFileName)) {
                fs.copyFileSync(this.backupFileName, this.configFilePath);
                fs.unlinkSync(this.backupFileName);
            }
        } catch (e) {
            console.error(`恢复失败: ${e}`);
        }
    }
}
export default TaskParamHelper;
