'use strict';

const mongo = require('./mongo');

const factory = (dependencies = {}) => {
    const {
        $mongo = mongo()
    } = dependencies;


    /** MODULE EXPORT **/
    return $mongo;
};

module.exports = factory;