import { z } from "zod";

export const configSchema = z.object({
    loglevel: z.number(),
    max_concurrency: z.number(),
});

export type Iconfig = z.infer<typeof configSchema>;
