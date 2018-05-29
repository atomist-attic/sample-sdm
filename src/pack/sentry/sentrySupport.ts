import { ExtensionPack } from "@atomist/sdm";
import { addSentry } from "./addSentryEditor";

export const SentrySupport: ExtensionPack = {
    name: "Sentry",
    configure:
        sdm => {
            sdm.addEditors(() => addSentry);
        },
};
