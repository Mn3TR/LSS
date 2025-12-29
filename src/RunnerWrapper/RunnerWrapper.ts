import _Runner from "../Runner/Runner";
import { queue } from "../type/queue.type";
import { task } from "../type/task.type";
import _ParamHelper from "./TaskParamHelper";

class RunnerWrapper {
    /**
     * 联动：不再接收匿名的 object，而是明确的类实例
     */
    async init(obj: task | queue) {
        if (obj instanceof task) {
            await this.newTask(obj);
        } else if (obj instanceof queue) {
            // 联动：循环执行队列中的任务实例
            for (const t of obj.tasks) {
                await this.newTask(t);
            }
        }
    }

    private async newTask(t: task) {
        // 联动：利用 Zod 确保 taskParamConfig 在 isNeedParam 为 true 时存在
        if (t.config.isNeedParam && t.config.taskParamConfig) {
            const ParamHelper = new _ParamHelper(t.config.taskParamConfig);
            ParamHelper.backup();
            ParamHelper.write();
        }

        const runner = new _Runner(t);
        try {
            await runner.run();
        } finally {
            if (t.config.isNeedParam && t.config.taskParamConfig) {
                const ParamHelper = new _ParamHelper(t.config.taskParamConfig);
                ParamHelper.recovery();
            }
        }
    }
}

export default new RunnerWrapper();
