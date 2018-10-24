'use strict';

/**
 * @module mongo
 * @desc Encapsulates the mongoDB driver
 */

const connection = require('./connection');
const modelGlobal = require('./modelGlobal');
const modelShow = require('./modelShow');

const factory = (dependencies = {}) => {
    const {
        $connection = connection(),
        $modelGlobal = modelGlobal(),
        $modelShow = modelShow()
    } = dependencies;

    /** MODULE EXPORT **/
    return {
        connect: $connection.connect,
        saveGlobalState: $modelGlobal.saveGlobalState,
        readGlobalState: $modelGlobal.readGlobalState,
        saveShow: $modelShow.saveShow,
        getShowsPage: $modelShow.getShowsPage
    };

};

module.exports = factory;