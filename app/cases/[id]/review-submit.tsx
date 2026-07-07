"use client";

import { useFormStatus } from "react-dom";

type ReviewSubmitProps = {
  decision: "approve" | "reject";
};

export function ReviewSubmitButton({ decision }: ReviewSubmitProps) {
  const { pending } = useFormStatus();
  const label = decision === "approve" ? "Approve case" : "Reject case";

  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      className={decision === "approve" ? "button-primary" : "button-secondary"}
    >
      {pending ? "Submitting..." : label}
    </button>
  );
}

type CaseActionSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  className: string;
};

export function CaseActionSubmitButton({
  label,
  pendingLabel,
  className
}: CaseActionSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
