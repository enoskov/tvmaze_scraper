'use strict';

const mongoose = require('mongoose');
const connection = require('./connection');
const config = require('../../config.js');
const logger4js = require('../../logger');

/** Singleton. Keep fields static. **/
let Global = null;

const factory = (dependencies = {}) => {
    const {
        $mongoose = mongoose,
        $connection = connection(),
        $config = config(),
        $getLogger = logger4js().getLogger
    } = dependencies;

    const logger = $getLogger($config.appName + '.mongo_globalModel ['+process.pid+']');

    /**
     * @private
     * @typedef globalSchema
     * @type {object}
     * @property {number} lastProcessedShowsPage - Stores the latest processed shows page. Used by background task to monitor
     *                                             for changes.
     * @ property {number} lastProcessedShowId   - Stores last processed show id. Even on the same shows page a new show may
     *                                             be appended sooner or later. So need to track it as well.
     */
    let globalSchema = new $mongoose.Schema({
        lastProcessedShowsPage: Number,
        lastProcessedShowId: Number
    });

    /**
     * @public
     * @function module:mongo.saveGlobalState
     * @desc Save globals in mongoDB.
     * @param {object} globals - The object containing global state to persist in database.
     * @return {Promise} Promise object represents saved globals in db
     */
    let saveGlobalState = async function (globals) {
        logger.debug("Updating global state with data:" + JSON.stringify(globals));
        if (!$connection.isDbConnected()) {
            logger.warn("Trying to access db while it's not connected");
            return new Error("db not connected");
        }
        if (Global === null) Global = $connection.getDB().model('global', globalSchema, 'global');
        try {
            let response = await Global.updateOne({}, globals, {upsert: true});
            logger.info("Global state successfully updated in mongoDB to data:" + JSON.stringify(response));
            return globals;
        }
        catch (err) {
            logger.info("Error while updating global state in mongoDB " + err);
            return new Error("mongoDB error");
        }
    };

    /**
     * @public
     * @function module:mongo.readGlobalState
     * @desc Read global state from mongoDB.
     * @return {Promise} Promise object which represents the global state read from db
     */
    let readGlobalState = async function () {
        logger.debug("Reading global state from mongoDB");
        if (!$connection.isDbConnected()) {
            logger.warn("Trying to access db while it's not connected");
            return new Error("db not connected");
        }
        if (Global === null) Global = $connection.getDB().model('global', globalSchema, 'global');
        try {
            let response = await Global.findOne({});
            logger.info("Global state successfully read from mongoDB:" + JSON.stringify(response));
            if (response !== null) {
                return {
                    lastProcessedShowsPage: response.lastProcessedShowsPage,
                    lastProcessedShowId: response.lastProcessedShowId
                };
            } else {
                return null;
            }
        } catch(err) {
            logger.info("Error while reading global state from mongoDB");
            return new Error("mongoDB error");
        }
    };

    /** MODULE EXPORT **/
    return {
        saveGlobalState: saveGlobalState,
        readGlobalState: readGlobalState
    };
};

module.exports = factory;
