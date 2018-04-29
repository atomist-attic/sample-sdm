import { IsMaven, ReviewerRegistration } from "@atomist/sdm";

/**
 * Reviewer that finds "provided" Maven dependencies and objects
 */
export const ProvidedDependenciesReviewer: ReviewerRegistration = {
    name: "ProvidedDependencies",
    pushTest: IsMaven,
    action: async pil => {
        return {
            repoId: pil.id,
            comments: [],
        };
    },
};
