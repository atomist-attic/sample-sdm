import { HandlerContext } from "@atomist/automation-client";
import { logger } from "@atomist/automation-client";
import { PersonByChatId } from "@atomist/sdm";

/**
 * Find the author name from the given screen name, which
 * comes in as a mapped parameter
 * @param {HandlerContext} ctx
 * @param {string} screenName
 * @return {Promise<string>}
 */
export async function findAuthorName(ctx: HandlerContext, screenName: string): Promise<string> {
    const personResult: PersonByChatId.Query = await ctx.graphClient.query(
        { name: "PersonQuery", variables: {screenName}});
    if (!personResult || !personResult.ChatId || personResult.ChatId.length === 0 || !personResult.ChatId[0].person) {
        logger.info("No person; defaulting author to blank");
        return "";
    }
    const person = personResult.ChatId[0].person;
    if (person.forename && person.surname) {
        return `${person.forename} ${person.surname}`;
    }
    if (person.gitHubId) {
        return person.gitHubId.login;
    }
    if (person.emails.length > 0) {
        return person.emails[0].address;
    }
}
