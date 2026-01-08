import type { Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import PluginLoader from "../PluginLoadWrapper/PluginLoader";
import _Runner from "../Runner/Runner";
import { queue } from "../type/queue.type";
import { task } from "../type/task.type";
import _ParamHelper from "./TaskParamHelper";

class RunnerWrapper {
    /** 自身的日志记录器*/
    private Logger: Logger<unknown> = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "RunnerWrapper",
    });

    /** plugin table */
    private pluginTable: Record<string, Function> = {};

    async init(obj: task | queue, filePath: string) {
        this.Logger.debug("RunnerWrapper init");
        if (obj instanceof task) {
            //如果任务需要plugin,调用PluginLoader
            if (obj.config.isNeedPlugin) {
                this.Logger.debug(
                    `task "${obj.config.name} need plugin, call PluginLoader"`,
                );
                this.pluginTable = await PluginLoader.loadPlugin(filePath);
            }

            //执行plugin.beforeTaskRun
            this.Logger.debug("plugin.taskBeforeRun");
            if (this.pluginTable.taskBeforeRun) {
                this.pluginTable.taskBeforeRun();
            }

            await this.newTask(obj, this.pluginTable);

            //执行plugin.taskAfterRun
            this.Logger.debug("plugin.taskAfterRun");
            if (this.pluginTable.taskAfterRun) {
                this.pluginTable.taskAfterRun();
            }
        } else if (obj instanceof queue) {
            this.Logger.debug("new a queue");
            //如果队列需要plugin,调用PluginLoader
            if (obj.config.isNeedPlugin) {
                this.Logger.debug(
                    `queue "${obj.config.name} need plugin, call PluginLoader"`,
                );
                this.pluginTable = await PluginLoader.loadPlugin(filePath);
            }

            //执行plugin.queueAfterRun
            this.Logger.debug("plugin.queueAfterRun");
            if (this.pluginTable.queueAfterRun) {
                this.pluginTable.queueAfterRun();
            }

            //循环执行队列中的任务实例
            for (const t of obj.tasks) {
                this.Logger.debug("new a task in queue");
                //如果任务需要plugin,调用PluginLoader
                if (t.config.isNeedPlugin) {
                    this.Logger.debug(
                        `task "${t.config.name} need plugin, call PluginLoader"`,
                    );
                    this.pluginTable = await PluginLoader.loadPlugin(filePath);
                }

                //执行plugin.beforeTaskRun
                this.Logger.debug("plugin.taskBeforeRun");
                if (this.pluginTable.taskBeforeRun) {
                    this.pluginTable.taskBeforeRun();
                }

                await this.newTask(t, this.pluginTable);

                //执行plugin.taskAfterRun
                this.Logger.debug("plugin.taskAfterRun");
                if (this.pluginTable.taskAfterRun) {
                    this.pluginTable.taskAfterRun();
                }
            }

            //执行plugin.queueAfterRun
            this.Logger.debug("plugin.queueAfterRun");
            if (this.pluginTable.queueAfterRun) {
                this.pluginTable.queueAfterRun();
            }
        }
    }

    private async newTask(t: task, pluginTable: Record<string, Function>) {
        this.Logger.debug(`new task:${t.config.name}`);
        //确保 taskParamConfig 在 isNeedParam 为 true 时存在
        if (t.config.isNeedParam && t.config.taskParamConfig) {
            this.Logger.debug("created TaskParamHelper");
            const ParamHelper = new _ParamHelper(t.config.taskParamConfig);
            this.Logger.debug("backup task configfile");
            ParamHelper.backup();
            this.Logger.debug("write task configfile");
            ParamHelper.write();
        }

        this.Logger.debug("created Runner");
        const runner = new _Runner(t);
        try {
            this.Logger.debug("Runner start");
            await runner.run();
        } catch (error) {
            this.Logger.fatal("Runner error");
            this.Logger.fatal(error);
        } finally {
            this.Logger.debug("Runner completed");
            if (t.config.isNeedParam && t.config.taskParamConfig) {
                const ParamHelper = new _ParamHelper(t.config.taskParamConfig);
                this.Logger.debug("recovery task configfile");
                ParamHelper.recovery();
            }
        }
    }

    private processPlugin() {}
}

export default new RunnerWrapper();
