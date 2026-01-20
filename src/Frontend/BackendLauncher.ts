import { spawn } from "node:child_process";
import path from "node:path";
import Fronter from "./Frontend";

///TODO: logger

class BackendLauncher {
    /** 自身的日志记录器 */
    private Logger = Fronter.BaseLogger.getSubLogger({
        name: "BackendLauncher",
    });

    /**
     * 尝试启动 Backend
     */
    public async ensureRunning() {
        if (await this.isBackendAlive()) {
            return;
        }

        console.log("Backend 不在运行，正在启动...");

        // 找到 Backend 的入口文件或可执行文件
        const backendPath = path.resolve(
            Fronter.appDir,
            Fronter.config.backend_filename,
        );

        const child = spawn(backendPath, {
            detached: true, // 关键：脱离父进程
            stdio: "ignore", // 关键：忽略输出，否则会撑爆缓存或导致父进程无法退出
            windowsHide: true, // Windows 下隐藏黑窗口
        });

        // 让父进程不再引用子进程，父进程可以先行退出
        child.unref();

        // 等待几秒再次确认是否启动成功
        await this.waitForAlive();
    }

    private async isBackendAlive(): Promise<boolean> {
        try {
            const res = await fetch(
                `http://localhost:${Fronter.config.backend_port}/ping`,
            );
            return res.status === 200;
        } catch {
            return false;
        }
    }

    private async waitForAlive(retries = 5) {
        for (let i = 0; i < retries; i++) {
            if (await this.isBackendAlive()) return;
            await new Promise((r) => setTimeout(r, 1000));
        }
        throw new Error("Backend 启动失败，请检查配置或日志");
    }
}

export default new BackendLauncher();
