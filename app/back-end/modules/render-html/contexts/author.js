// Necessary packages
const RendererContext = require("../renderer-context");
const slug = require("./../../../helpers/slug");
const path = require("path");

/**
 * Class used create context
 * for the author theme views
 */

class RendererContextAuthor extends RendererContext {
    loadData() {
        // Prepare query data
        this.authorID = parseInt(this.authorID, 10);
        this.postsNumber = parseInt(this.postsNumber, 10);
        this.offset = parseInt(this.offset, 10);

        // Retrieve author data
        this.author = this.renderer.cachedItems.authors[this.authorID];

        // Retrieve post
        let includeFeaturedPosts = "";

        if (
            this.themeConfig.renderer &&
            !this.themeConfig.renderer.authorsIncludeFeaturedInPosts
        ) {
            includeFeaturedPosts = 'status NOT LIKE "%featured%" AND';
        }

        if (this.postsNumber === -1) {
            this.postsNumber = 999;
        }

        if (this.postsNumber === 0) {
            this.posts = false;
        } else {
            this.posts = this.db
                .prepare(
                    `
                SELECT
                    id
                FROM
                    posts
                WHERE
                    status LIKE "%published%" AND
                    status NOT LIKE "%hidden%" AND
                    status NOT LIKE "%trashed%" AND
                    ${includeFeaturedPosts}
                    authors LIKE @authorID
                ORDER BY
                    ${this.postsOrdering}
                LIMIT
                    @postsNumber
                OFFSET
                    @offset
            `
                )
                .all({
                    authorID: this.authorID.toString(),
                    postsNumber: this.postsNumber,
                    offset: this.offset
                });
        }

        this.tags = this.renderer.commonData.tags;
        this.menus = this.renderer.commonData.menus;
        this.unassignedMenus = this.renderer.commonData.unassignedMenus;
        this.authors = this.renderer.commonData.authors;
        this.featuredPosts = this.renderer.commonData.featuredPosts.author;
        this.hiddenPosts = this.renderer.commonData.hiddenPosts;
    }

    prepareData() {
        this.title = "Author: " + this.author.name;
        this.posts = this.posts || [];
        this.posts = this.posts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );
        this.featuredPosts = this.featuredPosts || [];
        this.featuredPosts = this.featuredPosts
            .map(post => this.renderer.cachedItems.posts[post.id])
            .filter(post => post.author.name === this.author.name);
        this.hiddenPosts = this.hiddenPosts || [];
        this.hiddenPosts = this.hiddenPosts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );

        // Remove featured posts from posts if featured posts allowed
        if (
            this.themeConfig.renderer &&
            this.themeConfig.renderer.authorsIncludeFeaturedInPosts &&
            (this.themeConfig.renderer.authorsFeaturedPostsNumber > 0 ||
                this.themeConfig.renderer.authorsFeaturedPostsNumber === -1)
        ) {
            let featuredPostsIds = this.featuredPosts.map(post => post.id);
            this.posts = this.posts.filter(
                post => featuredPostsIds.indexOf(post.id) === -1
            );
        }

        // Prepare meta data
        let siteName = this.siteConfig.name;

        if (this.siteConfig.displayName) {
            siteName = this.siteConfig.displayName;
        }

        this.metaTitle = this.siteConfig.advanced.authorMetaTitle
            .replace(/%authorname/g, this.author.name)
            .replace(/%sitename/g, siteName);
        this.metaDescription = this.siteConfig.advanced.authorMetaDescription;

        let metaData = this.author.config;

        if (metaData && metaData.metaTitle) {
            this.metaTitle = metaData.metaTitle
                .replace(/%authorname/g, this.author.name)
                .replace(/%sitename/g, siteName);
        }

        if (metaData && metaData.metaDescription) {
            this.metaDescription = metaData.metaDescription;
        }

        if (this.metaTitle === "") {
            this.metaTitle = this.siteConfig.advanced.metaTitle.replace(
                /%sitename/g,
                siteName
            );
        }

        if (this.metaDescription === "") {
            this.metaDescription = this.siteConfig.advanced.metaDescription;
        }
    }

    setContext() {
        this.loadData();
        this.prepareData();

        let metaRobotsValue = this.siteConfig.advanced.metaRobotsAuthors;

        if (this.siteConfig.advanced.noIndexThisPage) {
            metaRobotsValue = "noindex,nofollow";
        }

        this.context = {
            title: this.metaTitle !== "" ? this.metaTitle : this.title,
            author: this.author,
            posts: this.posts,
            featuredPosts: this.featuredPosts,
            hiddenPosts: this.hiddenPosts,
            tags: this.tags,
            authors: this.authors,
            metaTitleRaw: this.metaTitle,
            metaDescriptionRaw: this.metaDescription,
            metaRobotsRaw: metaRobotsValue,
            siteOwner: this.renderer.cachedItems.authors[1],
            menus: this.menus,
            unassignedMenus: this.unassignedMenus
        };
    }

    getContext(authorID, offset = 0, postsNumber = 999) {
        this.offset = offset;
        this.postsNumber = postsNumber;
        this.authorID = authorID;
        this.setContext();

        return this.context;
    }
}

module.exports = RendererContextAuthor;
