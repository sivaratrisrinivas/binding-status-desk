export type SimulatedStatus = {
  statusTitle: string;
  description: string;
  formType?: string;
  eventDate?: string;
};

const FORM = "I-765";

export const SIMULATE_LADDER: SimulatedStatus[] = [
  {
    statusTitle: "Case Was Received",
    formType: FORM,
    eventDate: "March 2, 2026",
    description:
      "On March 2, 2026, we received your Form I-765, Application for Employment Authorization, Receipt Number DEMO000000001, and mailed you a notice describing how to check your case online.",
  },
  {
    statusTitle: "Fingerprint Fee Was Received",
    formType: FORM,
    eventDate: "March 18, 2026",
    description:
      "On March 18, 2026, we received your fingerprint fee for Form I-765, Receipt Number DEMO000000001. This is public case-status text for a demo, not a real USCIS notice.",
  },
  {
    statusTitle: "Case Is Being Actively Reviewed By USCIS",
    formType: FORM,
    eventDate: "April 4, 2026",
    description:
      "As of April 4, 2026, we are actively reviewing your Form I-765, Receipt Number DEMO000000001. The public page does not say how long review takes.",
  },
  {
    statusTitle: "Request for Additional Evidence Was Sent",
    formType: FORM,
    eventDate: "May 12, 2026",
    description:
      "On May 12, 2026, we sent a request for additional evidence for your Form I-765, Receipt Number DEMO000000001. Check the public page and your mail for the request itself.",
  },
  {
    statusTitle: "Card Is Being Produced",
    formType: FORM,
    eventDate: "July 9, 2026",
    description:
      "On July 9, 2026, we ordered production of your card for Form I-765, Receipt Number DEMO000000001.",
  },
  {
    statusTitle: "Card Was Mailed To Me",
    formType: FORM,
    eventDate: "July 21, 2026",
    description:
      "On July 21, 2026, we mailed your card for Receipt Number DEMO000000001 using the address on file.",
  },
  {
    statusTitle: "Card Was Delivered To Me By The Post Office",
    formType: FORM,
    eventDate: "July 28, 2026",
    description:
      "On July 28, 2026, the Post Office delivered your new card for Receipt Number DEMO000000001, according to this simulated public-status text.",
  },
];
