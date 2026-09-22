import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Off the top of the hour so polling does not pile onto :00 traffic.
crons.interval(
  "poll public case status",
  { minutes: 10 },
  internal.snapshots.listDueCaseIds,
);

crons.interval(
  "poll AgentMail inbox fallback",
  { minutes: 5 },
  internal.mail.pollInbox,
);

export default crons;
