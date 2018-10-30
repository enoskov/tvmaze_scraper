'use strict';

const mongoose = require('mongoose');
const connection = require('./connection');
const config = require('../../config.js');
const logger4js = require('../../logger');

/** Singleton. Keep fields static. **/
let Show = null;

const factory = (dependencies = {}) => {
    const {
        $mongoose = mongoose,
        $connection = connection(),
        $config = config(),
        $getLogger = logger4js().getLogger
    } = dependencies;

    const logger = $getLogger($config.appName + '.mongo_showModel ['+process.pid+']');

    /**
     * @private
     * @typedef showSchema
     * @type {object}
     * @property {number} id - Store the show id scraped from TVMaze
     * @property {string} name - Stores show's name scraped from TVMaze
     * @property {Array} cast - Stores the arrays of casts for the show
     */
    let showSchema = new $mongoose.Schema({
        id: Number,
        name: String,
        cast: [{
            id: Number,
            name: String,
            birthday: Date
        }]
    });

    /**
     * @public
     * @function module:mongo.saveShow
     * @desc Save show in mongoDB.
     * @param {object} show - Show scraped from TVMaze
     * @return {Promise} Returns true if successful. Return new Error() in case of failure.
     */
    let saveShow = async function (show) {
        logger.debug("Saving show in db with data:" + JSON.stringify(show));
        if (!$connection.isDbConnected()) {
            logger.warn("Trying to access db while it's not connected");
            return new Error("db error");
        }
        if (Show === null) Show = $connection.getDB().model('show', showSchema, 'shows');
        try {
            let response = await Show.findOneAndUpdate({id: show.id}, show, {upsert: true});
            if (response === null) {
                logger.info("Show saved in db successfully:" + JSON.stringify(response));
            } else {
                logger.warn("Show updated in db successfully. It should not normally happen. Show:" + JSON.stringify(response));
            }
            return true;
        }
        catch (err) {
            logger.info("Error while saving show to mongoDB " + err);
            return new Error("db error");
        }
    };

    /**
     * @public
     * @function module:mongo.getShowsPage
     * @desc Save show in mongoDB.
     * @param {number} startId - Start id for message given we send pages ordered by id asc. For the first page it's equal to null.
     * @param {number} pageSize - The size of the page to be returned back to the caller.
     * @return {Promise} Promise object which resolves to a page of shows. Rejects in case of error.
     */
    let getShowsPage = async function (startId, pageSize) {
        logger.debug("Getting shows page starting %s with size %d", startId, pageSize);
        if (!$connection.isDbConnected()) {
            logger.warn("Trying to access db while it's not connected");
            return new Error("db not connected");
        }
        if (Show === null) Show = $connection.getDB().model('show', showSchema, 'shows');
        let findConditions = {};
        if (typeof startId === 'number') findConditions = {id: {$gte: startId}};
        try {
            let response = await Show.find(findConditions).sort({id: 1}).limit(pageSize);
            if (!Array.isArray(response)) {
                logger.error("Got nothing for page request. Oops.");
                return new Error("Unexpected result for get page request");
            } else {
                logger.debug("Got the following number of shows: %d", response.length);
                response = response.map((item) => {
                    return {
                        id: item.id,
                        name: item.name,
                        cast: item.cast.map((item) => {
                            return {
                                id: item.id,
                                name: item.name,
                                birthday: item.birthday
                            };
                        })
                    };
                });
                return response;
            }
        }
        catch (err) {
            logger.info("Error while saving show to mongoDB " + err);
            return new Error("mongoDB error");
        }
    };

    /** MODULE EXPORT **/
    return {
        saveShow: saveShow,
        getShowsPage: getShowsPage
    };
};

module.exports = factory;
