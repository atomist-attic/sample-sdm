import { AddressChannels, ExecuteGoal, Fulfillment, GoalWithFulfillment, IndependentOfEnvironment } from "@atomist/sdm";
import { SlackMessage } from "@atomist/slack-messages";

export class CallbackGoal extends GoalWithFulfillment {

    constructor(uniqueName: string, goalExecutor: ExecuteGoal) {
        super({
            uniqueName,
            environment: IndependentOfEnvironment,
        });

        const fulfillment: Fulfillment = {
            name: uniqueName,
            goalExecutor,
        };
        super.with(fulfillment);
    }

}

export class MessagingGoal extends CallbackGoal {

    constructor(uniqueName: string, messager: (ac: AddressChannels) => Promise<any>) {
        super(uniqueName, async gi => {
            await messager(gi.addressChannels);
            return { code: 0, message: "" };
        });
    }
}

export class SuggestedActionGoal extends MessagingGoal {

    constructor(uniqueName: string, message: string | SlackMessage, url?: string) {
        super(uniqueName, async ac => {
            await ac(message);
            if (!!url) {
                await ac(`For more information, see ${url}`);
            }
        });
    }
}