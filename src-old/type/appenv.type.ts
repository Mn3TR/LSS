interface appEnv {
    isPkg: boolean;
    //程序本体所在目录
    appDir: string;
    //执行命令所在的目录
    cwd: string;
    //task/queue配置文件所在的目录,由各组件自行计算
}

export type { appEnv };
