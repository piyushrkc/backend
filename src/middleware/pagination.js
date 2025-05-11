/**
 * Pagination middleware for API endpoints
 * Extracts and validates pagination parameters
 */
const paginationMiddleware = (req, res, next) => {
  // Default pagination values
  const DEFAULT_PAGE = 1;
  const DEFAULT_LIMIT = 10;
  const MAX_LIMIT = 100;
  
  // Extract pagination params from query string
  let { page, limit, sort, fields } = req.query;
  
  // Parse and validate page
  const parsedPage = parseInt(page, 10);
  req.pagination = {
    page: (!isNaN(parsedPage) && parsedPage > 0) ? parsedPage : DEFAULT_PAGE
  };
  
  // Parse and validate limit
  const parsedLimit = parseInt(limit, 10);
  req.pagination.limit = (!isNaN(parsedLimit) && parsedLimit > 0) 
    ? Math.min(parsedLimit, MAX_LIMIT) 
    : DEFAULT_LIMIT;
  
  // Calculate skip (offset)
  req.pagination.skip = (req.pagination.page - 1) * req.pagination.limit;
  
  // Handle sorting
  if (sort) {
    // Convert sort string (e.g. "name,-createdAt") to MongoDB sort object
    // Format: field1,field2,-field3 (negative prefix means descending)
    req.pagination.sort = sort.split(',').reduce((sortObj, field) => {
      if (field.startsWith('-')) {
        sortObj[field.substring(1)] = -1;
      } else {
        sortObj[field] = 1;
      }
      return sortObj;
    }, {});
  }
  
  // Handle field selection
  if (fields) {
    // Convert fields string (e.g. "name,email,phone") to MongoDB projection
    req.pagination.projection = fields.split(',').reduce((projObj, field) => {
      projObj[field.trim()] = 1;
      return projObj;
    }, {});
  }
  
  next();
};

/**
 * Format pagination metadata for response
 * @param {number} total - Total number of items
 * @param {object} pagination - Pagination object from request
 * @returns {object} Pagination metadata
 */
const paginationMetadata = (total, pagination) => {
  const { page, limit } = pagination;
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    totalPages,
    currentPage: page,
    perPage: limit,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

module.exports = {
  paginate: paginationMiddleware,
  paginationMetadata
};