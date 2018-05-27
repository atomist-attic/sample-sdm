import { HandleCommand, logger } from "@atomist/automation-client";
import { commandHandlerFrom } from "@atomist/automation-client/onCommand";
import {
    EmptyParameters,
    MessageGoal,
    PushListenerInvocation,
    PushTest,
    SoftwareDeliveryMachineConfigurer,
} from "@atomist/sdm";
import { allOf } from "@atomist/sdm/blueprint/dsl/allOf";
import { executeSendMessageToSlack } from "@atomist/sdm/common/slack/executeSendMessageToSlack";

export const ExplainDeploymentFreezeGoal = new MessageGoal("deploymentFreeze");

export interface DeploymentStatusManager {

    setFrozen(flag: boolean);

    isFrozen: Promise<boolean>;
}

// TODO need to be able to add push rules

/**
 * Capability to add to an SDM to add deployment freeze
 * @param {DeploymentStatusManager} dsm
 * @return {SoftwareDeliveryMachineConfigurer}
 */
export function deploymentFreeze(dsm: DeploymentStatusManager): SoftwareDeliveryMachineConfigurer {
    return {
        name: "deploymentFreeze",
        configure: sdm => {
            sdm.addSupportingCommands(
                () => freezeCommand(dsm),
                () => unfreezeCommand(dsm),
            );
            sdm.addGoalImplementation("ExplainDeploymentFreezeGoal",
                ExplainDeploymentFreezeGoal,
                executeSendMessageToSlack("Not deploying as deployment is frozen :no_entry:"));
        },
    };
}

/**
 * Return a push test working against the current DeploymentStatusManager
 * @param {DeploymentStatusManager} dsm
 * @return {PushTest}
 */
export function isDeploymentFrozen(dsm: DeploymentStatusManager): PushTest {
    return allOf<PushListenerInvocation>(async pu => {
        logger.info(`Delivery is frozen for '${pu.push.after.message}' = ${dsm.isFrozen}`);
        return dsm.isFrozen;
    });
}

export function freezeCommand(dsm: DeploymentStatusManager): HandleCommand {
    return commandHandlerFrom(
        async ctx => {
            dsm.setFrozen(true);
            return ctx.messageClient.respond("Deployment is frozen for all services :no_entry:");
        },
        EmptyParameters,
        "freeze",
        "Freeze deployment",
        "freeze deployment",
    );
}

export function unfreezeCommand(freezeStore: DeploymentStatusManager): HandleCommand {
    return commandHandlerFrom(
        async ctx => {
            freezeStore.setFrozen(false);
            return ctx.messageClient.respond("Deployment is re-enabled for all services :woman-running:");
        },
        EmptyParameters,
        "unfreeze",
        "Unfreeze deployment",
        "unfreeze deployment",
    );
}
