module.exports = function(config, logger) {
  let module = {}

  const WykopAPI = require('./wykop.js')(logger);
  WykopAPI.provideSecrets(config.confidential);

  module.composeEquation = (lastVolume, currentVolumes) => {
    const volume = lastVolume > 0 ? lastVolume : config.data.volume;
    const newVolume = volume - currentVolumes.reduce((acc, cur) => acc + cur, 0);
    const equation = `${volume} - ${currentVolumes.join(" - ")} = ${newVolume}`;
    return equation.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  module.testForCurrentVolume = (body) => {
    let countdown = body.match(/[0-9 ]*.*[-—+].*[0-9 ]*.*=(.*)/);
    if (countdown && countdown.length > 1) {
      const volume = parseInt(countdown[1].trim().replace(/\s/g, ''));
      if (!isNaN(volume)) {
        return volume;
      }
    }
    countdown = body.toLowerCase().match(/.*?aktualny wynik[: a-z-]*([0-9 ]*)/);
    if (countdown && countdown.length > 1) {
      const volume = parseInt(countdown[1].trim().replace(/\s/g, ''));
      if (!isNaN(volume)) {
        return volume;
      }
    }
    return Number.NaN;
  }

  module.retrievePage = (id, onResult) => {
    WykopAPI.retrievePage(config.data.tag, id, onResult);
  }

  module.retrieveCurrentVolume = (user, onResult) => {
    let retriever = (id) => {
      let currentVolume = null;
      module.retrievePage(id, (entries) => {
        const data = entries.data;
        if (!data) {
          this.logger.error("Failed to retrieve page");
          return;
        }
        for (let e of data) {
          const volume = module.testForCurrentVolume(e.body);
          if (!isNaN(volume)) {
            currentVolume = volume;
            break;
          }
        }
        if (currentVolume) {
          onResult(currentVolume);
          return;
        }
        if (id < 10) {
          retriever(id+1);
        }
        else {
          this.logger.error(`Failed to retrieve result, tried first ${id} pages`);
        }
      });
    };
    retriever(1);
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

  module.composeMessage = (req, body, params, onReady) => {
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

    const missingWordRegexp = word => new RegExp("(?:^|\\s+|\\.|,|;)" + word + "(?:\\s+|\\.|,|;|-|$)");

    const missingTags = config.data.tags.filter(tag => {
      return output.match(missingWordRegexp(tag)) == null
    });
    if (missingTags.length) {
      output += `\n${missingTags.join(" ")}`;
    }

    const paramsJson = JSON.parse(params);
    const missingSupporters = config.data.supporters.filter(s => {
      return paramsJson.hasOwnProperty(s.id);
    }).filter(s => {
      return output.match(missingWordRegexp(s.nick)) == null
    });
    if (missingSupporters.length) {
      output += ` ${missingSupporters.map(s => s.nick).join(" ")}`;
    }

    output += `\n\n${module.getFooter()}`;

    const login = req.cookies.userData ? req.cookies.userData.login: null;
    module.retrieveCurrentVolume(login, (volume) => {
      const volumes = donations.map(d => d.volume);
      const equation = module.composeEquation(volume, volumes);
      output = `${equation}\n${output}`;
      onReady(output);
    });
  }

  module.getFooter = () => {
    const addr = config.server.url;
    const pref = config.server.urlprefix ? `/${config.server.urlprefix}` : "";
    let output = `Wpis został dodany za pomocą [tego skryptu](${addr}${pref}).`;
    output += `\n[Dodaj wpis](${addr}${pref}) | [Regulamin](${addr}/regulamin) | [Wzór wpisu](https://www.wykop.pl/wpis/49653241) | [Strona akcji](${addr})`;
    return output;
  }

  return module;
}
