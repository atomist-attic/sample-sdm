import { PushReaction, PushReactionResponse, PushTest } from "@atomist/sdm";

/**
 * Shut down the present delivery flow if the veto function vetoes it
 * @param {PushTest} vetoer
 * @return {PushReaction<HasCodeActionResponse>}
 */
export function shutDownDeliveryIf(vetoer: PushTest): PushReaction<any> {
    return async pu => {
        const vetoed = await vetoer.mapping(pu);
        if (vetoed) {
            await pu.addressChannels(`Delivery is disabled: Vetoed by ${vetoer.name}`);
            return PushReactionResponse.failGoals;
        }
    };
}
