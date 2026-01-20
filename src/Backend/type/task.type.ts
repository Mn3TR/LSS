import { randomBytes } from "crypto";
import { z } from "zod";

// --- 定义各个部分的 Schema ---

export const TaskParamConfigSchema = z.object({
    paramFilePath: z.string(),
    configFilePath: z.string(),
});

export const TaskLogConfigSchema = z.object({
    logSource: z.enum(["file", "stdout"]).optional().default("file"),
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
    name: z.string(),
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
//显式导出子配置类型
export type ITaskLogConfig = z.infer<typeof TaskLogConfigSchema>;
export type ITaskParamConfig = z.infer<typeof TaskParamConfigSchema>;

export enum taskStatus {
    init,
    running,
    errorwhenrunning,
    retry,
    done,
    error,
}

export class task {
    public locking: boolean = false;
    public readonly id: string = randomBytes(8).toString("hex");
    public status: taskStatus;

    constructor(public readonly config: ITask) {
        this.status = taskStatus.init;
        if (config.isNeedLog && !config.taskLogConfig) {
            throw new Error("task need log, but didnt give log config");
        }
        if (config.isNeedParam && !config.taskParamConfig) {
            throw new Error("task need param, but didnt give param config");
        }
        if (
            config.taskLogConfig?.logFileSearchMethod === "field" &&
            !config.taskLogConfig.logFilenameField
        ) {
            throw new Error(
                "task logFileSearchMethod is field, but didnt give field",
            );
        }
        if (
            config.taskLogConfig?.logFileSearchMethod === "filename" &&
            !config.taskLogConfig.logFileName
        ) {
            throw new Error(
                "task logFileSearchMethod is filename, but didnt give filename",
            );
        }
    }
}
