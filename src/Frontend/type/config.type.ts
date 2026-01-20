import { z } from "zod";

export const configSchema = z.object({
    backend_port: z.number(),
    backend_filename: z.string(),
});

export type Iconfig = z.infer<typeof configSchema>;
