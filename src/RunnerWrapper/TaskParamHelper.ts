import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import _ from "lodash";
import type { Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import type { ITaskParamConfig } from "../type/task.type";

/**
 * 任务参数辅助类，负责管理配置文件的备份、参数合并与状态恢复。
 * 该工具通常用于在执行任务前，将动态参数 (Param) 注入到静态配置文件 (Config) 中，
 * 并在任务结束后通过备份文件恢复原始配置，确保配置文件的纯净性。
 */
class TaskParamHelper {
    /** 目标配置文件的绝对或相对路径 */
    private configFilePath: string;
    /** 包含待注入参数的文件路径 */
    private paramFilePath: string;
    /** 实例私有的备份文件名 */
    private backupFileName: string;
    /** 自身的日志记录器*/
    private Logger: Logger<unknown> = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "TaskParamHelper",
    });

    /**
     * @param config 包含配置文件和参数文件路径的配置对象
     */
    constructor(config: ITaskParamConfig) {
        this.Logger.debug("TaskParamHelper init");
        this.Logger.debug("get task configfile path");
        this.configFilePath = path.resolve(
            BootstrapWrapper.env.selfPath,
            config.configFilePath,
        );
        this.Logger.debug("get task paramfile path");
        this.paramFilePath = path.resolve(
            BootstrapWrapper.env.selfPath,
            config.paramFilePath,
        );
        this.Logger.debug("gen backup file identifier");
        // 为每个 helper 实例生成唯一的备份标识
        const hash = crypto.randomBytes(4).toString("hex");
        this.backupFileName = `./temp/taskconfig_${Date.now()}_${hash}.bak`;
        this.Logger.debug(`backup file name:${this.backupFileName}`);
    }

    /**
     * 备份原始配置文件。
     * 将当前的配置文件复制到临时目录 (`./temp/`)。
     * @throws {Error} 若文件不存在或目录无写入权限将抛出异常。
     */
    backup(): void {
        this.Logger.debug("backup task config file");
        try {
            fs.copyFileSync(this.configFilePath, this.backupFileName);
        } catch (error) {
            this.Logger.fatal("couldn't create backup file");
            this.Logger.fatal(error);
            process.exit(1);
        }
    }

    /**
     * 写入参数逻辑。
     * 读取参数文件并利用 `lodash.merge` 将其深度合并到配置文件中。
     * @returns {void}
     */
    write(): void {
        let config, param;
        try {
            config = JSON.parse(fs.readFileSync(this.configFilePath, "utf8"));
        } catch (error) {
            this.Logger.fatal("couldn't read or parse task config file");
            this.Logger.fatal(error);
            process.exit(1);
        }
        this.Logger.debug("parsed task config");

        try {
            param = JSON.parse(fs.readFileSync(this.paramFilePath, "utf8"));
        } catch (error) {
            this.Logger.fatal("couldn't read or parse task param file");
            this.Logger.fatal(error);
            process.exit(1);
        }
        this.Logger.debug("parsed task param");

        // 深度合并参数到配置对象
        _.merge(config, param);
        this.Logger.debug("merged config");
        //no use when tested
        this.Logger.silly(`merged config:${JSON.stringify(config)}`);

        try {
            fs.writeFileSync(this.configFilePath, JSON.stringify(config));
        } catch (error) {
            this.Logger.fatal(
                "couldn't write merged config to task configfile",
            );
            this.Logger.fatal(error);
            process.exit(1);
        }
        this.Logger.debug("wrote task configfile");
    }

    /**
     * 恢复配置文件。
     * 从临时备份文件中还原配置文件，并覆盖当前已修改的文件。
     */
    recovery(): void {
        try {
            if (fs.existsSync(this.backupFileName)) {
                fs.copyFileSync(this.backupFileName, this.configFilePath);
            }
        } catch (error) {
            this.Logger.fatal(`couldn't recovery task configfile, please recovery manually`,);
            this.Logger.fatal(`the backup is in ${this.backupFileName}, the origin configfile is in:${this.configFilePath}`)
            this.Logger.fatal(error);
        }
        fs.unlinkSync(this.backupFileName);
        this.Logger.debug("task configfile revoeryd, deleted backup file")
    }
}
export default TaskParamHelper;
