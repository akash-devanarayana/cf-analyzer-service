const logger = require('../utils/logger');

const analyzeDom = async (version) => {
    try {
        if (version) {
            return await db.all(queries.SELECT_MAPPINGS_BY_VERSION, version);
        } else {
            return await db.all(queries.SELECT_ALL_MAPPINGS);
        }
    } catch (error) {
        logger.error('Error getting mappings:', error);
        throw new Error('Failed to retrieve mappings from database');
    }
};

module.exports = {
    analyzeDom
};

