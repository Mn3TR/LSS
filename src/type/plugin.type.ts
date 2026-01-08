/*
interface plugin {
    type:
        | "taskBeforeRun"
        | "taskAfterRun"
        | "logHandler"
        | "queueBeforeRun"
        | "queueAfterRun";

    taskBeforeRun?(): void;
    taskAfterRun?(): void;
    logHandler?(line: string): void;
    queueBeforeRun?(): void;
    queueAfterRun?(): void;
}
    */

import { z } from "zod";

// 1. 任务前置插件
const taskBeforeRunSchema = z.object({
    type: z.literal("taskBeforeRun"),
    taskBeforeRun: z.function({
        input: z.tuple([]), // 无参数
        output: z.void(),
    }),
    // 禁止其他函数，确保职责单一
    taskAfterRun: z.never().optional(),
    logHandler: z.never().optional(),
    queueBeforeRun: z.never().optional(),
    queueAfterRun: z.never().optional(),
});
// 2. 任务后置插件
const taskAfterRunSchema = z.object({
    type: z.literal("taskAfterRun"),
    taskAfterRun: z.function({
        input: z.tuple([]),
        output: z.void(),
    }),
    taskBeforeRun: z.never().optional(),
    logHandler: z.never().optional(),
    queueBeforeRun: z.never().optional(),
    queueAfterRun: z.never().optional(),
});
// 3. 日志处理器 [参考 src/Runner/RunnerLogHandler.ts]
const logHandlerSchema = z.object({
    type: z.literal("logHandler"),
    logHandler: z.function({
        input: z.tuple([z.string()]), // 接收一行字符串日志
        output: z.void(),
    }),
    taskBeforeRun: z.never().optional(),
    taskAfterRun: z.never().optional(),
    queueBeforeRun: z.never().optional(),
    queueAfterRun: z.never().optional(),
});
// 4. 队列前置插件
const queueBeforeRunSchema = z.object({
    type: z.literal("queueBeforeRun"),
    queueBeforeRun: z.function({
        input: z.tuple([]),
        output: z.void(),
    }),
    taskBeforeRun: z.never().optional(),
    taskAfterRun: z.never().optional(),
    logHandler: z.never().optional(),
    queueAfterRun: z.never().optional(),
});
// 5. 队列后置插件
const queueAfterRunSchema = z.object({
    type: z.literal("queueAfterRun"),
    queueAfterRun: z.function({
        input: z.tuple([]),
        output: z.void(),
    }),
    taskBeforeRun: z.never().optional(),
    taskAfterRun: z.never().optional(),
    logHandler: z.never().optional(),
    queueBeforeRun: z.never().optional(),
});

// 先定义辨别联合体
const PluginVariants = z.discriminatedUnion("type", [
    taskBeforeRunSchema,
    taskAfterRunSchema,
    logHandlerSchema,
    queueBeforeRunSchema,
    queueAfterRunSchema,
]);

// 使用 .and() 合并公共属性，解决 TypeScript 的属性访问报错
export const PluginSchema = z
    .object({
        name: z.string().min(1, "插件名称不能为空"),
    })
    .and(PluginVariants);

/**
 * 导出强类型接口
 */
export type IPlugin = z.infer<typeof PluginSchema>;
