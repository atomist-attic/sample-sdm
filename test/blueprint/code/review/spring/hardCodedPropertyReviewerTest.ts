import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { HardCodedPropertyReviewer } from "../../../../../src/blueprint/code/review/spring/hardcodedPropertyReviewer";
import { PushListenerInvocation } from "@atomist/sdm";
import { Project } from "@atomist/automation-client/project/Project";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";

import * as assert from "power-assert";

describe("HardCodePropertyReviewer", () => {

    it("should not find any problems in empty project", async () => {
        const id = new GitHubRepoRef("a", "b");
        const p = InMemoryProject.from(id);
        const r = await HardCodedPropertyReviewer.action(fakeListenerInvocation(p) as any);
        assert.equal(r.comments.length, 0);
    });

});

export function fakeListenerInvocation(project: Project): PushListenerInvocation {
    return {
        push: {id: new Date().getTime() + "_", branch: "master"},
        project: project as any as GitProject,
        id: project.id as RemoteRepoRef,
        context: null,
        addressChannels: null,
        credentials: null,
    };
}
