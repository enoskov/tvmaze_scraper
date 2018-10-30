'use strict';

const db = require('../db');
const config = require('../config.js');
const logger4js = require('../logger');
const Scraper = require('./Scraper');

const factory = (dependencies = {}) => {
    const {
        $db = db(),
        $config = config(),
        $getLogger = logger4js().getLogger,
        $Scraper = Scraper()
    } = dependencies;


    const logger = $getLogger($config.appName + '.scraper ['+process.pid+']');

    async function readGlobalState() {
        logger.debug("Reading global state from db..");
        try {
            let resp = await $db.readGlobalState();
            if (resp === null) {
                // init to 0
                return {
                    lastProcessedShowsPage: 0,
                    lastProcessedShowId: 0
                };
            } else {
                return resp;
            }
        }
        catch (err) {
            logger.error("Error while reading global state " + err);
        }
    }

    async function dumpGlobalState(globalState) {
        logger.debug("Writing global state to db..");
        try {
            await $db.saveGlobalState(globalState);
        }
        catch(err) {
            logger.error("Error while writing global state " + err);
            return new Error("DB error");
        }
    }

    let start = async function() {
        try {
            const scraper = new $Scraper(await readGlobalState());
            await scraper.run();
            scraper.on("monitoring", async (data)=>{
                // Finished scraping and now in monitoring state. Let's record state in DB.
                await dumpGlobalState(data);
            });
        }
        catch (err) {
            logger.fatal("Error while starting scraper task. Something is really bad. " + err);
        }
    };

    /** MODULE EXPORT **/
    return {
        start: start
    }

};

module.exports = factory;