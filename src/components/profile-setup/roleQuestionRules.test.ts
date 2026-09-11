import { expect, it } from "vitest";
import { getQuestionBlocks } from "./roleQuestionRules";
import { cleanRoleDetailsForIdentities } from "./roleDetailsUtils";

it.each(["Founder / Co-founder", "Creator / Influencer"])("%s needs an eligible goal even as a secondary identity", (role) => {
  expect(getQuestionBlocks(role, ["Corporate Professional"], "Build Community", [])).toEqual([]);
  expect(getQuestionBlocks("Corporate Professional", [role], "Build Community", ["Expand Network"])).toEqual([]);
});
it("preserves identity order, deduplicates hiring, and appends career questions", () => {
  expect(getQuestionBlocks("Hiring Manager", ["Investor", "Recruiter", "Founder / Co-founder"], "Hire Talent", ["Raise Capital", "Explore Career Opportunities"])).toEqual([
    { type: "Recruiter", storageKey: "Hiring Manager", label: "Recruiter / Hiring Manager" },
    { type: "Investor", storageKey: "Investor", label: "Investor" },
    { type: "Founder", storageKey: "Founder", label: "Founder / Co-founder" },
    { type: "CareerSeeker", storageKey: "CareerSeeker", label: "Career seeker" },
  ]);
});
it("goals independently activate hiring and career and cleanup retains their answers", () => {
  expect(getQuestionBlocks("Corporate Professional", [], "Hire Talent", ["Explore Career Opportunities"])).toEqual([
    { type: "Recruiter", storageKey: "Recruiter", label: "Hiring" },
    { type: "CareerSeeker", storageKey: "CareerSeeker", label: "Career seeker" },
  ]);
  expect(cleanRoleDetailsForIdentities({ Recruiter: { hiringTimeline: "Hiring now" }, Creator: {}, CareerSeeker: { searchStatus: "Actively Searching" } }, "Corporate Professional", [], "Hire Talent", ["Explore Career Opportunities"])).toEqual({ Recruiter: { hiringTimeline: "Hiring now" }, CareerSeeker: { searchStatus: "Actively Searching" } });
});
