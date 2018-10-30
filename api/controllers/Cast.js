'use strict';

const utils = require('../utils/writer.js');
const Cast = require('../service/CastService');
const config = require('../../config.js');
const logger4js = require('../../logger');


const factory = (dependencies = {}) => {
    const {
        $utils = utils(),
        $Cast = Cast(),
        $config = config(),
        $getLogger = logger4js().getLogger,
    } = dependencies;


    const logger = $getLogger($config.appName + '.api_cast_controller ['+process.pid+']');

    let getCast = async function getCast(req, res, next) {
        let pageSize = req.swagger.params['page_size'].value;
        let startId = req.swagger.params['start_id'].value;
        if (pageSize < $config.minPageSize || pageSize > $config.maxPageSize) {
            $utils.writeJson(res, $utils.respondWithCode(400,
                {error: "Page size must in range [" + $config.minPageSize + ".." + $config.maxPageSize + "]"}));
            next();
        } else if (startId < 0) {
            $utils.writeJson(res, $utils.respondWithCode(400, {error: "Start id must be positive integer"}));
            next();
        } else {
            try {
                let response = await $Cast.getCast(pageSize, startId);
                $utils.writeJson(res, response);
                next();
            }
            catch (err) {
                $utils.writeJson(res, $utils.respondWithCode(500, {error: "Internal Server Error. Be patient!"}));
                next();
            }
        }
    };

    /** MODULE EXPORT **/
    return {
        getCast:getCast
    };

};

if (module.parent.filename.includes("swagger")) {
    // If controller is called by swagger which is not aware of DI, let's instantiate this module with
    // default dependencies.
    module.exports = factory();
} else {
    module.exports = factory;
}