import { z } from "zod";
import { TaskSchema, task } from "./task.type";

// 定义队列 Schema
export const QueueSchema = z.object({
    type: z.literal("queue"),
    name: z.string(),
    isNeedPlugin: z.boolean(),
    tasks: z.array(TaskSchema), // 嵌套校验每一个任务
});

export type IQueue = z.infer<typeof QueueSchema>;

export class queue {
    public readonly tasks: task[];

    constructor(public readonly config: IQueue) {
        this.tasks = config.tasks.map((t) => new task(t));
    }
}
