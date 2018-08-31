import { doWithFiles } from "@atomist/automation-client/project/util/projectUtils";
import { EnforceableProjectInvariantRegistration } from "@atomist/sdm/api/registration/ProjectInvariantRegistration";
import { IsNode } from "@atomist/sdm-pack-node";
import { doWithAllMatches } from "@atomist/automation-client/tree/ast/astUtils";
import { TypeScriptES6FileParser } from "@atomist/automation-client/tree/ast/typescript/TypeScriptFileParser";

export const TestRenamer: EnforceableProjectInvariantRegistration = {
    name: "testNaming",
    intent: "update test",
    pushTest: IsNode,
    transform: async project => {
        await doWithAllMatches(project, TypeScriptES6FileParser,
            "test/**/*.ts",
            "//ImportDeclaration//StringLiteral",
            m => {
                if (!m.$value.includes("/src")) {
                    m.$value = m.$value.replace(/Test$/, ".test");
                }
            });
        return doWithFiles(project, "test/**/*.ts", async f => {
           // await f.replace(/(import.*)Test"/, "$1.test\"");
            return f.setPath(f.path.replace(/Test\.ts$/, ".test.ts"));
        })
    },
};
