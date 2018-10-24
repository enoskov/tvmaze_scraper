"use strict";

const log4js = require('log4js');
const config = require('../config');

const factory = (dependencies = {}) => {
    const {
        $log4js = log4js,
        $config = config()
    } = dependencies;

    $log4js.addLayout('common', config => function (logEvent) {
        return $config.syslog.layout(logEvent);
    });

    let appenders = ['console'];
    if ($config.logConfig.isEnabled) appenders.push('file');
    if ($config.syslog.isEnabled) appenders.push('syslog');
    $log4js.configure({
        appenders: {
            console: {type: 'console'},
            file: {
                type: 'file',
                filename: $config.logConfig.filename,
                maxLogSize: $config.logConfig.maxFileSize,
                backups: $config.logConfig.numFiles
                // ,layout: {type: 'common', separator: '\n'}
            },

            syslog: {type: __dirname + '/syslog', layout: {type: 'basic'}}
        },
        categories: {
            default: {
                appenders: appenders,
                level: $config.logConfig.level
            }

        }
    });

    /**
     * @static
     * @function module:logger.getLogger
     * @param {string} moduleName - String representing a current module where log facility is going to use. This string appears
     *                              in the resulting log line.
     * @desc This function returns logger object configured to print log line with module as a part of the log line. Module
     * name is passed as a parameter to this function.
     */
    let getLogger = function getLogger4Module(moduleName) {
        return log4js.getLogger(moduleName);
    };

    /** MODULE EXPORT **/
    return {
        getLogger: getLogger
    };
};

module.exports = factory;
