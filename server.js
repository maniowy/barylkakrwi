const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('./server/logger.js')();
const app = express();

// generating html with pug
app.set('view engine', 'pug');
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

const config = {
  data: require('./config/data.json'),
  confidential: require('./config/confidential.json'),
  server: require('./config/server.json')
}

const router = express.Router();

const subdomainForward = require('./server/subdomainForward.js');
app.use(subdomainForward(['barylka.bieda.it', 'localhost'], router));

const getRouting = require('./server/routing_get.js')(router, config, logger);
router.get('/', getRouting.root);
router.get('/donation/:id', getRouting.donation);
router.get('/page/:id', getRouting.page);
router.get('/latest', getRouting.latest);
router.get('/thankyou/:id', getRouting.thanks);
router.get('/connect', getRouting.connect);
router.get('/storeSession', getRouting.storeSession);
router.get('/disconnect', getRouting.disconnect);
router.get('/*', getRouting.any);

// able to receive json POST params
app.use(express.json());
const postRouting = require('./server/routing_post.js')(router, config, logger);
router.post('/addEntry', postRouting.addEntry);
router.post('/preview', postRouting.preview);

const server = app.listen(config.server.port, () => {
  logger.info(`Express running -> PORT ${server.address().port}`);
});
