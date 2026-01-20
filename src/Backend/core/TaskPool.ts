import { TaskSchema, type task } from "../type/task.type";
import BootstrapWrapper from "./BootstrapWrapper";

class TaskPool {
    /** 自身的日志记录器 */
    private readonly Logger = BootstrapWrapper.BaseLogger.getSubLogger({
        name: "TaskPoolManager",
    });
    private tasks: task[] = [];

    // 初始化/覆盖数据
    public setAll(tasks: task[]): void {
        this.Logger.debug(`init tasks by ${tasks}`);
        this.tasks = tasks;
    }

    // 获取全部（通常用于 AfterProcessWrapper 统计）
    public getAll(): task[] {
        this.Logger.debug("getAll task");
        return [...this.tasks]; // 返回副本防止外部直接篡改
    }

    // 基础查找
    public find(predicate: (t: task) => boolean): task | undefined {
        this.Logger.debug(`find task by ${predicate}`);
        return this.tasks.find(predicate);
    }

    // 基础过滤
    public filter(predicate: (t: task) => boolean): task[] {
        this.Logger.debug(`filter task by ${predicate}`);
        return this.tasks.filter(predicate);
    }

    // 基础更新
    public update(id: string, updates: Partial<task>): void {
        this.Logger.debug(`update task by ${id}, update contect ${updates}`);
        const task = this.tasks.find((t) => t.id === id);
        if (task) {
            Object.assign(task, updates);
        }
    }
}

export default new TaskPool();
