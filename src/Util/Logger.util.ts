import path, { join } from "path";
import * as rfs from "rotating-file-stream";
import { type ILogObj, Logger } from "tslog";
import BootstrapWrapper from "../BootstrapWrapper/BootstrapWrapper";

/**
 * 日志相关事务初始化
 * @returns void
 */
function init(cwd: string) {
    const FileLogger = new Logger({
        minLevel: 0,
    });
    const BaseLogger = new Logger({
        name: "Base",
        type: "pretty",
        minLevel: 3,
    });

    const stream = rfs.createStream("access.log", {
        interval: "1d", // 每天循环
        size: "10M", // 或者文件达到 10MB 循环
        path: path.join(cwd, "logs"),
    });

    FileLogger.attachTransport((logObj: ILogObj) => {
        stream.write(JSON.stringify(logObj) + "\n");
    });

    //将日志基类暴露
    return BaseLogger;
}

export default init;
