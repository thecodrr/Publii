const Handlebars = require('handlebars');

/**
 * Helper for generating meta_robots
 *
 * {{metaRobots}}
 *
 * @returns {string} <meta> tag with the meta robots value
 */
function metaRobotsHelper(rendererInstance, Handlebars) {
    Handlebars.registerHelper('metaRobots', function (options) {
        let output = '';

        // If canonical is set or AMP is currently rendered - skip meta robots tag
        if (rendererInstance.ampMode || options.data.root.hasCustomCanonicalUrl) {
            return '';
        }

        if (options.data.root.metaRobotsRaw === 'index, follow') {
            return '';
        }

        if (options.data.root.metaRobotsRaw !== '') {
            output = '<meta name="robots" content="' + options.data.root.metaRobotsRaw + '" />';
        }

        if (
            Array.isArray(options.data.context) &&
            options.data.context[0] && (
                (
                    rendererInstance.siteConfig.advanced.homepageNoIndexPagination &&
                    options.data.context.indexOf('index-pagination') !== -1
                ) || (
                    rendererInstance.siteConfig.advanced.tagNoIndexPagination &&
                    options.data.context.indexOf('tag-pagination') !== -1
                ) || (
                    rendererInstance.siteConfig.advanced.authorNoIndexPagination &&
                    options.data.context.indexOf('author-pagination') !== -1
                )
            )
        ) {
            output = '<meta name="robots" content="noindex, nofollow" />';
        }

        return new Handlebars.SafeString(output);
    });
}

module.exports = metaRobotsHelper;
