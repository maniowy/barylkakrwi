module.exports = function(router, config, logger) {
  let module = {}

  const WykopAPI = require('./wykop.js')(logger);
  WykopAPI.provideSecrets(config.confidential);

  const barylka = require('./barylka.js')(config, logger);

  // multi-part forms
  const formidable = require('formidable');

  function validateInputBody(body, onError) {
    logger.debug("Validating input:", body);
    // +dates should be present and in range
    // +donation kind should be present and one of defined values
    // +donation volume should be present and in range
    // +if site is present, it should be one of defined values
    // +if city is present and site is rckik/wckik/mswia, city should be one of defined values
    // +if blood group is present, it should be one of defined values
    // +if private counter is present, should be positive
    // +if orders are present, should be defined
    const startDate = new Date(config.data.startDate);
    const today = new Date();
    if (!Array.isArray(body.donations)) {
      logger.debug("Donations missing");
      onError(`Nieprawidłowe żądanie: brak donacji`);
      return false;
    }
    const dates = body.donations.map(d => d.date);
    if (dates.length != new Set(dates).size) {
      logger.debug("Repeating dates");
      onError("Wykryto powtarzające się daty donacji");
      return false;
    }
    for (d of body.donations) {
      const date = new Date(d.date);
      if (d.date === undefined || date < startDate || date > today) {
        logger.debug("Date out of range: ", date);
        onError(`Nieprawidłowa data donacji: ${date}`);
        return false;
      }
      // FIXME work on indices
      if (!config.data.kinds.map(k => k.name).includes(d.kind)) {
        logger.debug("Invalid donation kind: ", d.kind);
        onError(`Nieprawidłowy rodzaj donacji: ${d.kind}`);
        return false;
      }
      // FIXME work on indices
      const configKind = config.data.kinds.find(k => k.name == d.kind);
      // issue: plasma volume is divided by 3 but here it is compared to max value before division
      if (!Number.isInteger(d.volume) || d.volume <= 0 || d.volume > configKind.max) {
        logger.debug(`Volume out of range (0, ${configKind.max}]: ${d.volume}`);
        onError(`Nieprawidłowa objętość donacji: ${d.volume} nie mieści się w zakresie (0, ${configKind.max}]`);
        return false;
      }
      // FIXME work on indices
      if (d.site && !config.data.sites.map(s => s.name).includes(d.site)) {
        logger.debug(`Invalid site provided: ${d.site}`);
        onError(`Nieprawidłowa placówka: ${d.site}`);
        return false;
      }
      if (d.city && typeof d.city != typeof "") {
          logger.debug(`Invalid city provided: ${d.city}`);
          onError(`Nieprawidłowa miejscowość: ${d.city}`);
      }
      if (d.city && d.site && config.data.sites.find(s => s.name == d.site).cities) {
        if (!config.data.sites.find(s => s.name == d.site).cities.includes(d.city)) {
          logger.debug(`Invalid city provided: ${d.city}`);
          onError(`Nieprawidłowa miejscowość: ${d.city}`);
          return false;
        }
      }
      if (d.abroadCity && typeof d.abroadCity != typeof "") {
          logger.debug(`Invalid abroad city provided: ${d.abroadCity}`);
          onError(`Nieprawidłowy OT: ${d.abroadCity}`);
      }
    }
    if (body.group && !config.data.groups.map(g => g.name).includes(body.group)) {
      logger.debug(`Invalid blood group provided: ${body.group}`);
      onError(`Nieprawidłowa grupa krwi: ${body.group}`);
      return false;
    }
    if (Number.isInteger(body.privateCounter) && body.privateCounter < 0) {
      logger.debug(`Negative private counter provided: ${body.privateCounter}`);
      onError(`Prywatny licznik nie może być negatywny`);
      return false;
    }
    if (Array.isArray(body.orders) && body.orders.filter(o => !config.data.orders.map(o => o.name).includes(o)).length) {
      const invalidOrders = body.orders.filter(o => !config.data.orders.map(o => o.name).includes(o));
      logger.debug(`Invalid orders provided: ${invalidOrders.join(", ")}`);
      onError(`Nieprawidłowe odznaczenia: ${invalidOrders.join(", ")}`);
      return false;
    }
    return true;
  }

  function validate(body, files, onError) {
    if (!files || !files.embed) {
      onError("Załącz zdjęcie");
      return false;
    }
    // FIXME validate file type
    return validateInputBody(body);
  }

  function allOrOne(arr, sep) {
    if (new Set(arr).size == 1) {
      return arr[0];
    }
    return arr.join(sep);
  }

  function shortPlasma(kind) {
      return kind.match(/^osocze/) ? "osocze" : kind;
  }

  function composeMessage(req, body, onReady) {
    let output = "";
    const donations = body.donations;
    const sep = ", ";

    output += "Data donacji - ";
    const dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
    output += donations.map(d => d.date.replace(dateRegex, '$3.$2.$1')).join(sep);
    output += "\nRodzaj donacji - ";
    output += allOrOne(donations.map(d => shortPlasma(d.kind)), sep);

    const cities = allOrOne(donations.filter(d => d.city).map(d => {
      let out = "";
      if (d.site != config.data.sites[config.data.sites.length - 1].name) {
        out += `${d.site} `;
      }
      out += d.city
      if (d.abroad && d.abroadCity.length) {
        out += ` OT ${d.abroadCity}`;
      } else if (d.bus) {
        // TODO optional busCity?
        out += " (donacja w krwiobusie)";
      }
      return out;
    }), sep);

    if (cities.length) {
      output += `\nMiejsce donacji - ${cities}`;
    }

    if (body.group) {
      output += `\nGrupa krwi - ${body.group}`;
    }

    if (Number.isInteger(body.privateCounter)) {
      output += `\nPrywatny licznik - ${body.privateCounter} ml`;
    }

    if (body.orders.length) {
      output += `\nPrzyznane odznaczenia - ${body.orders.join(sep)}`;
    }

    if (body.msg) {
      output += `\n\n${body.msg.trim()}`;
    }

    const missingTags = config.data.tags.filter(tag => {
      return output.match(new RegExp("(?:^|\\s+|\\.|,|;)" + tag + "(?:\\s+|\\.|,|;|-|$)")) == null
    });
    if (missingTags.length) {
      output += `\n${missingTags.join(" ")}`;
    }

    const addr = "https://barylkakrwi.org";

    output += `\n\nWpis został dodany za pomocą [tego skryptu](${addr}/skrypt).`;
    output += `\n[Regulamin](${addr}/regulamin) | [Wzór wpisu](https://www.wykop.pl/wpis/49653241) | [Strona akcji](${addr})`;

    const login = req.cookies.userData ? req.cookies.userData.login: null;
    barylka.retrieveCurrentVolume(login, (volume) => {
      const volumes = donations.map(d => d.volume);
      const equation = barylka.composeEquation(volume, volumes);
      output = `${equation}\n${output}`;
      onReady(output);
    });
  }

  module.addEntry = (req, res) => {
    logger.trace("Received multi-part addEntry request");
    if (!req.cookies) {
      res.sendStatus(401);
      return;
    }
    const userData = req.cookies.userData;
    if (userData == undefined) {
      res.sendStatus(401);
      return;
    }
    WykopAPI.userKey = userData.userkey;
    const form = formidable({multiples: true});
    let resolver;
    let rejector;
    let validated = new Promise((resolve, reject) => { resolver = resolve; rejector = reject;});
    form.parse(req, (err, fields, files) => {
      if (err) {
        next(err);
        return;
      }
      logger.info(`addEntry request: `, fields);
      const body = JSON.parse(fields.body)
      if (!validate(body, files, error => rejector({code: 400, message: error}))) {
        return;
      }
      composeMessage(req, body, (message) => {
        // TODO if there is more than one file supplied, put first in the entry and the rest in the comment
        // FIXME forward rejector
        WykopAPI.addEntry({body:message, adultmedia:body.adultmedia.toString()}, (Array.isArray(files) ? files[0] : files), wykopResponse => {
          logger.debug("Received response from wykop: ", wykopResponse);
          logger.trace("Entry url: ", WykopAPI.entryUrl(wykopResponse.data.id));
          resolver(wykopResponse.data.id);
        }, error => {
          rejector(error);
        });
      });
    });
    validated.then(valid => res.status(200).send({id: valid}))
      .catch(err => {
        logger.error(`Validation error: ${err.code} ${err.message}`);
        //res.set('Content-Type', 'text/plain');
        if (err.code && err.message) {
          res.status(err.code).send(err.message);
        } else if (err.code && err.message_pl) {
          res.status(err.code).send(err.message_pl);
        } else if (err.code && err.message_en) {
          res.status(err.code).send(err.message_en);
        } else {
          res.status(500).send("Przepraszamy, wystąpił nieokreślony błąd.\nSkontaktuj się z @wuochu lub innymi opiekunami tagu.");
        }
      });
  }

  module.preview = (req, res) => {
    logger.trace("Received multi-part preview request");
    const form = formidable({multiples: true});
    let resolver;
    let rejector;
    let validated = new Promise((resolve, reject) => { resolver = resolve; rejector = reject;});
    form.parse(req, (err, fields) => {
      if (err) {
        next(err);
        return;
      }
      logger.trace(`preview request: `, fields);
      const body = JSON.parse(fields.body)
      if (!validateInputBody(body, error => rejector({code: 400, message: error}))) {
        return;
      }
      composeMessage(req, body, (message) => {
        if (body.adultmedia) {
          message += "\n+18";
        }
        resolver({body:message});
      });
    });
    validated.then(valid => res.status(200).send(valid))
      .catch(err => {
        logger.error(`Validation error: ${err.code} ${err.message}`);
        //res.set('Content-Type', 'text/plain');
        res.status(err.code).send(err.message);
      });
  }

  return module
}
