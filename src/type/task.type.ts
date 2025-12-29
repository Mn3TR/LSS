import { z } from "zod";

// --- 定义各个部分的 Schema ---

export const TaskParamConfigSchema = z.object({
    paramFilePath: z.string(),
    configFilePath: z.string(),
});

export const TaskLogConfigSchema = z.object({
    logFileSearchMethod: z.enum(["filename", "latest", "field"]),
    logFileFolderPath: z.string(),
    logFileName: z.string().optional(),
    logFilenameField: z.string().optional(),
    logTimeSectionStart: z.number(),
    logTimeSectionEnd: z.number(),
    logTimeFormat: z.string(),
    successLog: z.union([z.string(), z.array(z.string())]),
    failedLog: z.union([z.string(), z.array(z.string())]),
});

export const TaskSchema = z.object({
    type: z.literal("task"),
    executableFilePath: z.string(),
    isNeedParam: z.boolean(),
    taskParamConfig: TaskParamConfigSchema.optional(),
    isNeedLog: z.boolean(),
    taskLogConfig: TaskLogConfigSchema.optional(),
    timeout: z.number().optional().default(0), // 单位：秒，0 表示不限时
    trackChildProcess: z.boolean().optional().default(false),
});

// --- 导出类型别名供其他文件使用 ---

export type ITask = z.infer<typeof TaskSchema>;
// 重点：显式导出子配置类型
export type ITaskLogConfig = z.infer<typeof TaskLogConfigSchema>;
export type ITaskParamConfig = z.infer<typeof TaskParamConfigSchema>;

export class task {
    constructor(public readonly config: ITask) {
        if (config.isNeedLog && !config.taskLogConfig) {
            throw new Error("task need log, but didnt give log config");
        }
        if (config.isNeedParam && !config.taskParamConfig) {
            throw new Error("task need param, but didnt give param config");
        }
    }
}
