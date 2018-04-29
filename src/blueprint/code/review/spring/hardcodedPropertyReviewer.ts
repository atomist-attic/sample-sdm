import { IsMaven, ReviewerRegistration } from "@atomist/sdm";
import { saveFromFiles } from "@atomist/automation-client/project/util/projectUtils";
import { DefaultReviewComment, ReviewComment } from "@atomist/automation-client/operations/review/ReviewResult";
import { Project } from "@atomist/automation-client/project/Project";

/**
 * Reviewer that finds hard-coded properties
 */
export const HardCodedPropertyReviewer: ReviewerRegistration = {
    name: "HardcodedProperties",
    pushTest: IsMaven,
    action: async pil => {
        return {
            repoId: pil.id,
            comments: await badPropertiesStrings(pil.project),
        };
    },
};

async function badPropertiesStrings(p: Project): Promise<ReviewComment[]> {
    return saveFromFiles(p, "**/*", f =>
        new DefaultReviewComment("info", "hater",
            `Found a file at \`${f.path}\`: We hate all files`,
            {
                path: f.path,
                lineFrom1: 1,
                offset: -1,
            }));
}
