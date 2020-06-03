// Necessary packages
const RendererContext = require("../renderer-context");
const slug = require("./../../../helpers/slug");
const path = require("path");

/**
 * Class used create context
 * for the all posts theme view
 */

class RendererContextAllPosts extends RendererContext {
    loadData() {
        // Prepare query data
        this.postsNumber = parseInt(this.postsNumber, 10);
        this.offset = parseInt(this.offset, 10);

        // Retrieve post
        let includeFeaturedPosts = 'status NOT LIKE "%featured%"';

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
                ORDER BY
                    ${this.postsOrdering}
                LIMIT
                    @postsNumber
                OFFSET
                    @offset
            `
                )
                .all({
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
        this.title = "Posts";
        this.posts = this.posts || [];
        this.posts = this.posts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );
        this.featuredPosts = this.featuredPosts || [];
        this.featuredPosts = this.featuredPosts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );
        this.hiddenPosts = this.hiddenPosts || [];
        this.hiddenPosts = this.hiddenPosts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );

        let featuredPostsIds = this.featuredPosts.map(post => post.id);
        this.posts = this.posts.filter(
            post => featuredPostsIds.indexOf(post.id) === -1
        );

        // Prepare meta data
        let siteName = this.siteConfig.name;

        if (this.siteConfig.displayName) {
            siteName = this.siteConfig.displayName;
        }

        this.metaTitle = this.siteConfig.advanced.authorMetaTitle
            .replace(/%authorname/g, "posts")
            .replace(/%sitename/g, siteName);
        this.metaDescription = ""; // TODO //this.siteConfig.advanced.authorMetaDescription;

        if (this.metaDescription === "") {
            this.metaDescription = this.siteConfig.advanced.metaDescription;
        }
    }

    setContext() {
        this.loadData();
        this.prepareData();

        let metaRobotsValue = "";

        if (this.siteConfig.advanced.noIndexThisPage) {
            metaRobotsValue = "noindex,nofollow";
        }

        this.context = {
            title: this.title,
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

    getContext(offset = 0, postsNumber = 999) {
        this.offset = offset;
        this.postsNumber = postsNumber;
        this.setContext();

        return this.context;
    }
}

module.exports = RendererContextAllPosts;
