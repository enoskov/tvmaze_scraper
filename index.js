'use strict';

const config = require('./config.js');
const logger4js = require('./logger');
const db = require('./db');
const scraper = require("./scraper/app.js");
const swagger = require("./api/app.js");


const factory = async (dependencies = {}) => {
    const {
        $db = db(),
        $scraper = scraper(),
        $swagger = swagger(),
        $config = config(),
        $getLogger = logger4js().getLogger
    } = dependencies;

    const logger = $getLogger($config.appName + '.index ['+process.pid+']');

    logger.info("Starting the main script..");
    try {
        await $db.connect();
        $swagger.start(); /* sync */
        await $scraper.start();
    }
    catch (err) {
        logger.fatal("Error while starting the main script " + err);
    }

    /** MODULE EXPORT **/
    return {
    };
};

if (module.parent === null) {
    // App is not under test. Let's instantiate it with default dependencies.
    module.exports = factory();
} else {
    // Allow unit tests to inject dependencies
    module.exports = factory;
}