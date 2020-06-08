// Necessary packages
const RendererContext = require("../renderer-context.js");

/**
 * Class used create context
 * for the single tag theme views
 */

class RendererContextTag extends RendererContext {
    loadData() {
        // Prepare query data
        this.postsNumber = parseInt(this.postsNumber, 10);
        this.offset = parseInt(this.offset, 10);
        // Retrieve tag data
        this.tag = this.renderer.cachedItems.tags[this.tagID];

        // Retrieve post
        let includeFeaturedPosts = "";

        if (
            this.themeConfig.renderer &&
            !this.themeConfig.renderer.tagsIncludeFeaturedInPosts
        ) {
            includeFeaturedPosts = 'p.status NOT LIKE "%featured%" AND';
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
                    posts AS p
                LEFT JOIN
                    posts_tags AS pt
                ON
                    p.id = pt.post_id
                WHERE
                    p.status LIKE "%published%" AND
                    p.status NOT LIKE "%hidden%" AND
                    p.status NOT LIKE "%trashed%" AND
                    ${includeFeaturedPosts}
                    pt.tag_id = @tagID
                ORDER BY
                    ${this.postsOrdering}
                LIMIT
                    @postsNumber
                OFFSET
                    @offset
            `
                )
                .all({
                    tagID: this.tagID,
                    postsNumber: this.postsNumber,
                    offset: this.offset
                });
        }

        this.tags = this.renderer.commonData.tags;
        this.menus = this.renderer.commonData.menus;
        this.unassignedMenus = this.renderer.commonData.unassignedMenus;
        this.authors = this.renderer.commonData.authors;
        this.featuredPosts = this.renderer.commonData.featuredPosts.tag;
        this.hiddenPosts = this.renderer.commonData.hiddenPosts;
    }

    prepareData() {
        let siteName = this.siteConfig.name;

        if (this.siteConfig.displayName) {
            siteName = this.siteConfig.displayName;
        }

        this.title = this.siteConfig.advanced.tagMetaTitle
            .replace(/%tagname/g, this.tag.name)
            .replace(/%sitename/g, siteName);

        this.posts = this.posts || [];
        this.posts = this.posts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );
        this.featuredPosts = this.featuredPosts || [];
        this.featuredPosts = this.featuredPosts
            .map(post => this.renderer.cachedItems.posts[post.id])
            .filter(post => post.tags.some(tag => tag.id === this.tagID));
        this.hiddenPosts = this.hiddenPosts || [];
        this.hiddenPosts = this.hiddenPosts.map(
            post => this.renderer.cachedItems.posts[post.id]
        );

        // Remove featured posts from posts if featured posts allowed
        if (
            this.themeConfig.renderer &&
            this.themeConfig.renderer.tagsIncludeFeaturedInPosts &&
            (this.themeConfig.renderer.tagsFeaturedPostsNumber > 0 ||
                this.themeConfig.renderer.tagsFeaturedPostsNumber === -1)
        ) {
            let featuredPostsIds = this.featuredPosts.map(post => post.id);
            this.posts = this.posts.filter(
                post => featuredPostsIds.indexOf(post.id) === -1
            );
        }

        // Prepare meta data
        this.metaTitle = this.siteConfig.advanced.tagMetaTitle
            .replace(/%tagname/g, this.tag.name)
            .replace(/%sitename/g, siteName);
        this.metaDescription = this.siteConfig.advanced.tagMetaDescription;

        let metaData = this.tag.additionalData;

        if (metaData && metaData.metaTitle) {
            this.metaTitle = metaData.metaTitle
                .replace(/%tagname/g, this.tag.name)
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

        let metaRobotsValue = this.siteConfig.advanced.metaRobotsTags;

        if (this.siteConfig.advanced.noIndexThisPage) {
            metaRobotsValue = "noindex,nofollow";
        }

        this.context = {
            title: this.metaTitle !== "" ? this.metaTitle : this.title,
            tag: this.tag,
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

    getContext(tagID, offset = 0, postsNumber = 999) {
        this.offset = offset;
        this.postsNumber = postsNumber;
        this.tagID = tagID;
        this.setContext();

        return this.context;
    }
}

module.exports = RendererContextTag;
