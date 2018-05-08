import { Goal } from "@atomist/sdm/common/delivery/goals/Goal";
import { Goals, isGoals } from "@atomist/sdm/common/delivery/goals/Goals";
import { GoalSetter } from "@atomist/sdm/common/listener/GoalSetter";
import { PushListenerInvocation } from "@atomist/sdm/common/listener/PushListener";
import { NeverMatch, PushMapping } from "@atomist/sdm/common/listener/PushMapping";

import { PushTestPredicate, toPushTest } from "@atomist/sdm/blueprint/dsl/pushTestPredicate";
import { PushRule } from "@atomist/sdm/common/listener/support/PushRule";
import * as _ from "lodash";
import { isArray } from "util";

export class AdditiveGoalSetter implements GoalSetter {

    private readonly contributors: Array<PushMapping<Goal[]>> = [];

    constructor(public name: string, ...contributors: Array<PushMapping<Goal | Goal[] | Goals>>) {
        this.contributors = contributors.map(c => ({
            name: c.name,
            async valueForPush(p) {
                const r = await c.valueForPush(p);
                return (isGoals(r)) ? r.goals :
                    isArray(r) ? r : [r];
            },
        }));
    }

    public async valueForPush(p: PushListenerInvocation): Promise<NeverMatch | Goals | undefined> {
        const contributorGoals: Goal[][] = await Promise.all(this.contributors.map(c => c.valueForPush(p)));
        const uniqueGoals: Goal[] = _.uniq(_.flatten(contributorGoals));
        return new Goals(this.name, ...uniqueGoals);
    }

}

export function goalContributors(...contributors: Array<PushMapping<Goal | Goal[] | Goals>>): GoalSetter {
    return new AdditiveGoalSetter("Built", ...contributors);
}

export function whenPush(guard1: PushTestPredicate, ...guards: PushTestPredicate[]): PushRule<Goals | Goal | Goal[]> {
    return new PushRule(toPushTest(guard1), guards.map(toPushTest));
}
