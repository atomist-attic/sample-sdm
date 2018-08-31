import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import { TestRenamer } from "../src/machines/support/testRenamer";
import { CodeTransform } from "@atomist/sdm";
import * as assert from "assert";

describe("testRenamer", () => {

    it("should rename file", async () => {
        const p = InMemoryProject.of({
            path: "test/thingTest.ts", content: "import { foo } from \"./otherTest\""
        });
        await (TestRenamer.transform as CodeTransform)(p, null);
        const file = await p.getFile("test/thing.test.ts");
        assert(!!file);
    });

    it("should rename file and import", async () => {
        const p = InMemoryProject.of({
            path: "test/thingTest.ts", content: "import { foo } from \"./otherTest\""
        });
        await (TestRenamer.transform as CodeTransform)(p, null);
        const file = await p.getFile("test/thing.test.ts");
        assert(!!file);
        assert(file.getContentSync().includes("other.test"),
            `Content was\n${file.getContentSync()}`);
    });

    it("should rename file and import with test in name", async () => {
        const p = InMemoryProject.of({
            path: "test/thingTest.ts", content: "import { Test } from \"./otherTest\""
        });
        await (TestRenamer.transform as CodeTransform)(p, null);
        const file = await p.getFile("test/thing.test.ts");
        assert(!!file);
        assert(file.getContentSync().includes("other.test"),
            `Content was\n${file.getContentSync()}`);
    });

    it("should rename file and import with test in test name", async () => {
        const p = InMemoryProject.of({
            path: "test/thingTest.ts", content:
                "import { FalsePushTest, TruePushTest } from \"../mapping/support/pushTestUtilsTest\";\n"
        });
        await (TestRenamer.transform as CodeTransform)(p, null);
        const file = await p.getFile("test/thing.test.ts");
        assert(!!file);
        assert(file.getContentSync().includes("pushTestUtils.test"),
            `Content was\n${file.getContentSync()}`);
    });

});