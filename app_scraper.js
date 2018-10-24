'use strict';

const config = require('./config.js');
const logger4js = require('./logger');
const db = require('./db');
const scraper = require("./scraper/app.js");


const factory = (dependencies = {}) => {
    const {
        $db = db(),
        $scraper = scraper(),
        $config = config(),
        $getLogger = logger4js().getLogger
    } = dependencies;

    const logger = $getLogger($config.appName + '.index ['+process.pid+']');

    logger.info("Starting the main script..");
    $db.connect();
    $scraper.start();

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