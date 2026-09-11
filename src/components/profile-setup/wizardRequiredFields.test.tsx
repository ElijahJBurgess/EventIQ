import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { buildProfileUpdatePayload } from "./profileUpdate";
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
      <output data-testid="payload">{JSON.stringify(buildProfileUpdatePayload(data))}</output>
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

describe("location selection", () => {
  it("keeps untouched legacy display text unresolved", () => {
    render(<Harness page={1} formData={{ ...complete, location: "Paris, France", locationSelectionType: "existing" }} />);
    clickContinue();
    expect(harnessOnNext).toHaveBeenCalledOnce();
    expect(JSON.parse(screen.getByTestId("payload").textContent!)).toMatchObject({ location: "Paris, France", location_city: null, location_state_code: null });
  });

  it.each([false, true])("distinguishes RPC failure (rejection=%s), permits retry and selection", async (reject) => {
    if (reject) vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error("offline"));
    else vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: "offline" } } as never);
    render(<Harness page={1} formData={complete} />);
    fireEvent.change(screen.getByPlaceholderText("Search for a US city"), { target: { value: "Atlanta" } });
    expect(await screen.findByText("City search failed. Try again or use a custom location.")).toBeInTheDocument();
    expect(screen.queryByText("No matching US cities found.")).not.toBeInTheDocument();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 1, city: "Atlanta", state_code: "GA", display_name: "Atlanta, GA" }], error: null } as never);
    fireEvent.click(screen.getByRole("button", { name: "Retry city search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Atlanta, GA" }));
    clickContinue();
    expect(harnessOnNext).toHaveBeenCalledOnce();
    expect(JSON.parse(screen.getByTestId("payload").textContent!)).toMatchObject({ location: "Atlanta, GA", location_city: "Atlanta", location_state_code: "GA" });
  });

  it("explicit custom entry clears an earlier database selection", async () => {
    render(<Harness page={1} formData={{ ...complete, locationCity: "San Francisco", locationStateCode: "CA" }} />);
    fireEvent.change(screen.getByPlaceholderText("Search for a US city"), { target: { value: "Paris, France" } });
    fireEvent.click(await screen.findByRole("button", { name: /I don't see my city/ }));
    clickContinue();
    expect(harnessOnNext).toHaveBeenCalledOnce();
    expect(JSON.parse(screen.getByTestId("payload").textContent!)).toMatchObject({ location: "Paris, France", location_city: null, location_state_code: null });
  });

  it.each(["", "Atlanta"])("blocks cleared/unconfirmed input %s", (location) => {
    render(<Harness page={1} formData={complete} />);
    fireEvent.change(screen.getByPlaceholderText("Search for a US city"), { target: { value: location } });
    clickContinue();
    expect(harnessOnNext).not.toHaveBeenCalled();
  });
});

it("does not confirm typed text when Page 1 remounts", () => {
  const formData = { ...complete, location: "Changed city", locationSelectionType: "" as const };
  const first = render(<Harness page={1} formData={formData} />);
  first.unmount();
  render(<Harness page={1} formData={formData} />);
  clickContinue();
  expect(harnessOnNext).not.toHaveBeenCalled();
  expect(screen.getByText("Select a city from the results or use the custom location option")).toBeInTheDocument();
});
