"use strict";

const Syslog = require('ain2');
const config = require('../config');
const os = require('os');

const factory = (dependencies = {}) => {
    const {
        $syslog = Syslog,
        $config = config(),
        $os = os
    } = dependencies;

    function syslogAppender(config, layouts) {

        const tag = $config.syslog.tag || "log4js";
        const facility = $config.syslog.facility || "local0";
        const hostname = $os.hostname().split('.').shift() || "localhost";
        const port = $config.syslog.port || 514;
        const address = $config.syslog.address || "localhost";

        let logger = new Syslog({tag: tag, facility: facility, hostname: hostname, address: address, port: port});

        /**
         * the logging
         */
        return function (loggingEvent) {

            const logLevels = {
                5000: logger.trace,
                10000: logger.debug,
                20000: logger.info,
                30000: logger.warn,
                40000: logger.error,
                50000: logger.error
            };

            let level = loggingEvent.level.level;
            const layout = layouts.patternLayout('%p %c - %m%n');
            logLevels[level].call(logger, layout(loggingEvent));
        };
    }

    let configure = function (config, layouts) {
        return syslogAppender(config, layouts);
    };

    /** MODULE EXPORT **/
    return {
        configure: configure
    };
};

module.exports = factory(); //TODO