import { cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";
import Page3RoleQuestions from "./Page3RoleQuestions";

function Harness({ formData }: { formData: ProfileSetupFormData }) {
  const [data, setData] = useState(formData);
  return (
    <Page3RoleQuestions
      formData={data}
      setFormData={setData}
      onNext={vi.fn()}
      onBack={vi.fn()}
    />
  );
}

afterEach(cleanup);

const NO_QUESTIONS_COPY = "No additional questions for your role — you're ready to move on.";

describe("Page3RoleQuestions — no-questions state", () => {
  it("shows the new copy and hides Skip when the role has zero question blocks", () => {
    render(<Harness formData={{ ...initialProfileSetupFormData, roleType: "Corporate Professional" }} />);

    expect(screen.getByText(NO_QUESTIONS_COPY)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /skip for now/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("still offers Skip when the role has real optional questions to skip (Investor)", () => {
    render(<Harness formData={{ ...initialProfileSetupFormData, roleType: "Investor" }} />);

    expect(screen.queryByText(NO_QUESTIONS_COPY)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip for now/i })).toBeInTheDocument();
  });

  it("hides Skip when the role has required questions (Recruiter)", () => {
    render(<Harness formData={{ ...initialProfileSetupFormData, roleType: "Recruiter" }} />);

    expect(screen.queryByText(NO_QUESTIONS_COPY)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /skip for now/i })).not.toBeInTheDocument();
  });
});
