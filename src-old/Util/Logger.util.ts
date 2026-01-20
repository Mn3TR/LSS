import * as path from "node:path";
import * as rfs from "rotating-file-stream";
import { type ILogObj, Logger } from "tslog";

/**
 * 日志相关事务初始化
 * @returns void
 */
function init(cwd: string) {
    const FileLogger = new Logger({
        type: "json",
        minLevel: 0,
    });
    const BaseLogger = FileLogger.getSubLogger({
        name: "Base",
        type: "pretty",
        minLevel: 0,
    });

    const stream = rfs.createStream("access.log", {
        interval: "1d", // 每天循环
        size: "10M", // 或者文件达到 10MB 循环
        path: path.resolve(cwd, "logs"),
    });

    FileLogger.attachTransport((logObj: ILogObj) => {
        // 使用 setImmediate 确保不阻塞主线程
        setImmediate(() => {
            stream.write(`${JSON.stringify(logObj)}\n`);
        });
    });

    //将日志基类暴露
    return BaseLogger;
}

export default init;
