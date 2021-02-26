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

if (config.server.secure) {
  app.enable('trust proxy');
  app.use(function(req, res, next) {
    if (req.secure) {
      return next();
    }
    res.redirect(`https://${req.headers.host}${req.url}`);
  });
}

const subdomainForward = require('./server/subdomainForward.js');
app.use(subdomainForward(config.server.subdomains, router));

const pref = config.server.urlprefix ? `/${config.server.urlprefix}` : "";

const getRouting = require('./server/routing_get.js')(router, config, logger);
router.get(`${pref}/`, getRouting.root);
router.get(`${pref}/donation/:id`, getRouting.donation);
router.get(`${pref}/page/:id`, getRouting.page);
router.get(`${pref}/latest`, getRouting.latest);
router.get(`${pref}/thankyou/:id`, getRouting.thanks);
router.get(`${pref}/connect`, getRouting.connect);
router.get(`${pref}/storeSession`, getRouting.storeSession);
router.get(`${pref}/disconnect`, getRouting.disconnect);
router.get(`${pref}/*`, getRouting.any);

// able to receive json POST params
app.use(express.json());
const postRouting = require('./server/routing_post.js')(router, config, logger);
router.post(`${pref}/addEntry`, postRouting.addEntry);
router.post(`${pref}/preview`, postRouting.preview);

const server = app.listen(config.server.port, () => {
  logger.info(`Express running -> PORT ${server.address().port}`);
});
