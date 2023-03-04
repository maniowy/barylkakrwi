const gUrl = require('url');

module.exports = function(router, config, logger) {
  let module = {}

  const browserCompatible = require('./compatibility.js');

  module.root = (req, res) => {
    if (!browserCompatible(req, res, logger)) {
      return;
    }
    if (req.cookies) {
      logger.debug('Cookies: ', req.cookies);
    }
    if (req.signedCookies) {
      logger.debug('Signed cookies: ', req.signedCookies);
    }

    const urlPrefix = config.server.urlprefix ? `/${config.server.urlprefix}` :"";
    let userData = req.cookies.userData;
    if (userData === undefined) {
      // Should never happen?
      logger.debug("userData cookie not set");
      res.redirect(gUrl.format({pathname:`${urlPrefix}/`, query:req.query}));
      return
    }
    else {
      logger.debug("userData cookie: ", userData);
    }

    res.render('index', {
      title: 'Baryłka krwi',
      basedir: 'public',
      configData: config.data,
      appPrefix: config.server.appprefix,
      urlPrefix: urlPrefix,
      user: userData.login,
      params: req.query
    });
  };

  module.donation = (req, res) => {
    logger.trace(`retrieving donation: ${req.params.id}`);
    res.render('donation', { id: req.params.id, configData: config.data});
  }

  const WykopAPI = require('./wykop.js')(logger);
  WykopAPI.provideSecrets(config.confidential);
  const barylka = require('./barylka.js')(config, logger);

  module.page = (req, res) => {
    barylka.retrievePage(req.params.id, (entries) => { res.send(entries) });
  }

  module.latest = (req, res) => {
    const token = req?.locals?.token;
    const retrieve = (token) => barylka.retrieveCurrentVolume(token, (volume) => { res.send(`{"volume":${volume}}`) });
    if (token === undefined) {
        WykopAPI.getToken(retrieve);
    }
    else {
      retrieve(token);
    }
  }

  module.thanks = (req, res) => {
    const userData = req.cookies.userData;
    const urlPrefix = config.server.urlprefix ? `/${config.server.urlprefix}` :"";
    res.render('thankyou', {
      basedir: 'public',
      configData: config.data,
      appPrefix: config.server.appprefix,
      urlPrefix: urlPrefix,
      id: req.params.id,
      title: 'Baryłka krwi',
      user: userData.login
    });
  }

  module.disconnect = (req, res) => {
    logger.debug("cookie: ", req.cookies.userData);
    res.clearCookie('userData', {httpOnly: true});
    res.redirect(`/${config.server.urlprefix}`);
  }

  module.any = (req, res) => {
    res.redirect(`/${config.server.urlprefix}`);
  }

  return module
}
