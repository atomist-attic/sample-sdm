/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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