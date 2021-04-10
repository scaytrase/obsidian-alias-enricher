import {LinkCache, Plugin, TAbstractFile, TFile} from 'obsidian';

import * as jsyaml from 'js-yaml';

export default class MyPlugin extends Plugin {
    async onload() {
        this.app.vault.on("modify", file => this.onModify(file));
    }

    async onModify(file: TAbstractFile) {
        let links = this.app.metadataCache.getCache(file.path).links;

        if (links === null || links === undefined) {
            return;
        }

        for (let link of links) {
            if (link.link === link.displayText) {
                continue;
            }

            await this.registerLinkAlias(link, file);
        }
    }

    async registerLinkAlias(link: LinkCache, file: TAbstractFile) {
        let linkDestination = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);

        if (linkDestination === null) {
            return;
        }

        let frontmatter = this.app.metadataCache.getCache(linkDestination.path).frontmatter;

        if (frontmatter === undefined || frontmatter["aliases"] === undefined || frontmatter["aliases"] === null || !frontmatter["aliases"].contains(link.displayText)) {
            await this.insertAlias(linkDestination, link.displayText);
        }
    }

    composeNewContent(content: string, alias: string) {
        try {
            let metadata = this.getMetadata(content);

            let s: string[] = [];
            if (metadata.aliases !== null && metadata.aliases !== undefined && metadata.aliases.trim() !== '') {
                s = metadata.aliases.split(',').map(el => el.trim());
            }

            metadata.aliases = s.concat([alias]).join(', ');

            return this.inlineEditedMetadata(content, jsyaml.dump(metadata));
        } catch (e) {
            return JSON.stringify(e);
        }
    }

    private inlineEditedMetadata(content: string, dump: string) {
        let start = content.lastIndexOf('---');

        if (start === -1) {
            return '---\n' + dump + '\n---\n' + content;
        }

        return '---\n' + dump + content.substring(start);
    }

    private getMetadata(content: string): { aliases?: string | undefined | null } {
        if (content.indexOf('---') === -1) {
            return {}
        }

        let startInd = content.indexOf('---') + 4;

        if (content.substring(startInd).indexOf('---') === -1) {
            return {}
        }

        let endInd = content.substring(startInd).indexOf('---') - 1;

        let fmraw = content.substring(startInd, startInd + endInd);

        // @ts-ignore
        return jsyaml.load(fmraw);
    }

    async insertAlias(linkDestination: TFile, alias: string) {
        let content = await this.app.vault.read(linkDestination);
        content = this.composeNewContent(content, alias);

        await this.app.vault.modify(linkDestination, content);

        await this.app.metadataCache.getFileCache(linkDestination);
    }
}