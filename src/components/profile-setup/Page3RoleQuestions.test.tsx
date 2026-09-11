import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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


it.each(["Founder / Co-founder", "Creator / Influencer"])("%s shows no fields for unrelated primary and secondary goals", (roleType) => {
  render(<Harness formData={{ ...initialProfileSetupFormData, roleType,
    secondaryRoleTypes: ["Corporate Professional"], primaryGoal: "Build Community", secondaryGoals: ["Expand Network"] }} />);
  expect(screen.getByText(NO_QUESTIONS_COPY)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /skip for now/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});


it.each([
  { roleType: "Founder / Co-founder", primaryGoal: "Raise Capital", error: "Select a fundraising timeline", answer: "Actively Raising" },
  { roleType: "Corporate Professional", primaryGoal: "Hire Talent", error: "Select a hiring timeline", answer: "Hiring now" },
  { roleType: "Corporate Professional", primaryGoal: "Explore Career Opportunities", error: "Select your search status", answer: "Actively Searching" },
])("blocks Continue until the visible required answer is selected: $primaryGoal", ({ roleType, primaryGoal, error, answer }) => {
  const onNext = vi.fn();
  function RequiredHarness() {
    const [data, setData] = useState({ ...initialProfileSetupFormData, roleType, primaryGoal });
    return <Page3RoleQuestions formData={data} setFormData={setData} onNext={onNext} onBack={vi.fn()} />;
  }
  render(<RequiredHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText(error)).toBeInTheDocument();
  expect(onNext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: answer }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onNext).toHaveBeenCalledOnce();
});

it("allows optional skipping and clears the displayed answers", () => {
  const onNext = vi.fn();
  function OptionalHarness() {
    const [data, setData] = useState<ProfileSetupFormData>({ ...initialProfileSetupFormData, roleType: "Investor", roleDetails: { Investor: { checkSize: "Under $25K" } } });
    return <><Page3RoleQuestions formData={data} setFormData={setData} onNext={onNext} onBack={vi.fn()} /><output>{JSON.stringify(data.roleDetails)}</output></>;
  }
  render(<OptionalHarness />);
  fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
  expect(screen.getByRole("status")).toHaveTextContent("{}");
  expect(onNext).toHaveBeenCalledOnce();
});
