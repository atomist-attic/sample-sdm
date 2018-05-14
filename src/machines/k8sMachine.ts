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

import { Configuration } from "@atomist/automation-client";
import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import { whenPushSatisfies } from "@atomist/sdm/blueprint/dsl/goalDsl";
import { K8sAutomationBuilder } from "@atomist/sdm/common/delivery/build/k8s/K8AutomationBuilder";
import {
    NoGoals,
    ProductionDeploymentGoal,
    StagingDeploymentGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import {
    HttpServiceGoals,
    LocalDeploymentGoals,
} from "@atomist/sdm/common/delivery/goals/common/httpServiceGoals";
import { LibraryGoals } from "@atomist/sdm/common/delivery/goals/common/libraryGoals";
import {
    NpmBuildGoals,
    NpmDeployGoals,
} from "@atomist/sdm/common/delivery/goals/common/npmGoals";
import {
    FromAtomist,
    ToDefaultBranch,
    ToPublicRepo,
} from "@atomist/sdm/common/listener/support/pushtest/commonPushTests";
import { IsDeployEnabled } from "@atomist/sdm/common/listener/support/pushtest/deployPushTests";
import { IsMaven } from "@atomist/sdm/common/listener/support/pushtest/jvm/jvmPushTests";
import { IsNode } from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { not } from "@atomist/sdm/common/listener/support/pushtest/pushTestUtils";
import { lookFor200OnEndpointRootGet } from "@atomist/sdm/common/verify/lookFor200OnEndpointRootGet";
import {
    disableDeploy,
    enableDeploy,
} from "@atomist/sdm/handlers/commands/SetDeployEnablement";
import { requestDeployToK8s } from "@atomist/sdm/handlers/events/delivery/deploy/k8s/RequestK8sDeploys";
import {
    K8sProductionDomain,
    K8sTestingDomain,
    NoticeK8sProdDeployCompletion,
    NoticeK8sTestDeployCompletion,
} from "../blueprint/deploy/k8sDeploy";
import { SuggestAddingK8sSpec } from "../blueprint/repo/suggestAddingK8sSpec";
import { addK8sSpec } from "../commands/editors/k8s/addK8sSpec";
import { HasK8Spec } from "../commands/editors/k8s/k8sSpecPushTest";
import { addDemoEditors } from "../parts/demo/demoEditors";
import { addJavaSupport } from "../parts/stacks/javaSupport";
import { addNodeSupport } from "../parts/stacks/nodeSupport";
import { addSpringSupport } from "../parts/stacks/springSupport";
import { addTeamPolicies } from "../parts/team/teamPolicies";
import { MaterialChangeToJavaRepo } from "../pushtest/jvm/materialChangeToJavaRepo";
import { HasSpringBootApplicationClass } from "../pushtest/jvm/springPushTests";

export function k8sMachine(options: SoftwareDeliveryMachineOptions,
                           configuration: Configuration): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        "K8s software delivery machine",
        options,
        whenPushSatisfies(IsMaven, not(MaterialChangeToJavaRepo))
            .itMeans("Immaterial change")
            .setGoals(NoGoals),
        whenPushSatisfies(
            ToDefaultBranch,
            IsMaven,
            HasSpringBootApplicationClass,
            HasK8Spec,
            ToPublicRepo,
            IsDeployEnabled)
            .itMeans("Spring Boot service to deploy")
            .setGoals(HttpServiceGoals),
        whenPushSatisfies(not(FromAtomist), IsMaven, HasSpringBootApplicationClass)
            .itMeans("Spring Boot service local deploy")
            .setGoals(LocalDeploymentGoals),
        whenPushSatisfies(IsMaven, MaterialChangeToJavaRepo)
            .itMeans("Build Java")
            .setGoals(LibraryGoals),
        whenPushSatisfies(IsNode, IsDeployEnabled, ToDefaultBranch)
            .itMeans("Build and deploy node")
            .setGoals(NpmDeployGoals),
        whenPushSatisfies(IsNode)
            .itMeans("Build with npm")
            .setGoals(NpmBuildGoals),
    );
    sdm.addBuildRules(
        build.setDefault(new K8sAutomationBuilder()))
        .addGoalImplementation("K8TestDeploy",
            StagingDeploymentGoal,
            requestDeployToK8s(K8sTestingDomain))
        .addGoalImplementation("K8ProductionDeploy",
            ProductionDeploymentGoal,
            requestDeployToK8s(K8sProductionDomain))
        .addChannelLinkListeners(SuggestAddingK8sSpec)
        .addSupportingCommands(
            () => addK8sSpec,
            enableDeploy,
            disableDeploy,
        )
        .addSupportingEvents(() => NoticeK8sTestDeployCompletion,
            () => NoticeK8sProdDeployCompletion)
        .addEndpointVerificationListeners(
            lookFor200OnEndpointRootGet({
                retries: 15,
                maxTimeout: 5000,
                minTimeout: 3000,
            }),
        );

    addJavaSupport(sdm, options);
    addSpringSupport(sdm);
    addNodeSupport(sdm);
    addTeamPolicies(sdm, configuration);

    addDemoEditors(sdm);
    return sdm;
}
