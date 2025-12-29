import { z } from "zod";
import { TaskSchema, task } from "./task.type";

// 定义队列 Schema
export const QueueSchema = z.object({
    type: z.literal("queue"),
    tasks: z.array(TaskSchema), // 嵌套校验每一个任务
});

export type IQueue = z.infer<typeof QueueSchema>;

export class queue {
    public readonly tasks: task[];

    constructor(data: IQueue) {
        // 将校验后的原始数据数组转换为 task 类实例数组
        this.tasks = data.tasks.map((t) => new task(t));
    }
}
