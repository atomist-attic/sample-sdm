import { SoftwareDeliveryMachine } from "@atomist/sdm";
import { executeMavenDeploy, MavenDeploymentGoal } from "../MavenDeploymentGoal";

export function configureForLocal(sdm: SoftwareDeliveryMachine) {
    // TODO needs it own push test
    // whenPushSatisfies(HasSpringBootApplicationClass)
    //     .setGoals(MavenDeploymentGoal),
    sdm.addGoalImplementation("Maven deployment", MavenDeploymentGoal,
        executeMavenDeploy(sdm.configuration.sdm.projectLoader, {
            lowerPort: 9090,
        }));

    sdm.addRepoCreationListener(async l =>
        l.addressChannels(`New repo ${l.id.url}`));
    sdm.addNewRepoWithCodeListener(async l =>
        l.addressChannels(`New repo with code ${l.id.url}`));

    sdm.addReviewListenerRegistration({
        name: "consoleListener",
        listener: async l => {
            await l.addressChannels(`${l.review.comments.length} review errors: ${l.review.comments}`);
            for (const c of l.review.comments) {
                await l.addressChannels(`${c.severity}: ${c.category} - ${c.detail} ${JSON.stringify(c.sourceLocation)}`);
            }
        }
    });
}
