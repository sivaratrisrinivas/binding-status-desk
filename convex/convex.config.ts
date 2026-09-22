import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// App HTTP routes (AgentMail webhook) live under /api. The static site owns /.
const app = defineApp({ httpPrefix: "/api" });
app.use(staticHosting, { httpPrefix: "/" });

export default app;
