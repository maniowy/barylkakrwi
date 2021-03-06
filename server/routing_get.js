module.exports = function(router, config, logger) {
  let module = {}

  function internetExplorer(req) {
    const userAgent = req.headers['user-agent'];
    logger.debug(`User agent: ${userAgent}`);
    return userAgent.indexOf("MSIE ") > 0 || !!userAgent.match(/Trident.*rv\:11\./);
  }

  module.root = (req, res) => {
    if (internetExplorer(req)) {
      res.render('not-supported', {
        title: 'Baryłka krwi',
        basedir: 'public'
      });
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
    if (userData == undefined) {
      logger.debug("userData cookie not set");
      res.redirect(`${urlPrefix}/connect`);
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
      user: userData.login
    });
  };

  module.donation = (req, res) => {
    logger.trace(`retrieving donation: ${req.params.id}`);
    res.render('donation', { id: req.params.id, configData: config.data});
  }

  const WykopAPI = require('./wykop.js')(logger);
  WykopAPI.provideSecrets(config.confidential);

  module.page = (req, res) => {
    WykopAPI.retrievePage(req.params.id, (entries) => { res.send(entries) });
  }
  module.latest = (req, res) => {
    const login = req.cookies.userData ? req.cookies.userData.login: null;
    WykopAPI.retrieveCurrentVolume(login, (volume) => { res.send(`{"volume":${volume}}`) });
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

  module.connect = (req, res) => {
    const urlPrefix = config.server.urlprefix ? `/${config.server.urlprefix}` : "";
    const protocol = config.server.secure ? "https" : "http";
    let url = WykopAPI.connectUrl(`${protocol}://${req.headers.host}${urlPrefix}/storeSession`);
    logger.debug("redirecting to: ", url);
    res.redirect(url);
  }

  module.storeSession = (req, res) => {
    let cd = req.query.connectData;
    logger.trace("/login: Wykop connectData: ", cd);
    let decoded = Buffer.from(cd, 'base64').toString('ascii');
    logger.debug("/login: connectData decoded: ", decoded);
    let json = JSON.parse(decoded);
    logger.debug("User login: ", json.login);
    logger.debug("User token: ", json.token);
    logger.debug("sign: ", json.sign);

    if (req.cookies) {
      logger.debug('Cookies: ', req.cookies);
    }
    if (req.signedCookies) {
      logger.debug('Signed cookies: ', req.signedCookies);
    }
    WykopAPI.login(json.login, json.token, (sts, out) => {
      if (sts == 200) {
        logger.info("Logged in: ", out.data.profile.login);
        res.cookie('userData', {login: out.data.profile.login, userkey: out.data.userkey},
          { maxAge: 24*60*60*1000, httpOnly: true});
        WykopAPI.userKey = out.data.userkey;
        res.redirect(`/${config.server.urlprefix}`);
      }
      else {
        res.sendStatus(sts);
      }
    }, err => {
      if (err.code && err.message_pl) {
        res.status(err.code).send(err.message_pl);
      } else if (err.code && err.message_en) {
        res.status(err.code).send(err.message_en);
      } else {
        res.status(500).send("Przepraszamy, wystąpił nieokreślony błąd.\nSkontaktuj się z @wuochu lub innymi opiekunami tagu.");
      }
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
