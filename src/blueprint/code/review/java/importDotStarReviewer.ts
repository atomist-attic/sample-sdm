import { regexpReviewer, ReviewerRegistration } from "@atomist/sdm";
import { JavaAndKotlinSource } from "./Globs";

export const ImportDotStarReviewer: ReviewerRegistration = regexpReviewer(
    "import-dot-star",
    {globPattern: JavaAndKotlinSource, severity: "info"},
    {
        antiPattern: /^import .*\.\*/,
        shouldBe: "Don't import .*, organize imports!",
    },
);
