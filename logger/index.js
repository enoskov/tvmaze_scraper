'use strict';
/**
 * @module logger
 * @desc Encapsulates the logger functionality both syslog and file.
 */

const logger4js = require('./logger');

const factory = (dependencies = {}) => {
    const {
        getLogger = logger4js().getLogger
    } = dependencies;


    /** MODULE EXPORT **/
    return {
        getLogger: getLogger
    };
};

module.exports = factory;