import { queue } from "../type/queue.type";
import { task, taskStatus } from "../type/task.type";
import BootstrapWrapper from "./BootstrapWrapper";
import TaskPool from "./TaskPool";

class TaskPoolManager {
    /** 自身的日志记录器 */
    private readonly Logger = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "TaskPoolManager",
    });

    /** 最大并发数量 */
    private MAX_CONCURRENCY = BootstrapWrapper.config.max_concurrency;

    /** task pool 的引用 */
    private pool = TaskPool;

    public init(validatedData: queue | task) {
        if (validatedData instanceof task) {
            TaskPool.setAll(new Array(validatedData));
        }
        if (validatedData instanceof queue) {
            TaskPool.setAll(validatedData.tasks);
        }
    }

    public requestTask(type: taskStatus): task | null {
        // 规则：如果是取新任务(init)，且设定为串行(max=1)，则检查是否有活跃任务
        if (
            type === taskStatus.init &&
            this.MAX_CONCURRENCY === 1 &&
            this.hasActiveTasks()
        ) {
            return null;
        }

        // 规则：并发限制检查
        const currentRunning = this.pool.filter(
            (t) => t.status === taskStatus.running,
        ).length;
        if (
            type === taskStatus.init &&
            currentRunning >= this.MAX_CONCURRENCY
        ) {
            return null;
        }

        // 查找并立即锁定（改变状态）
        const task = this.pool.find((t) => t.status === type);
        if (task) {
            // 如果是取 init 或 retry，则统一推向运行态
            const nextStatus =
                type === taskStatus.init || type === taskStatus.retry
                    ? taskStatus.running
                    : type;
            this.pool.update(task.id, { status: nextStatus });
            return task;
        }
        return null;
    }

    /**
     * 判断池子中是否正有任务处于“活跃流转”状态
     */
    private hasActiveTasks(): boolean {
        const activeStatuses: taskStatus[] = [
            taskStatus.running,
            taskStatus.errorwhenrunning,
            taskStatus.retry,
        ];
        return (
            this.pool.filter((t) => activeStatuses.includes(t.status)).length >
            0
        );
    }
}

export default new TaskPoolManager();
