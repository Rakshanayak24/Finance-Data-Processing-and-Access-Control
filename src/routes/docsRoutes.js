/**
 * Swagger UI Docs Route
 * Serves interactive API documentation at /api/v1/docs
 */
const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const spec = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../docs/openapi.yaml'), 'utf8')
);

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(spec, {
  customSiteTitle: 'Finance Dashboard API Docs',
  swaggerOptions: {
    persistAuthorization: true,    // token stays after page refresh
    defaultModelsExpandDepth: -1,  // hides schema noise at the bottom
    displayRequestDuration: true,  // shows how long each call took
  },
}));

module.exports = router;