import { ExtensionPack } from "@atomist/sdm";
import { AddSentry } from "./addSentryEditor";

export const SentrySupport: ExtensionPack = {
    name: "Sentry",
    configure:
        sdm => {
            sdm.addEditors(AddSentry);
        },
};
