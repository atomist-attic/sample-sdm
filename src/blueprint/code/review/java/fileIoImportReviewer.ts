import { regexpReviewer, ReviewerRegistration } from "@atomist/sdm";
import { JavaAndKotlinSource } from "./Globs";

export const FileIoImportReviewer: ReviewerRegistration = regexpReviewer(
    "file-import",
    {globPattern: JavaAndKotlinSource, severity: "warn"},
    {
        antiPattern: /^import java.io.File/,
        shouldBe: "Don't use the file system in a cloud native app!",
    },
);
