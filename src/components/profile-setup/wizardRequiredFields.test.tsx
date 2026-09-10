import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";
import Page1BasicInfo from "./Page1BasicInfo";
import Page2Goals from "./Page2Goals";
import Page3WhoAndFilters from "./Page3WhoAndFilters";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: [], error: null })),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

const complete: ProfileSetupFormData = {
  ...initialProfileSetupFormData,
  fullName: "Jordan Lee",
  avatarUrl: "https://example.com/photo.jpg",
  jobTitle: "VP Engineering",
  company: "TechCo",
  location: "San Francisco, CA",
  locationSelectionType: "database",
  linkedinUrl: "linkedin.com/in/jordanlee",
  roleType: "Founder / Co-founder",
  secondaryRoleTypes: ["Investor"],
  primaryFunction: "Product",
  additionalFunctions: ["Engineering"],
  seniority: "Director",
  primaryGoal: "Raise Capital",
  secondaryGoals: ["Hire Talent"],
  needs: ["Hiring Talent"],
  offers: ["Career Advice"],
  whoToMeet: ["Founders"],
  industryPreference: "Show me a mix of both",
  locationPreference: "mix",
  careerLevelPreference: ["Director"],
  connectionPreference: ["Quick Introduction"],
};

function Harness({ page, formData }: { page: 1 | 2 | 3; formData: ProfileSetupFormData }) {
  const [data, setData] = useState(formData);
  const onNext = harnessOnNext;
  const shared = { formData: data, setFormData: setData, onNext, onBack: vi.fn() };
  return (
    <MemoryRouter>
      {page === 1 && <Page1BasicInfo {...shared} userId="u1" />}
      {page === 2 && <Page2Goals {...shared} />}
      {page === 3 && <Page3WhoAndFilters {...shared} />}
    </MemoryRouter>
  );
}

let harnessOnNext = vi.fn();
afterEach(() => {
  cleanup();
  harnessOnNext = vi.fn();
});

function clickContinue() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("wizard blocks Next when a now-required multi-select is empty", () => {
  it("Page 1 — no additional identity", () => {
    render(<Harness page={1} formData={{ ...complete, secondaryRoleTypes: [] }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least 1 additional identity")).toBeInTheDocument();
  });

  it("Page 1 — no additional function", () => {
    render(<Harness page={1} formData={{ ...complete, additionalFunctions: [] }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least 1 additional function")).toBeInTheDocument();
  });

  it("Page 1 — no profile photo", () => {
    render(<Harness page={1} formData={{ ...complete, avatarUrl: "" }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("Profile photo is required")).toBeInTheDocument();
  });

  it("Page 1 — no LinkedIn URL", () => {
    render(<Harness page={1} formData={{ ...complete, linkedinUrl: "" }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("LinkedIn URL is required")).toBeInTheDocument();
  });

  it("Page 1 — LinkedIn URL still format-checked once present", () => {
    render(<Harness page={1} formData={{ ...complete, linkedinUrl: "https://twitter.com/x" }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a valid LinkedIn URL/)).toBeInTheDocument();
  });

  it("Page 1 — passes when everything required is set", () => {
    render(<Harness page={1} formData={complete} />);
    clickContinue();
    expect(harnessOnNext).toHaveBeenCalledTimes(1);
  });

  it("Page 2 — no additional goal", () => {
    render(<Harness page={2} formData={{ ...complete, secondaryGoals: [] }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least 1 additional goal")).toBeInTheDocument();
  });

  it("Page 2 — passes when everything required is set", () => {
    render(<Harness page={2} formData={complete} />);
    clickContinue();
    expect(harnessOnNext).toHaveBeenCalledTimes(1);
  });

  it("Page 3 — no career level preference", () => {
    render(<Harness page={3} formData={{ ...complete, careerLevelPreference: [] }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least 1 career level")).toBeInTheDocument();
  });

  it("Page 3 — no connection preference", () => {
    render(<Harness page={3} formData={{ ...complete, connectionPreference: [] }} />);
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least 1 connection preference")).toBeInTheDocument();
  });

  it("Page 3 — passes when everything required is set", () => {
    render(<Harness page={3} formData={complete} />);
    clickContinue();
    expect(harnessOnNext).toHaveBeenCalledTimes(1);
  });
});
