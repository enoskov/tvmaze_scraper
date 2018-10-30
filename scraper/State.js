'use strict';

const config = require('../config.js');
const logger4js = require('../logger');

const factory = (dependencies = {}) => {
    const {
        $config = config(),
        $getLogger = logger4js().getLogger
    } = dependencies;

    const logger = $getLogger($config.appName + '.scraper_State ['+process.pid+']');

    /**
     * @typedef module:scraper.STATES
     * @type {object}
     * @property {string} IDLE        - Background task is not running yet.
     * @property {string} RUNNING     - Background task is activily scraping data abd pushing to db
     * @property {string} MONITORING  - Background task is monitoring for changes in TVMaze DB
     * @property {string} STOPPING    - Background task is being stopped to recover from TVMaze or db error
     */
    const STATES = {
        IDLE: "idle",
        RUNNING: "running",
        MONITORING: "monitoring",
        STOPPING: "stopping"
    };

    class State {

        constructor(state) {
            this.state = state || STATES.IDLE;
        }

        static get STATES() {
            return STATES;
        }

        static isValidState(state) {
            for (let property in STATES) {
                if (STATES.hasOwnProperty(property)) {
                    if (state === STATES[property]) return true;
                }
            }
            return false;
        }

        getState() {
            return this.state;
        }

        setState(newState) {
            if (!State.isValidState(newState)) {
                logger.fatal("Invalid state passed. Something is really wrong. State: %s", JSON.stringify(newState));
                return;
            }
            if (newState !== this.state) {
                logger.debug("Changing state for background task from %s to %s", this.state, newState);
                this.state = newState;
            }
        }

    }

    /** MODULE EXPORT **/
    return State;

};

module.exports = factory;
