import type { Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";
import _Runner from "../Runner/Runner";
import { queue } from "../type/queue.type";
import { task } from "../type/task.type";
import _ParamHelper from "./TaskParamHelper";

class RunnerWrapper {
    /** 自身的日志记录器*/
    private Logger: Logger<unknown> = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "RunnerWrapper",
    });

    async init(obj: task | queue) {
        this.Logger.debug("RunnerWrapper init");
        if (obj instanceof task) {
            this.Logger.debug("new a task");
            await this.newTask(obj);
        } else if (obj instanceof queue) {
            this.Logger.debug("new a queue");
            //循环执行队列中的任务实例
            for (const t of obj.tasks) {
                await this.newTask(t);
            }
        }
    }

    private async newTask(t: task) {
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
}

export default new RunnerWrapper();
