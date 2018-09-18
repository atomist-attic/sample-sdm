import { ExecuteGoal, GenericGoal } from "@atomist/sdm";

export const PlaceholderDeploy = new GenericGoal({
    uniqueName: "Deploy",
}, "Goal seeking deployment");

export function executeSeekingDeploy(): ExecuteGoal {
    return async gi => {
        return gi.addressChannels("Hey sucker, I'm not gonna do that");
    };
}
